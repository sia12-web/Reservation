import { stripe } from "../config/stripe";
import { prisma } from "../config/prisma";
import pino from "pino";

const logger = pino();

export async function refundReservationDeposit(reservationId: string, reason?: string) {
    try {
        // Fix: Use a transaction to atomically "claim" the refund and prevent double-refunds
        const payment = await prisma.$transaction(async (tx) => {
            const p = await tx.payment.findFirst({
                where: {
                    reservationId,
                    status: "SUCCEEDED"
                }
            });

            if (!p || !p.providerIntentId) return null;

            // Mark as REFUNDED immediately in the DB to "lock" it
            // If Stripe fails, the cleanup job will catch it or we'll log it
            await tx.payment.update({
                where: { id: p.id },
                data: { status: "REFUNDED" }
            });

            return p;
        });

        if (!payment) {
            logger.info(`No refundable Stripe payment found for reservation ${reservationId}.`);
            return;
        }

        logger.info(`Initiating refund for reservation ${reservationId} (Payment: ${payment.providerIntentId})`);

        const isMock = (stripe as any).isMock;
        if (isMock) {
            logger.info(`[Mocked] Deposit refund simulated.`);
        } else {
            await stripe.refunds.create({
                payment_intent: payment.providerIntentId,
                amount: 4800, // Refund $48.00 (keep $2.00 for Stripe fees)
                reason: "requested_by_customer",
                metadata: {
                   reason: reason || "Admin Cancellation",
                   reservationId: reservationId,
                   feeDeducted: "200"
                }
            });
            logger.info(`Stripe refund created for ${payment.providerIntentId}`);
        }

        await prisma.reservation.update({
            where: { id: reservationId },
            data: { depositStatus: "REFUNDED" }
        });

    } catch (error) {
        logger.error({ msg: "Failed to refund deposit", error, reservationId });
        // Optional: Reset status to SUCCEEDED if you want to allow immediate retries, 
        // but marking it as REFUNDED + logging is safer for financial integrity.
    }
}
