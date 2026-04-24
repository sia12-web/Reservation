import { stripe } from "../config/stripe";
import { prisma } from "../config/prisma";
import pino from "pino";

const logger = pino();

export async function refundReservationDeposit(reservationId: string, reason?: string) {
    try {
        const payment = await prisma.payment.findFirst({
            where: {
                reservationId,
                status: "SUCCEEDED"
            }
        });

        if (!payment || !payment.providerIntentId) {
            logger.info(`No active Stripe payment found for reservation ${reservationId} to refund.`);
            return;
        }

        logger.info(`Initiating refund for reservation ${reservationId} (Payment: ${payment.providerIntentId}) - Reason: ${reason}`);

        // Check if Stripe is in mock mode (from config/stripe.ts)
        const isMock = (stripe as any).isMock;

        if (isMock) {
            logger.info(`[Mocked] Deposit refund simulated. Internal Reason: ${reason || "N/A"}`);
        } else {
            await stripe.refunds.create({
                payment_intent: payment.providerIntentId,
                reason: "requested_by_customer",
                metadata: {
                   reason: reason || "Admin Cancellation",
                   reservationId: reservationId
                }
            });
            logger.info(`Stripe refund created for ${payment.providerIntentId}`);
        }

        await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "REFUNDED" }
        });

        await prisma.reservation.update({
            where: { id: reservationId },
            data: { depositStatus: "REFUNDED" }
        });

    } catch (error) {
        logger.error({ msg: "Failed to refund deposit", error, reservationId });
        // Don't throw - we might still want to proceed with cancellation but log the failure
    }
}
