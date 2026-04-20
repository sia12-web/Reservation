import { Router } from "express";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import rateLimit from "express-rate-limit";

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
        await prisma.$transaction(async (tx) => {
          const reservation = await tx.reservation.findFirst({
            where: reservationId ? { id: reservationId } : { shortId },
            include: { reservationTables: { select: { tableId: true } } },
          });

          if (reservation) {
            // CRITICAL: Only confirm if it's actually waiting for a deposit.
            // If an admin already handled it (CANCELLED, CONFIRMED already, etc.), don't overwrite.
            if (reservation.status !== "PENDING_DEPOSIT") {
              console.warn(`[Webhook] Skipping confirmation for reservation ${reservation.id} because status is ${reservation.status}`);
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
              const { sendReservationConfirmation, sendMockStripeReceipt } = await import("../services/email");
              // Note: Email sending is side-effect, but we do it after DB updates succeed in transaction
              sendReservationConfirmation({
                to: reservation.clientEmail,
                clientName: reservation.clientName,
                partySize: reservation.partySize,
                startTime: reservation.startTime,
                shortId: reservation.shortId,
                tableIds,
              }).catch(err => console.error("Webhook Email error:", err));

              // If Stripe is in mock mode, also send the "Official-looking" Stripe receipt email
              if ((stripe as any).isMock) {
                sendMockStripeReceipt({
                  to: reservation.clientEmail,
                  amount: 5000, // Matching the creation amount in reservations.ts
                  shortId: reservation.shortId,
                  paymentId: intent.id
                }).catch(err => console.error("Mock Stripe Receipt error:", err));
              }
            }
          }
        });
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
