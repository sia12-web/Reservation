import { ReservationSource, ReservationStatus, DepositStatus } from "@prisma/client";
import { stripe } from "../config/stripe";
import { redlock } from "../config/redis";
import { env } from "../config/env";
import { alignToSlotInterval, calculateDurationMinutes, isWithinBusinessHours, getClosingTime, validateMinimumDuration } from "../utils/time";
import { generateShortId } from "../utils/shortId";
import { HttpError } from "../middleware/errorHandler";
import { checkAvailability, checkBlackout, acquireTableLocks } from "./availability";
import { findBestTableAssignment } from "./tableAssignment/engine";
import { TableConfig } from "./tableAssignment/types";
import { trySmartReassignment } from "./reassignment";
import { sendReservationConfirmation, sendDepositRequestEmail } from "./email";
import { logger } from "../config/logger";

import { prisma } from "../config/prisma";

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
  // Allow walk-ins to start "now"
  const isWalkin = source === "WALK_IN";
  if (!isWalkin && startTime <= new Date()) {
    throw new HttpError(400, "startTime must be in the future");
  }

  // Fix #15: Max booking horizon
  const maxFutureMs = env.maxBookingDays * 24 * 60 * 60 * 1000;
  if (startTime.getTime() - Date.now() > maxFutureMs) {
    throw new HttpError(400, `Reservations can only be made up to ${env.maxBookingDays} days in advance`);
  }

  if (!isWalkin && !alignToSlotInterval(startTime, 15)) {
    throw new HttpError(400, "startTime must align to 15-minute intervals");
  }

  if (!isWalkin && !isWithinBusinessHours(startTime)) {
    throw new HttpError(400, "startTime is outside business hours");
  }

  const durationMinutes = calculateDurationMinutes(partySize);
  let endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

  const closingTime = getClosingTime(startTime);
  const limit = new Date(closingTime.getTime() + 30 * 60_000);
  if (endTime > limit) {
    endTime = closingTime;
  }

  // Fix #5: Validate minimum serviceable duration after clamping
  const durationError = !isWalkin ? validateMinimumDuration(startTime, endTime) : null;
  if (durationError) {
    throw new HttpError(400, durationError);
  }

  // 2. Compute table assignment (without lock — optimistic phase)
  const blackoutReason = await checkBlackout(prisma, { startTime, endTime });
  if (blackoutReason) throw new HttpError(409, blackoutReason);

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
           // No tables available even after reassignment — fall back to waitlist
           finalTableIds = ["T15"];
       }
    }
  }

  // 3. Acquire fine-grained distributed locks for the specific tables + time buckets
  // Collect ALL tables involved (assigned + tables being moved by reassignment)
  const allInvolvedTableIds = [
    ...finalTableIds,
    ...moves.flatMap(m => m.newTableIds),
  ];
  const lock = await acquireTableLocks(redlock, {
    tableIds: [...new Set(allInvolvedTableIds)],
    startTime,
    endTime,
    ttlMs: 15000, // 15s TTL (sufficient for DB transaction + Stripe call)
  });

  try {
    // Re-verify availability inside the lock to catch concurrent reservations
    // that may have committed between our optimistic check and lock acquisition
    if (!manualTableIds || manualTableIds.length === 0) {
      const movingReservationIds = moves.map(m => m.reservationId);
      const recheck = await checkAvailability(prisma, { 
        startTime, 
        endTime, 
        excludeReservationId: movingReservationIds.length > 0 ? movingReservationIds : undefined 
      });
      const allIntendedTableIds = [
        ...finalTableIds,
        ...moves.flatMap(m => m.newTableIds)
      ];
      const conflicting = allIntendedTableIds.filter(id => recheck.includes(id));
      if (conflicting.length > 0) {
        // Tables were taken between our optimistic check and lock acquisition.
        // Re-run assignment with updated availability instead of rejecting the guest.
        logger.warn({ msg: "Race condition: re-running assignment inside lock", conflicting });
        const freshAvailable = tableConfigs.map(t => t.id).filter(id => !recheck.includes(id));
        const retry = findBestTableAssignment(partySize, freshAvailable, { tables: tableConfigs, adjacency });

        if (retry.best && (partySize < 10 || retry.best.score <= -1000)) {
          finalTableIds = retry.best.tableIds;
          moves = []; // Clear any stale reassignment moves
        } else {
          // No tables available at all — fall back to waitlist (T15)
          finalTableIds = ["T15"];
          moves = [];
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

    // 5. Database Persistence
    // Fix #3: Create reservation + payment record FIRST, then create Stripe intent.
    // This prevents the webhook race condition where Stripe fires before our DB commits.
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

      // Create payment record inside transaction (placeholder intent ID)
      // so the webhook can always find it, even if it arrives before this tx commits.
      let paymentRecordId: string | null = null;
      if (status === "PENDING_DEPOSIT") {
        const placeholderIntentId = `pending_${reservation.id}`;
        const created = await tx.payment.create({
          data: {
            reservationId: reservation.id,
            provider: "STRIPE",
            providerIntentId: placeholderIntentId,
            amountCents: 5000,
            status: "PROCESSING",
            idempotencyKey: `res:${reservation.id}`,
          },
        });
        paymentRecordId = created.id;

        // Track when deposit was requested for timeout calculation
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { depositRequestedAt: new Date() },
        });
      }

      // Notifications (Fire and forget inside transaction context)
      const email = reservation.clientEmail;
      if (email) {
          if (status === "CONFIRMED" || status === "WAITLIST") {
             sendReservationConfirmation({
                 to: email,
                 clientName,
                 clientPhone: reservation.clientPhone,
                 partySize,
                 startTime,
                 shortId,
                 tableIds: finalTableIds,
                 status, // Pass status so email template knows WAITLIST vs CONFIRMED
             }).catch(e => logger.error("Email failed", e));
          }
          // Note: deposit email is sent AFTER Stripe intent is created (below)
      }

      return {
        reservation,
        tableIds: finalTableIds,
        paymentRecordId,
        clientSecret: null as string | null, // Will be set after Stripe intent creation
      };
    }, { isolationLevel: "Serializable" })
    .then(async (result) => {
      // Fix #3: Create Stripe intent AFTER transaction commits, then update the payment record.
      // This ensures the reservation + payment record exist before any webhook can fire.
      if (status === "PENDING_DEPOSIT" && result.paymentRecordId) {
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: 5000,
            currency: "cad",
            metadata: { shortId: result.reservation.shortId, clientName, partySize: String(partySize) },
          });

          // Update payment record with real Stripe intent ID
          await prisma.payment.update({
            where: { id: result.paymentRecordId },
            data: { providerIntentId: paymentIntent.id },
          });

          result.clientSecret = paymentIntent.client_secret;

          // Send deposit email now that we have the client secret
          const email = result.reservation.clientEmail;
          if (email) {
            sendDepositRequestEmail({
              to: email,
              clientName,
              startTime,
              shortId: result.reservation.shortId,
              partySize,
              tableIds: result.tableIds,
            }).catch(e => logger.error("Email failed", e));
          }
        } catch (stripeError) {
          // Stripe failed after DB committed — mark reservation as needing attention
          logger.error({ msg: "Stripe intent creation failed after reservation commit", error: stripeError, reservationId: result.reservation.id });
          // Cancel the reservation since we can't collect payment
          await prisma.reservation.update({
            where: { id: result.reservation.id },
            data: { status: "CANCELLED", depositStatus: "NOT_REQUIRED" },
          });
          await prisma.reservationTable.deleteMany({
            where: { reservationId: result.reservation.id },
          });
          throw new HttpError(502, "Payment processing unavailable. Please try again.");
        }
      }

      // Remove internal field from response
      const { paymentRecordId: _, ...response } = result;
      return response;
    });

  } finally {
    await lock.release();
  }
}
