import { Router } from "express";
import { z } from "zod";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import { asyncHandler } from "../utils/asyncHandler";
import { calculateDurationMinutes, isWithinBusinessHours, getClosingTime, parseSafeDate, validateMinimumDuration } from "../utils/time";
import { HttpError } from "../middleware/errorHandler";
import { checkAvailability, checkBlackout } from "../services/availability";
import { findBestTableAssignment } from "../services/tableAssignment/engine";
import { TableConfig } from "../services/tableAssignment/types";
import { createReservation } from "../services/reservation";
import { prisma } from "../config/prisma";
import rateLimit from "express-rate-limit";
import { logger } from "../config/logger";
import { maskPII } from "../utils/masking";

const router = Router();

// --- Validation Schemas ---

function isEmojiOnly(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return /^\p{Extended_Pictographic}+$/u.test(trimmed);
}

export const reservationSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .refine((value) => !isEmojiOnly(value), "Name must not be emoji-only"),
  clientPhone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format"),
  clientEmail: z.string().email().optional().or(z.literal("")),
  partySize: z.number().int().min(1).max(50),
  startTime: z.string().datetime(),
  source: z.enum(["WEB", "KIOSK", "PHONE"]).optional(),
  tableIds: z.array(z.string()).optional(), // Manual override
  customerNotes: z.string().max(500).optional(),
  marketingOptIn: z.boolean().optional().default(false),
});

// --- Rate Limiters ---

const reservationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many reservations created, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const cancellationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: "Too many cancellation attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicLookupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: { error: "Too many lookup attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Protect availability checking (light query but needs limiting)
const availabilityLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 requests per 5 minutes
  message: { error: "Too many availability checks, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Protect slots endpoint (heavy computational operation)
const slotsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // 30 requests per 10 minutes (more restrictive due to heavy computation)
  message: { error: "Too many slot queries, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Protect demo bypass endpoint (even though disabled in production)
const demoBypassLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many demo bypass attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Public Routes ---

/**
 * Guest reservation creation
 */
router.post(
  "/reservations",
  reservationsLimiter,
  asyncHandler(async (req, res) => {
    const payload = reservationSchema.parse(req.body);
    const startTime = parseSafeDate(payload.startTime);

    if (!startTime) {
      throw new HttpError(400, "Invalid startTime provided");
    }

    const { reservation, tableIds, clientSecret } = await createReservation({
      ...payload,
      startTime,
      source: payload.source as any,
    });

    res.status(201).json({
      reservationId: reservation.id,
      shortId: reservation.shortId,
      status: reservation.status,
      source: reservation.source,
      tableIds,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      clientSecret,
      clientEmail: reservation.clientEmail,
      clientPhone: reservation.clientPhone,
      stripePublishableKey: env.stripePublishableKey,
    });
  })
);

/**
 * Check table availability for a specific time and party size
 */
router.get(
  "/availability",
  availabilityLimiter,
  asyncHandler(async (req, res) => {
    const { startTime: startTimeStr, partySize: partySizeStr } = req.query;

    if (!startTimeStr || !partySizeStr) {
      throw new HttpError(400, "Missing startTime or partySize");
    }

    const startTime = parseSafeDate(startTimeStr as string);
    const partySize = Number(partySizeStr);

    if (!startTime || Number.isNaN(partySize)) {
      throw new HttpError(400, "Invalid parameters");
    }

    const durationMinutes = calculateDurationMinutes(partySize);
    let endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

    const closingTime = getClosingTime(startTime);
    const limit = new Date(closingTime.getTime() + 30 * 60_000);
    if (endTime > limit) {
      endTime = closingTime;
    }

    // Fix #5: Check minimum serviceable duration
    const durationError = validateMinimumDuration(startTime, endTime);
    if (durationError) {
      res.json({ unavailableTableIds: [], blackoutReason: durationError });
      return;
    }

    const blackoutReason = await checkBlackout(prisma, { startTime, endTime });
    const unavailable = await checkAvailability(prisma, { startTime, endTime });

    res.json({
      unavailableTableIds: unavailable,
      blackoutReason,
    });
  })
);

/**
 * Find available time slots for a specific date
 */
router.get(
  "/slots",
  slotsLimiter,
  asyncHandler(async (req, res) => {
    const { date: dateStr, partySize: partySizeStr } = req.query;

    if (!dateStr || !partySizeStr) {
      throw new HttpError(400, "Missing date or partySize");
    }

    const dayStart = parseSafeDate(dateStr as string);
    const partySize = Number(partySizeStr);

    if (!dayStart || Number.isNaN(partySize)) {
      throw new HttpError(400, "Invalid parameters");
    }

    const startOfDay = new Date(dayStart);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const activeLayout = await prisma.layout.findFirst({
      where: { isActive: true },
      include: { tables: true },
    });

    if (!activeLayout) {
      throw new HttpError(500, "Active layout is not configured");
    }

    const reservations = await prisma.reservationTable.findMany({
      where: {
        reservation: {
          status: { in: ["HOLD", "WAITLIST", "PENDING_DEPOSIT", "CONFIRMED", "CHECKED_IN"] },
          endTime: { gt: startOfDay },
          startTime: { lt: endOfDay },
        },
      },
      select: {
        tableId: true,
        reservation: {
          select: { startTime: true, endTime: true },
        },
      },
    });

    const tableConfigs: TableConfig[] = activeLayout.tables.map((table) => ({
      id: table.id,
      type: (table.type as TableConfig["type"]) ?? "STANDARD",
      minCapacity: table.minCapacity ?? 1,
      maxCapacity: table.maxCapacity ?? 4,
      priorityScore: table.priorityScore ?? 0,
    }));

    const adjacency = (activeLayout.adjacencyGraph as Record<string, string[]>) ?? {};

    const results: { time: string; available: boolean; reason?: string }[] = [];
    const cursor = new Date(startOfDay);
    cursor.setUTCHours(11, 0, 0, 0); 

    while (cursor < endOfDay) {
      if (isWithinBusinessHours(cursor)) {
        const slotStart = new Date(cursor);
        const durationMinutes = calculateDurationMinutes(partySize);
        let slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

        const closingTime = getClosingTime(slotStart);
        const limit = new Date(closingTime.getTime() + 30 * 60_000);
        if (slotEnd > limit) {
          slotEnd = closingTime;
        }

        const busyTableIds = new Set<string>();
        for (const r of reservations) {
          if (slotStart < r.reservation.endTime && slotEnd > r.reservation.startTime) {
            busyTableIds.add(r.tableId);
          }
        }

        const availableTableIds = tableConfigs
          .map(t => t.id)
          .filter(id => !busyTableIds.has(id));

        const assignment = findBestTableAssignment(partySize, availableTableIds, {
          tables: tableConfigs,
          adjacency,
        });

        const blackoutReason = await checkBlackout(prisma, { startTime: slotStart, endTime: slotEnd });

        results.push({
          time: slotStart.toISOString(),
          available: !blackoutReason && !!assignment.best,
          reason: blackoutReason || undefined
        });
      }
      cursor.setMinutes(cursor.getMinutes() + 15);
    }

    res.json({ slots: results });
  })
);

/**
 * Public reservation lookup (for guest management links)
 */
router.get(
  "/reservations/:shortId",
  publicLookupLimiter,
  asyncHandler(async (req, res) => {
    const shortId = req.params.shortId as string;

    const reservation = await prisma.reservation.findUnique({
      where: { shortId },
      include: {
        reservationTables: {
          select: {
            tableId: true,
          },
        },
        payments: {
          where: { status: "PROCESSING", provider: "STRIPE" },
          orderBy: { id: "desc" },
          take: 1
        }
      },
    });

    if (!reservation) {
      throw new HttpError(404, "Reservation not found");
    }

    let clientSecret: string | null = null;
    if (reservation.status === "PENDING_DEPOSIT" && reservation.payments.length > 0) {
        try {
            const pi = await stripe.paymentIntents.retrieve(reservation.payments[0].providerIntentId);
            clientSecret = pi.client_secret;
        } catch (error) {
            logger.warn({ error }, `Failed to retrieve client_secret for intent ${reservation.payments[0].providerIntentId}`);
        }
    }

    res.json({
        id: reservation.id, // Include ID for demo payment bypass
        shortId: reservation.shortId,
        clientName: reservation.clientName,
        clientPhone: reservation.clientPhone,
        clientEmail: reservation.clientEmail,
        partySize: reservation.partySize,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        status: reservation.status,
        source: reservation.source,
        depositStatus: reservation.depositStatus,
        reservationTables: reservation.reservationTables,
        clientSecret,
        customerNotes: reservation.customerNotes,
        stripePublishableKey: env.stripePublishableKey,
    });
  })
);

/**
 * Public cancellation
 * Fix #10: Requires shortId + clientPhone for verification to prevent UUID-guessing attacks
 */
router.post(
  "/reservations/:shortId/cancel",
  cancellationLimiter,
  asyncHandler(async (req, res) => {
    const shortId = req.params.shortId as string;
    const { reason, clientPhone } = req.body;

    if (!clientPhone) {
      throw new HttpError(400, "Phone number is required to cancel a reservation");
    }

    const reservation = await prisma.reservation.findUnique({
      where: { shortId },
    });

    if (!reservation) {
      throw new HttpError(404, "Reservation not found");
    }

    // Verify identity via phone number
    if (reservation.clientPhone !== clientPhone) {
      throw new HttpError(403, "Phone number does not match this reservation");
    }

    const cancellable = ["HOLD", "WAITLIST", "PENDING_DEPOSIT", "CONFIRMED"];
    if (!cancellable.includes(reservation.status)) {
      throw new HttpError(400, `Cannot cancel a ${reservation.status} reservation`);
    }

    const id = reservation.id;

    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: { status: "CANCELLED", version: { increment: 1 } },
      });

      await tx.reservationTable.deleteMany({
        where: { reservationId: id },
      });

      await (tx as any).auditLog.create({
        data: {
          reservationId: id,
          action: "RESERVATION_CANCELLED_BY_USER",
          before: maskPII(reservation),
          after: { status: "CANCELLED" },
          reason: reason || "User cancelled via management link",
        },
      });
    });

    const { refundReservationDeposit } = await import("../services/stripe");
    await refundReservationDeposit(id);

    if (reservation.clientEmail) {
      const { sendCancellationEmail } = await import("../services/email");
      await sendCancellationEmail({
        to: reservation.clientEmail,
        clientName: reservation.clientName,
        partySize: reservation.partySize,
        startTime: reservation.startTime,
        shortId: reservation.shortId,
        tableIds: [], // We deleted them above, but we only need to know if it's overflow
        // If it was a WAITLIST reservation, we pass T15 so the email template formats correctly
        cancellationReason: reason || "User cancelled via management link",
        isOverflow: reservation.status === "WAITLIST"
      }).catch(err => logger.error("Cancellation email failed", err));
    }

    res.json({ message: "Reservation cancelled successfully" });
  })
);

