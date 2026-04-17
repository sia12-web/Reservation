import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../config/prisma";
import { stripe } from "../config/stripe";
import { env } from "../config/env";

const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
connection.on("error", (err) => {
  console.error("[ioredis] BullMQ connection error:", err.message);
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
      const cutoff = new Date(Date.now() - 15 * 60_000);
      const stale = await prisma.reservation.findMany({
        where: {
          status: "PENDING_DEPOSIT",
          createdAt: { lt: cutoff },
        },
        include: { payments: true },
      });

      for (const reservation of stale) {
        for (const payment of reservation.payments) {
          if (payment.providerIntentId) {
            try {
              await stripe.paymentIntents.cancel(payment.providerIntentId);
            } catch {
              // ignore Stripe cancel errors to avoid blocking cleanup
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
        ]);
      }

      // Cleanup stale WAITLIST reservations (startTime passed by 2+ hours with no admin action)
      const waitlistCutoff = new Date(Date.now() - 2 * 60 * 60_000);
      const staleWaitlist = await prisma.reservation.findMany({
        where: {
          status: "WAITLIST",
          startTime: { lt: waitlistCutoff },
        },
        select: { id: true, shortId: true, clientName: true },
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
        ]);
      }
    },
    { connection }
  );
}
