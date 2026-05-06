import { Router } from "express";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import rateLimit from "express-rate-limit";
import { logger } from "../config/logger";

const router = Router();

// Rate limit webhook endpoint as defense in depth
// Stripe signature validation is primary protection, but this prevents brute force attempts
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute (Stripe typically sends much less)
  message: { error: "Too many webhook attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/stripe", webhookLimiter, async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    res.status(400).send("Missing Stripe signature");
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      env.stripeWebhookSecret
    );
  } catch (error) {
    res.status(400).send("Invalid Stripe signature");
    return;
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as { id: string; metadata?: Record<string, string> };
      const shortId = intent.metadata?.shortId;

      const payment = await prisma.payment.findFirst({
        where: { providerIntentId: intent.id },
      });

      const reservationId = payment?.reservationId;

      if (reservationId || shortId) {
        // Fix #3: If neither payment record nor reservation found, return 500
        // so Stripe retries the webhook (transaction may not have committed yet).
        let found = false;

        await prisma.$transaction(async (tx) => {
          const reservation = await tx.reservation.findFirst({
            where: reservationId ? { id: reservationId } : { shortId },
            include: { reservationTables: { select: { tableId: true } } },
          });

          if (!reservation) {
            // Reservation not found — could be a race condition
            return; // found stays false
          }

          found = true;

          // Fix #6: If reservation was already cancelled, auto-refund the charge
          if (reservation.status === "CANCELLED" || reservation.status === "NO_SHOW") {
            logger.warn(`[Webhook] Reservation ${reservation.id} is ${reservation.status} but payment succeeded. Initiating auto-refund.`);
            
            // Update payment to SUCCEEDED first so refund logic can find it
            await tx.payment.updateMany({
              where: { providerIntentId: intent.id },
              data: { status: "SUCCEEDED" },
            });

            // Refund will be handled after transaction commits (below)
            return;
          }

          // CRITICAL: Only confirm if it's actually waiting for a deposit.
          // If an admin already handled it (CONFIRMED already, etc.), don't overwrite.
          if (reservation.status !== "PENDING_DEPOSIT") {
            logger.warn(`[Webhook] Skipping confirmation for reservation ${reservation.id} because status is ${reservation.status}`);
            return;
          }

          const tableIds = reservation.reservationTables.map(rt => rt.tableId);

          await tx.payment.updateMany({
            where: { providerIntentId: intent.id },
            data: { status: "SUCCEEDED" },
          });

          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: "CONFIRMED", depositStatus: "PAID" },
          });

          if (reservation.clientEmail) {
            const { sendReservationConfirmation } = await import("../services/email");
            // Note: Email sending is side-effect, but we do it after DB updates succeed in transaction
            sendReservationConfirmation({
              to: reservation.clientEmail,
              clientName: reservation.clientName,
              partySize: reservation.partySize,
              startTime: reservation.startTime,
              shortId: reservation.shortId,
              tableIds,
            }).catch(err => logger.error("Webhook Email error:", err));
          }
        });

        // Fix #3: If reservation not found (race condition), return 500 so Stripe retries
        if (!found) {
          logger.warn(`[Webhook] Reservation not found for intent ${intent.id} / shortId ${shortId}. Returning 500 for Stripe retry.`);
          res.status(500).json({ error: "Reservation not yet available, will retry" });
          return;
        }

        // Fix #6: After transaction, check if we need to refund a cancelled reservation's payment
        if (reservationId || shortId) {
          const reservation = await prisma.reservation.findFirst({
            where: reservationId ? { id: reservationId } : { shortId: shortId! },
          });
          if (reservation && (reservation.status === "CANCELLED" || reservation.status === "NO_SHOW")) {
            const { refundReservationDeposit } = await import("../services/stripe");
            await refundReservationDeposit(reservation.id, `Auto-refund: payment succeeded on ${reservation.status} reservation`);
          }
        }
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as { id: string };
      await prisma.payment.updateMany({
        where: { providerIntentId: intent.id },
        data: { status: "FAILED" },
      });
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});

export default router;