/**
 * Demo bypass for Stripe payment
 */
router.post(
  "/reservations/:id/confirm-payment-demo",
  demoBypassLimiter,
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    // Removed production guard so user can test the payment bypass
    // if (process.env.NODE_ENV === "production") {
    //   throw new HttpError(403, "Demo bypass is disabled in production");
    // }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { reservationTables: { select: { tableId: true } } },
    });

    if (!reservation) {
      throw new HttpError(404, "Reservation not found");
    }

    if (reservation.status !== "PENDING_DEPOSIT") {
      throw new HttpError(400, "Can only confirm payment for reservations pending deposit");
    }

    const tableIds = reservation.reservationTables.map(rt => rt.tableId);

    await prisma.$transaction(async (tx) => {
      // Update reservation status
      await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED", depositStatus: "PAID" },
      });

      // Update any processing payments to SUCCEEDED
      await tx.payment.updateMany({
        where: { reservationId: id, status: "PROCESSING" },
        data: { status: "SUCCEEDED" },
      });

      // Audit Log
      await (tx as any).auditLog.create({
        data: {
          reservationId: id,
          action: "RESERVATION_CONFIRMED_DEMO_BYPASS",
          before: maskPII(reservation),
          after: { status: "CONFIRMED", depositStatus: "PAID" },
          reason: "Demo bypass used",
        },
      });
    });

    // Send confirmation email
    if (reservation.clientEmail) {
      const { sendReservationConfirmation } = await import("../services/email");
      sendReservationConfirmation({
        to: reservation.clientEmail,
        clientName: reservation.clientName,
        partySize: reservation.partySize,
        startTime: reservation.startTime,
        shortId: reservation.shortId,
        tableIds,
      }).catch(err => logger.error("Demo Bypass Email error:", err));
    }

    res.json({ message: "Payment bypassed and reservation confirmed" });
  })
);

export function deriveDepositState(partySize: number) {
  const depositThreshold = 10;
  return partySize >= depositThreshold
    ? { status: "PENDING_DEPOSIT", depositStatus: "PENDING" }
    : { status: "CONFIRMED", depositStatus: "NOT_REQUIRED" };
}

export default router;
