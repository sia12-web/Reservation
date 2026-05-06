/**
 * Reservation System Stress Test
 * 
 * Tests the table assignment + reassignment engine by simulating
 * sequential bookings against the real database, without needing
 * Redis/Stripe (bypasses distributed lock and payment).
 * 
 * Validates:
 * - Solo diners (party 1) get real tables, never overflow
 * - First-come-first-served: existing guests are never pushed to overflow
 * - Overflow only happens when the restaurant is genuinely full
 * - Large parties get correct table combos
 */

import { PrismaClient } from "@prisma/client";
import { findBestTableAssignment } from "../src/services/tableAssignment/engine";
import { TableConfig } from "../src/services/tableAssignment/types";
import { trySmartReassignment } from "../src/services/reassignment";

const prisma = new PrismaClient();

// ─── Test Config ───────────────────────────────────────────

const TEST_DATE = "2026-05-01"; // Use a future date to avoid conflicts
const SLOT_START = new Date(`${TEST_DATE}T17:30:00.000Z`);
const SLOT_END = new Date(`${TEST_DATE}T19:30:00.000Z`);

interface TestReservation {
  name: string;
  partySize: number;
  expectedOverflow: boolean; // true = we EXPECT this to go to overflow
}

// Scenarios to test in order
const SCENARIOS: TestReservation[] = [
  // --- Round 1: Solo diners should get real tables ---
  { name: "Solo-Alex",    partySize: 1,  expectedOverflow: false },
  { name: "Solo-Beth",    partySize: 1,  expectedOverflow: false },
  
  // --- Round 2: Small parties ---
  { name: "Small-Carlos", partySize: 3,  expectedOverflow: false },
  { name: "Small-Diana",  partySize: 4,  expectedOverflow: false },
  
  // --- Round 3: Circular table range (5-7) ---
  { name: "Mid-Eve",      partySize: 6,  expectedOverflow: false },
  { name: "Mid-Frank",    partySize: 7,  expectedOverflow: false },
  
  // --- Round 4: Large parties (need combos) ---
  { name: "Large-Grace",  partySize: 12, expectedOverflow: false },
  { name: "Large-Hamy",   partySize: 16, expectedOverflow: false },
  
  // --- Round 5: More bookings to fill up ---
  { name: "Fill-Ivan",    partySize: 4,  expectedOverflow: false },
  { name: "Fill-Jasmine", partySize: 2,  expectedOverflow: false },
  
  // --- Round 6: System should be nearly full ---
  { name: "Late-Kevin",   partySize: 8,  expectedOverflow: true },
  { name: "Late-Luna",    partySize: 1,  expectedOverflow: false }, // T14 still free
  
  // --- Round 7: T5 is still available ---
  { name: "Final-Max",    partySize: 2,  expectedOverflow: false }, // T5 still free
  
  // --- Round 8: Only T4/T6 (circular, min 5) left — party of 2 can't sit there ---
  { name: "True-Over",    partySize: 2,  expectedOverflow: true },
];

// ─── Helpers ───────────────────────────────────────────────

