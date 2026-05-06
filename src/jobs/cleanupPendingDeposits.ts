import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../config/prisma";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import { refundReservationDeposit } from "../services/stripe";
import { logger } from "../config/logger";

const connection = new IORedis(env.redisUrl, { 
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy(times) {
    // Retry DNS/connection issues with backoff
    return Math.min(times * 100, 5000);
  }
});

connection.on("error", (err) => {
  // Only log DNS errors as warnings during retry phase to avoid log noise
  if (err.message.includes("EAI_AGAIN")) {
    logger.warn({ err: err.message }, "[ioredis] BullMQ DNS lookup pending (retrying...)");
  } else {
    logger.error({ err: err.message }, "[ioredis] BullMQ connection error");
  }
});

export const cleanupQueue = new Queue("cleanup-pending-deposits", { connection });

export async function scheduleCleanupJob(): Promise<void> {
  await cleanupQueue.add(
    "cleanup",
    {},
    {
      repeat: { every: 60_000 },
      removeOnComplete: true,
      removeOnFail: 10,
    }
  );
}

export function startCleanupWorker(): Worker {
  return new Worker(
    "cleanup-pending-deposits",
    async () => {
      // --- Phase 1: Clean up stale PENDING_DEPOSIT reservations ---
      // Direct reservations: 5-minute window (payment form shown immediately on screen)
      // Promoted waitlist guests: 60-minute window (need time to check email and respond)
      const directCutoff = new Date(Date.now() - 5 * 60_000);
      const promotedCutoff = new Date(Date.now() - 60 * 60_000);

      const stale = await prisma.reservation.findMany({
        where: {
          status: "PENDING_DEPOSIT",
          OR: [
            // Direct reservations: depositRequestedAt is null, check createdAt
            { depositRequestedAt: null, createdAt: { lt: directCutoff } },
            // Promoted waitlist: depositRequestedAt is set, check it with 60m window
            { depositRequestedAt: { not: null, lt: promotedCutoff } },
          ],
        },
        include: { payments: true },
      });

      for (const reservation of stale) {
        for (const payment of reservation.payments) {
          if (payment.providerIntentId && !payment.providerIntentId.startsWith("pending_")) {
            try {
              await stripe.paymentIntents.cancel(payment.providerIntentId);
            } catch (err) {
              logger.warn({ err, intentId: payment.providerIntentId }, "Stripe cancel failed during cleanup (non-blocking)");
            }
          }
        }

        await prisma.$transaction([
          prisma.reservationTable.deleteMany({
            where: { reservationId: reservation.id },
          }),
          prisma.payment.updateMany({
            where: { reservationId: reservation.id },
            data: { status: "FAILED" },
          }),
          prisma.reservation.update({
            where: { id: reservation.id },
            data: { status: "CANCELLED", depositStatus: "NOT_REQUIRED" },
          }),
          prisma.auditLog.create({
            data: {
              reservationId: reservation.id,
              action: "SYSTEM_AUTO_CANCEL",
              reason: reservation.depositRequestedAt
                ? "Payment window (60m) expired. Tables released."
                : "Payment window (5m) expired. Tables released.",
              after: { status: "CANCELLED" },
            },
          }),
        ]);

        // Notify guest that their reservation was auto-cancelled due to unpaid deposit
        if (reservation.clientEmail) {
          const { sendCancellationEmail } = await import("../services/email");
          await sendCancellationEmail({
            to: reservation.clientEmail,
            clientName: reservation.clientName,
            partySize: reservation.partySize,
            startTime: reservation.startTime,
            shortId: reservation.shortId,
            tableIds: [],
            cancellationReason: reservation.depositRequestedAt
              ? "Your reservation was automatically cancelled because the security deposit was not completed within 60 minutes. Please rebook if you'd like to reserve again."
              : "Your reservation was automatically cancelled because the security deposit was not completed within 5 minutes. Please rebook if you'd like to reserve again.",
          }).catch(err => logger.error({ err, shortId: reservation.shortId }, "[Cleanup] Failed to send deposit expiry email"));
        }
      }

      // --- Phase 2: Cleanup stale WAITLIST reservations (startTime passed by 2+ hours with no admin action) ---
      const waitlistCutoff = new Date(Date.now() - 2 * 60 * 60_000);
      const staleWaitlist = await prisma.reservation.findMany({
        where: {
          status: "WAITLIST",
          startTime: { lt: waitlistCutoff },
        },
        select: { id: true, shortId: true, clientName: true, clientEmail: true, partySize: true, startTime: true, reservationTables: { select: { tableId: true } } },
      });

      for (const res of staleWaitlist) {
        await prisma.$transaction([
          prisma.reservationTable.deleteMany({
            where: { reservationId: res.id },
          }),
          prisma.reservation.update({
            where: { id: res.id },
            data: { status: "CANCELLED" },
          }),
          prisma.auditLog.create({
            data: {
              reservationId: res.id,
              action: "SYSTEM_AUTO_CANCEL",
              reason: "Waitlist reservation expired (2h past start time).",
              after: { status: "CANCELLED" },
            },
          }),
        ]);

        if (res.clientEmail) {
          const { sendCancellationEmail } = await import("../services/email");
          await sendCancellationEmail({
            to: res.clientEmail,
            clientName: res.clientName,
            partySize: res.partySize,
            startTime: res.startTime,
            shortId: res.shortId,
            tableIds: res.reservationTables.map(rt => rt.tableId),
            cancellationReason: "System auto-cancelled (no tables became available)",
          });
        }
      }

      // --- Phase 3: Fix #2 — Retry failed refunds ---
      // Find CANCELLED reservations that still have a SUCCEEDED payment (refund was attempted but failed)
      const stuckRefunds = await prisma.reservation.findMany({
        where: {
          status: "CANCELLED",
          depositStatus: "PAID",
          payments: {
            some: { status: "SUCCEEDED" },
          },
        },
        select: { id: true, shortId: true },
      });

      for (const res of stuckRefunds) {
        try {
          await refundReservationDeposit(res.id, "Automated retry: refund failed during cancellation");
          logger.info({ shortId: res.shortId }, "[Cleanup] Retried refund successfully");
        } catch (err) {
          logger.error({ err, shortId: res.shortId }, "[Cleanup] Refund retry failed");
        }
      }
    },
    { connection }
  );
}
