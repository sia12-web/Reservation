import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const layout = await prisma.layout.findFirst({
    where: { isActive: true },
    include: { tables: true },
  });

  if (!layout) {
    console.log("No active layout found");
    return;
  }

  console.log(`Active Layout: ${layout.name} (${layout.id})`);
  console.log("Tables:");
  layout.tables.forEach((t) => {
    console.log(`- ${t.id}: type=${t.type}, min=${t.minCapacity}, max=${t.maxCapacity}, priority=${t.priorityScore}`);
  });

  const reservations = await prisma.reservation.findMany({
    where: {
      startTime: { lt: new Date("2026-04-27T15:30:00Z") },
      endTime: { gt: new Date("2026-04-27T13:15:00Z") },
      status: { in: ["HOLD", "WAITLIST", "PENDING_DEPOSIT", "CONFIRMED", "CHECKED_IN"] },
    },
    include: {
      reservationTables: true,
    },
  });

  console.log("\nReservations for 2026-04-27 13:15 - 15:30:");
  reservations.forEach((r) => {
    console.log(`- ${r.clientName} (party size ${r.partySize}, status ${r.status}, tables: ${r.reservationTables.map(rt => rt.tableId).join(", ")})`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