function generateShortId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ─── Main Test Runner ──────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         RESERVATION SYSTEM STRESS TEST                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // 1. Load layout
  const layout = await prisma.layout.findFirst({
    where: { isActive: true },
    include: { tables: true },
  });

  if (!layout) {
    console.error("❌ No active layout found. Run the server once first.");
    return;
  }

  const tableConfigs: TableConfig[] = layout.tables.map((t) => ({
    id: t.id,
    type: (t.type as TableConfig["type"]) ?? "STANDARD",
    minCapacity: t.minCapacity ?? 1,
    maxCapacity: t.id === "T15" ? 999 : (t.maxCapacity ?? 4),
    priorityScore: t.priorityScore ?? 0,
    x: t.x,
    y: t.y,
  }));

  const adjacency = (layout.adjacencyGraph as Record<string, string[]>) ?? {};

  console.log(`Layout: ${layout.name}`);
  console.log(`Tables: ${tableConfigs.map(t => `${t.id}(${t.minCapacity}-${t.maxCapacity})`).join(", ")}`);
  console.log(`Test slot: ${SLOT_START.toISOString()} → ${SLOT_END.toISOString()}\n`);

  // 2. Clean up any previous test data for this date
  const existingTestRes = await prisma.reservation.findMany({
    where: {
      startTime: { gte: new Date(`${TEST_DATE}T00:00:00Z`), lt: new Date(`${TEST_DATE}T23:59:59Z`) },
    },
    select: { id: true },
  });

  if (existingTestRes.length > 0) {
    console.log(`🧹 Cleaning ${existingTestRes.length} existing reservations for ${TEST_DATE}...`);
    const ids = existingTestRes.map(r => r.id);
    await prisma.reservationTable.deleteMany({ where: { reservationId: { in: ids } } });
    await prisma.payment.deleteMany({ where: { reservationId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { reservationId: { in: ids } } });
    await prisma.reservation.deleteMany({ where: { id: { in: ids } } });
  }

  // 3. Run scenarios
  const results: { name: string; partySize: number; tables: string[]; isOverflow: boolean; expected: boolean; pass: boolean }[] = [];
  let passed = 0;
  let failed = 0;

  console.log("─── BOOKING SEQUENCE ─────────────────────────────────────────\n");

  for (const scenario of SCENARIOS) {
    // Find what's currently unavailable
    const bookedTables = await prisma.reservationTable.findMany({
      where: {
        reservation: {
          startTime: { lt: SLOT_END },
          endTime: { gt: SLOT_START },
          status: { in: ["HOLD", "WAITLIST", "PENDING_DEPOSIT", "CONFIRMED", "CHECKED_IN"] },
        },
      },
      select: { tableId: true },
    });

    const unavailableIds = [...new Set(bookedTables.map(r => r.tableId))].filter(id => id !== "T15");
    const availableIds = tableConfigs.map(t => t.id).filter(id => !unavailableIds.includes(id));

    // Try direct assignment
    const assignment = findBestTableAssignment(scenario.partySize, availableIds, {
      tables: tableConfigs,
      adjacency,
    });

    let finalTableIds: string[] = [];
    let reassigned = false;

    if (assignment.best && (scenario.partySize < 10 || assignment.best.score <= -1000)) {
      finalTableIds = assignment.best.tableIds;
    } else {
      // Try reassignment
      const reassignment = await trySmartReassignment(prisma, {
        newPartySize: scenario.partySize,
        startTime: SLOT_START,
        endTime: SLOT_END,
        layoutId: layout.id,
        allTables: tableConfigs,
        adjacency,
      });

      if (reassignment.canReassign) {
        finalTableIds = reassignment.assignment.tableIds;
        reassigned = true;

        // Apply moves
        for (const move of reassignment.moves) {
          await prisma.reservationTable.deleteMany({ where: { reservationId: move.reservationId } });
          await prisma.reservationTable.createMany({
            data: move.newTableIds.map((tid, idx) => ({
              reservationId: move.reservationId,
              tableId: tid,
              layoutId: layout.id,
              isPrimary: idx === 0,
            })),
          });
        }
      } else if (assignment.best) {
        finalTableIds = assignment.best.tableIds;
      } else {
        // Total failure — no tables at all
        finalTableIds = ["T15"];
      }
    }

    const isOverflow = finalTableIds.includes("T15");
    const status = isOverflow ? "WAITLIST" : "CONFIRMED";

    // Create reservation
    const reservation = await prisma.reservation.create({
      data: {
        shortId: generateShortId(),
        clientName: scenario.name,
        clientPhone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        partySize: scenario.partySize,
        startTime: SLOT_START,
        endTime: SLOT_END,
        status,
        depositStatus: "NOT_REQUIRED",
        source: "WEB",
      },
    });

    await prisma.reservationTable.createMany({
      data: finalTableIds.map((tid, idx) => ({
        reservationId: reservation.id,
        tableId: tid,
        layoutId: layout.id,
        isPrimary: idx === 0,
      })),
    });

    const pass = isOverflow === scenario.expectedOverflow;
    if (pass) passed++;
    else failed++;

    results.push({
      name: scenario.name,
      partySize: scenario.partySize,
      tables: finalTableIds,
      isOverflow,
      expected: scenario.expectedOverflow,
      pass,
    });

    const icon = pass ? "✅" : "❌";
    const overflowTag = isOverflow ? " [OVERFLOW]" : "";
    const reassignTag = reassigned ? " [REASSIGNED]" : "";
    console.log(
      `${icon} ${scenario.name.padEnd(16)} party=${String(scenario.partySize).padEnd(3)} → ${finalTableIds.join(", ").padEnd(20)}${overflowTag}${reassignTag}`
    );
  }

  // 4. Verify no existing reservation was moved to overflow
  console.log("\n─── POST-BOOKING INTEGRITY CHECK ─────────────────────────────\n");

  const allRes = await prisma.reservation.findMany({
    where: {
      startTime: { gte: new Date(`${TEST_DATE}T00:00:00Z`), lt: new Date(`${TEST_DATE}T23:59:59Z`) },
    },
    include: { reservationTables: true },
    orderBy: { createdAt: "asc" },
  });

  let integrityFail = false;
  for (const res of allRes) {
    const tables = res.reservationTables.map(rt => rt.tableId);
    const isOverflow = tables.includes("T15");
    const scenario = SCENARIOS.find(s => s.name === res.clientName);

    if (scenario && !scenario.expectedOverflow && isOverflow) {
      console.log(`❌ INTEGRITY FAIL: ${res.clientName} (party ${res.partySize}) ended up on OVERFLOW but shouldn't have!`);
      integrityFail = true;
    } else {
      console.log(`   ${res.clientName.padEnd(16)} → ${tables.join(", ").padEnd(20)} status=${res.status}`);
    }
  }

  // 5. Check for table double-booking
  console.log("\n─── DOUBLE-BOOKING CHECK ─────────────────────────────────────\n");

  const tableUsage: Record<string, string[]> = {};
  for (const res of allRes) {
    if (res.status === "CANCELLED") continue;
    for (const rt of res.reservationTables) {
      if (rt.tableId === "T15") continue; // T15 is shared
      if (!tableUsage[rt.tableId]) tableUsage[rt.tableId] = [];
      tableUsage[rt.tableId].push(res.clientName);
    }
  }

  let doubleBooked = false;
  for (const [tableId, guests] of Object.entries(tableUsage)) {
    if (guests.length > 1) {
      console.log(`❌ DOUBLE BOOKING: ${tableId} assigned to: ${guests.join(", ")}`);
      doubleBooked = true;
    }
  }

  if (!doubleBooked) {
    console.log("   ✅ No double bookings detected.");
  }

  // 6. Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${SCENARIOS.length} scenarios`);
  if (integrityFail) console.log("⚠️  INTEGRITY FAILURES DETECTED — existing guests were pushed to overflow!");
  if (doubleBooked) console.log("⚠️  DOUBLE BOOKINGS DETECTED!");
  if (!integrityFail && !doubleBooked && failed === 0) {
    console.log("🎉 ALL TESTS PASSED — System is production-ready for these scenarios.");
  }
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Cleanup
  console.log("🧹 Cleaning up test data...");
  const testIds = allRes.map(r => r.id);
  await prisma.reservationTable.deleteMany({ where: { reservationId: { in: testIds } } });
  await prisma.payment.deleteMany({ where: { reservationId: { in: testIds } } });
  await prisma.auditLog.deleteMany({ where: { reservationId: { in: testIds } } });
  await prisma.reservation.deleteMany({ where: { id: { in: testIds } } });
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
