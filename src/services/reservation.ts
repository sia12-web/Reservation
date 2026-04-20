import { PrismaClient, ReservationSource, ReservationStatus, DepositStatus } from "@prisma/client";
import { stripe } from "../config/stripe";
import { redlock } from "../config/redis";
import { env } from "../config/env";
import { alignToSlotInterval, calculateDurationMinutes, isWithinBusinessHours, getClosingTime } from "../utils/time";
import { generateShortId } from "../utils/shortId";
import { HttpError } from "../middleware/errorHandler";
import { checkAvailability, checkBlackout } from "./availability";
import { findBestTableAssignment } from "./tableAssignment/engine";
import { TableConfig } from "./tableAssignment/types";
import { trySmartReassignment } from "./reassignment";
import { sendReservationConfirmation, sendDepositRequestEmail } from "./email";
import { notifyNewReservation } from "./telegram";
import { logger } from "../config/logger";

const prisma = new PrismaClient();

export interface CreateReservationOptions {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  partySize: number;
  startTime: Date;
  source?: ReservationSource;
  tableIds?: string[]; // Manual override
  customerNotes?: string;
  internalNotes?: string;
  bypassDeposit?: boolean;
  marketingOptIn?: boolean;
}

export async function createReservation(options: CreateReservationOptions) {
  const { 
    clientName, 
    clientPhone, 
    clientEmail, 
    partySize, 
    startTime, 
    source = "WEB", 
    tableIds: manualTableIds, 
    customerNotes, 
    internalNotes,
    bypassDeposit = false,
    marketingOptIn = false
  } = options;

  // 1. Validations
  if (startTime <= new Date()) {
    throw new HttpError(400, "startTime must be in the future");
  }

  if (!alignToSlotInterval(startTime, 15)) {
    throw new HttpError(400, "startTime must align to 15-minute intervals");
  }

  if (!isWithinBusinessHours(startTime)) {
    throw new HttpError(400, "startTime is outside business hours");
  }

  const durationMinutes = calculateDurationMinutes(partySize);
  let endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

  const closingTime = getClosingTime(startTime);
  const limit = new Date(closingTime.getTime() + 30 * 60_000);
  if (endTime > limit) {
    endTime = closingTime;
  }

  // 2. Distributed Lock
  const dateKey = startTime.toISOString().slice(0, 10);
  const resource = `lock:reservation:${dateKey}`;
  const lock = await redlock.acquire([resource], 35000); // 35s TTL (accounts for Stripe API + reassignment)

  try {
    const blackoutReason = await checkBlackout(prisma, { startTime, endTime });
    if (blackoutReason) throw new HttpError(409, blackoutReason);

    // 3. Setup Layout & Assignment
    const activeLayout = await prisma.layout.findFirst({
      where: { isActive: true },
      include: { tables: true },
    });

    if (!activeLayout) throw new HttpError(500, "Active layout is not configured");

    const tableConfigs: TableConfig[] = activeLayout.tables.map((table) => ({
      id: table.id,
      type: (table.type as TableConfig["type"]) ?? "STANDARD",
      minCapacity: table.minCapacity ?? 1,
      maxCapacity: table.id === "T15" ? 999 : (table.maxCapacity ?? 4),
      priorityScore: table.priorityScore ?? 0,
    }));

    const adjacency = (activeLayout.adjacencyGraph as Record<string, string[]>) ?? {};

    let finalTableIds: string[] = [];
    let moves: { reservationId: string; newTableIds: string[] }[] = [];
    if (manualTableIds && manualTableIds.length > 0) {
      const unavailable = await checkAvailability(prisma, { startTime, endTime });
      const conflictIds = manualTableIds.filter(id => unavailable.includes(id));
      if (conflictIds.length > 0) {
         throw new HttpError(409, `Tables ${conflictIds.join(", ")} are no longer available`);
      }
      finalTableIds = manualTableIds;
    } else {
      const unavailable = await checkAvailability(prisma, { startTime, endTime });
      const available = tableConfigs.map(t => t.id).filter(id => !unavailable.includes(id));

      const assignment = findBestTableAssignment(partySize, available, { tables: tableConfigs, adjacency });

      if (assignment.best && (partySize < 10 || assignment.best.score <= -1000)) {
         finalTableIds = assignment.best.tableIds;
      } else {
         const reassignment = await trySmartReassignment(prisma, {
             newPartySize: partySize,
             startTime,
             endTime,
             layoutId: activeLayout.id,
             allTables: tableConfigs,
             adjacency,
         });

         if (reassignment.canReassign) {
             finalTableIds = reassignment.assignment.tableIds;
             moves = reassignment.moves;
         } else if (assignment.best) {
             finalTableIds = assignment.best.tableIds;
         } else {
             throw new HttpError(409, "No available tables found for the requested time");
         }
      }
    }

    // 4. Status & Deposit Logic
    const shortId = generateShortId();
    let status: ReservationStatus = "CONFIRMED";
    let depositStatus: DepositStatus = "NOT_REQUIRED";

    const isOverflow = finalTableIds.includes("T15");

    if (isOverflow) {
      status = "WAITLIST";
      depositStatus = "NOT_REQUIRED";
    } else if (!bypassDeposit && partySize >= env.depositThreshold) {
      status = "PENDING_DEPOSIT";
      depositStatus = "PENDING";
    }

    let paymentIntent: any = null;
    if (status === "PENDING_DEPOSIT") {
      paymentIntent = await stripe.paymentIntents.create({
        amount: 5000,
        currency: "cad",
        metadata: { shortId, clientName, partySize: String(partySize) },
      });
    }

    // 5. Database Persistence
    return await prisma.$transaction(async (tx) => {
      // Apply shuffle moves
      for (const move of moves) {
        await tx.reservationTable.deleteMany({ where: { reservationId: move.reservationId } });
        await tx.reservationTable.createMany({
          data: move.newTableIds.map((tid, idx) => ({
            reservationId: move.reservationId,
            tableId: tid,
            layoutId: activeLayout.id,
            isPrimary: idx === 0,
          })),
        });
        await (tx as any).auditLog.create({
            data: {
                reservationId: move.reservationId,
                action: "SYSTEM_REASSIGNMENT",
                reason: `Optimized for party size ${partySize}`,
                after: { tableIds: move.newTableIds }
            }
        });
      }

      const reservation = await tx.reservation.create({
        data: {
          shortId,
          clientName,
          clientPhone,
          clientEmail: clientEmail || null,
          partySize,
          startTime,
          endTime,
          status,
          depositStatus,
          source: source as ReservationSource,
          customerNotes: customerNotes || null,
          internalNotes: internalNotes || null,
          marketingOptIn,
        },
      });

      await tx.reservationTable.createMany({
        data: finalTableIds.map((tid, idx) => ({
          reservationId: reservation.id,
          tableId: tid,
          layoutId: activeLayout.id,
          isPrimary: idx === 0,
        })),
      });

      if (paymentIntent) {
        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            provider: "STRIPE",
            providerIntentId: paymentIntent.id,
            amountCents: 5000,
            status: "PROCESSING",
            idempotencyKey: `res:${reservation.id}`,
          },
        });
      }

      // Notifications (Fire and forget inside transaction context)
      const email = reservation.clientEmail;
      if (email) {
          if (status === "CONFIRMED") {
             sendReservationConfirmation({
                 to: email,
                 clientName,
                 clientPhone: reservation.clientPhone,
                 partySize,
                 startTime,
                 shortId,
                 tableIds: finalTableIds
             }).catch(e => logger.error("Email failed", e));
          } else if (status === "PENDING_DEPOSIT") {
             sendDepositRequestEmail({
                to: email,
                clientName,
                startTime,
                shortId,
                partySize,
                tableIds: finalTableIds
             }).catch(e => logger.error("Email failed", e));
          }
      }

      notifyNewReservation({ shortId, clientName, clientPhone: reservation.clientPhone, partySize, startTime, status }).catch(e => logger.error("TG failed", e));

      return {
        reservation,
        tableIds: finalTableIds,
        clientSecret: paymentIntent?.client_secret
      };
    }, { isolationLevel: "Serializable" });

  } finally {
    await lock.release();
  }
}

/**
 * Automatically release tables for guests who started a booking but never completed payment.
 * Runs every minute to keep inventory fresh.
 * Payment window: 30 minutes from reservation creation.
 */
export async function cleanupStaleReservations() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

  const stale = await prisma.reservation.findMany({
    where: {
      status: "PENDING_DEPOSIT",
      createdAt: { lt: cutoff },
    },
    select: { id: true, clientName: true, shortId: true }
  });

  if (stale.length === 0) return 0;

  logger.info(`Cleaning up ${stale.length} abandoned PENDING_DEPOSIT reservations.`);

  await prisma.$transaction(async (tx) => {
    const ids = stale.map(s => s.id);
    
    // 1. Mark as CANCELLED
    await tx.reservation.updateMany({
      where: { id: { in: ids } },
      data: { status: "CANCELLED" }
    });

    // 2. Free tables
    await tx.reservationTable.deleteMany({
      where: { reservationId: { in: ids } }
    });

    // 3. Audit log for each
    for (const res of stale) {
      await tx.auditLog.create({
        data: {
          reservationId: res.id,
          action: "SYSTEM_AUTO_CANCEL",
          reason: "Payment window (30m) expired. Tables released.",
          after: { status: "CANCELLED" }
        }
      });
    }
  });

  return stale.length;
}
