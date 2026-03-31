import { Router, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../middleware/errorHandler";
import { adminAuth } from "../middleware/auth";
import { z } from "zod";
import { getStartAndEndOfDay, parseSafeDate } from "../utils/time";
import { checkAvailability } from "../services/availability";
import { redlock } from "../config/redis";
import rateLimit from "express-rate-limit";
import { maskPII } from "../utils/masking";
import { createReservation } from "../services/reservation";
import { sendLateWarning, sendCancellationEmail } from "../services/email";
import { logger } from "../config/logger";
import { refundReservationDeposit } from "../services/stripe";
import { Prisma, ReservationStatus, ReservationSource } from "@prisma/client";

const router = Router();

const adminActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  message: { error: "Too many admin actions, please slow down" },
});

router.use(adminActionLimiter);
router.use(adminAuth);

// --- Admin Reservation Routes ---

const listQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.string().optional(),
  tableId: z.string().optional(),
  phone: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  waitlistOnly: z.coerce.boolean().optional().default(false),
});

router.get(
  "/reservations",
  asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const where: Prisma.ReservationWhereInput = {};

    if (query.from || query.to) {
      where.startTime = {};
      if (query.from) {
        const d = parseSafeDate(query.from);
        if (d) where.startTime.gte = d;
      }
      if (query.to) {
        const d = parseSafeDate(query.to);
        if (d) where.startTime.lte = d;
      }
      if (Object.keys(where.startTime).length === 0) delete where.startTime;
    }

    if (query.waitlistOnly) {
       // Global view of overflow ignoring date window
       where.startTime = { gte: new Date() }; // Only future
       where.status = { in: ["CONFIRMED", "PENDING_DEPOSIT", "HOLD", "CHECKED_IN"] };
       where.reservationTables = { some: { tableId: "T15" } };
    } else {
        if (query.status) {
          const validStatuses: ReservationStatus[] = ["HOLD", "PENDING_DEPOSIT", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"];
          const requested = query.status.split(",")
            .map(s => s.trim() as ReservationStatus)
            .filter(s => validStatuses.includes(s));
          
          if (requested.length > 0) {
            where.status = requested.length > 1 ? { in: requested } : requested[0];
          }
        }
        if (query.tableId) where.reservationTables = { some: { tableId: query.tableId } };
    }

    if (query.phone) where.clientPhone = { contains: query.phone };

    const reservations = await prisma.reservation.findMany({
      where,
      take: query.limit,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: { startTime: "asc" },
      include: { reservationTables: true },
    });

    res.json(reservations.map((r) => ({
      id: r.id,
      shortId: r.shortId,
      clientName: r.clientName,
      clientPhone: r.clientPhone,
      clientEmail: r.clientEmail,
      partySize: r.partySize,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      depositStatus: r.depositStatus,
      source: r.source,
      customerNotes: r.customerNotes,
      internalNotes: r.internalNotes,
      lateWarningSent: r.lateWarningSent,
      freedAt: r.freedAt,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
      tableIds: r.reservationTables.map((rt) => rt.tableId),
    })));
  })
);

router.get(
  "/reservations/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id as string },
      include: { reservationTables: true, payments: true },
    });

    if (!reservation) throw new HttpError(404, "Reservation not found");

    res.json({
      id: reservation.id,
      shortId: reservation.shortId,
      clientName: reservation.clientName,
      clientPhone: reservation.clientPhone,
      clientEmail: reservation.clientEmail,
      partySize: reservation.partySize,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      status: reservation.status,
      depositStatus: reservation.depositStatus,
      source: reservation.source,
      customerNotes: reservation.customerNotes,
      internalNotes: reservation.internalNotes,
      lateWarningSent: reservation.lateWarningSent,
      freedAt: reservation.freedAt,
      completedAt: reservation.completedAt,
      createdAt: reservation.createdAt,
      payments: reservation.payments.map(p => ({
        id: p.id,
        amountCents: p.amountCents,
        status: p.status,
        provider: p.provider,
        providerIntentId: p.providerIntentId,
      })),
      tableIds: reservation.reservationTables.map((rt) => rt.tableId),
    });
  })
);

const createManualSchema = z.object({
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
  clientEmail: z.string().email().optional().or(z.literal("")),
  partySize: z.number().int().min(1).max(50),
  startTime: z.string().datetime().or(z.string()),
  internalNotes: z.string().optional(),
  customerNotes: z.string().optional(),
  source: z.enum(["PHONE", "KIOSK", "WALK_IN", "WEB"]).default("PHONE"),
});

router.post(
  "/reservations",
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createManualSchema.parse(req.body);
    const startTime = parseSafeDate(payload.startTime);
    if (!startTime) throw new HttpError(400, "Invalid startTime");

    const { reservation, tableIds } = await createReservation({
      ...payload,
      startTime,
      bypassDeposit: true,
      source: payload.source as ReservationSource,
    });

    res.status(201).json({
      id: reservation.id,
      shortId: reservation.shortId,
      status: reservation.status,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      tableIds
    });
  })
);

const reassignSchema = z.object({
  newTableIds: z.array(z.string()).min(1),
  reason: z.string().min(1),
});

router.post(
  "/reservations/:id/reassign",
  asyncHandler(async (req: Request, res: Response) => {
    const reservationId = req.params.id as string;
    const { newTableIds, reason } = reassignSchema.parse(req.body);

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { reservationTables: true },
    });

    if (!reservation) throw new HttpError(404, "Reservation not found");

    const activeLayout = await prisma.layout.findFirst({
      where: { isActive: true },
      include: { tables: true },
    });

    if (!activeLayout) throw new HttpError(500, "Active layout not configured");

    const lock = await redlock.acquire([`lock:availability:${reservation.startTime.toISOString()}`], 5000);
    try {
      const unavailable = await checkAvailability(prisma, {
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        excludeReservationId: reservationId
      });

      const conflictIds = newTableIds.filter(tid => unavailable.includes(tid));
      if (conflictIds.length > 0) {
        throw new HttpError(409, `Tables ${conflictIds.join(", ")} are occupied.`);
      }

      const tableConfigs = activeLayout.tables.map(t => ({ id: t.id, maxCapacity: t.maxCapacity }));
      const totalCapacity = newTableIds.reduce((sum, tid) => sum + (tableConfigs.find(tc => tc.id === tid)?.maxCapacity || 0), 0);

      if (totalCapacity < reservation.partySize) {
        throw new HttpError(400, `Capacity ${totalCapacity} < party ${reservation.partySize}`);
      }

      await prisma.$transaction(async (tx) => {
        const beforeTableIds = reservation.reservationTables.map((rt) => rt.tableId);
        await tx.reservationTable.deleteMany({ where: { reservationId } });
        await tx.reservationTable.createMany({
          data: newTableIds.map((tid, idx) => ({
            reservationId,
            tableId: tid,
            layoutId: activeLayout.id,
            isPrimary: idx === 0,
          })),
        });

        await tx.auditLog.create({
          data: {
            reservationId,
            action: "TABLES_REASSIGNED",
            before: maskPII({ tableIds: beforeTableIds, reservation }) as Prisma.JsonObject,
            after: { tableIds: newTableIds } as Prisma.JsonObject,
            reason,
          },
        });
      });

      res.json({ message: "Tables reassigned", newTableIds });
    } finally {
      await lock.release();
    }
  })
);

router.post(
  "/reservations/:id/cancel",
  asyncHandler(async (req: Request, res: Response) => {
    const reservationId = req.params.id as string;
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const reservation = await prisma.reservation.findUnique({ 
      where: { id: reservationId },
      include: { reservationTables: true }
    });
    if (!reservation) throw new HttpError(404, "Reservation not found");
    
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({ where: { id: reservationId }, data: { status: "CANCELLED" } });
      await tx.reservationTable.deleteMany({ where: { reservationId } });
      await tx.auditLog.create({
        data: {
          reservationId,
          action: "RESERVATION_CANCELLED",
          before: maskPII(reservation) as Prisma.JsonObject,
          after: { status: "CANCELLED" } as Prisma.JsonObject,
          reason,
        },
      });
    });

    await refundReservationDeposit(reservationId, reason);

    // Notify guest
    if (reservation.clientEmail) {
        await sendCancellationEmail({
            to: reservation.clientEmail,
            clientName: reservation.clientName,
            partySize: reservation.partySize,
            startTime: reservation.startTime,
            shortId: reservation.shortId,
            tableIds: reservation.reservationTables.map(rt => rt.tableId),
            isOverflow: reservation.reservationTables.some(rt => rt.tableId === 'T15'),
            cancellationReason: reason
        }).catch(err => logger.error("Cancellation email failed", err));
    }

    res.json({ message: "Cancelled successfully" });
  })
);

router.post(
  "/reservations/:id/late-warning",
  asyncHandler(async (req: Request, res: Response) => {
    const reservationId = req.params.id as string;
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { reservationTables: true }
    });

    if (!reservation) throw new HttpError(404, "Not found");
    if (reservation.lateWarningSent) throw new HttpError(409, "Warning already sent");

    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({ where: { id: reservationId }, data: { lateWarningSent: true } });
      await tx.auditLog.create({
        data: { 
          reservationId, 
          action: "LATE_WARNING_SENT", 
          reason: "Admin prompt", 
          before: maskPII(reservation) as Prisma.JsonObject 
        },
      });
    });

    await sendLateWarning({
      to: reservation.clientEmail || "",
      clientName: reservation.clientName,
      partySize: reservation.partySize,
      startTime: reservation.startTime,
      shortId: reservation.shortId,
      tableIds: reservation.reservationTables.map((rt) => rt.tableId)
    });

    res.json({ message: "Email sent" });
  })
);

// --- Floor & Table Management ---

const floorQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  date: z.string().optional(),
});

router.get(
  "/floor",
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const query = floorQuerySchema.parse(req.query);

    let startTime: Date;
    let endTime: Date;

    if (query.date) {
      const { start, end } = getStartAndEndOfDay(query.date);
      startTime = start;
      endTime = end;
    } else {
      startTime = parseSafeDate(query.from) || new Date(now.getTime() - 15 * 60000);
      endTime = parseSafeDate(query.to) || new Date(now.getTime() + 4 * 3600000);
    }

    const layout = await prisma.layout.findFirst({
      where: { isActive: true },
      include: { tables: true },
    });

    if (!layout) throw new HttpError(500, "No active layout found");

    const reservations = await prisma.reservation.findMany({
      where: {
        OR: [
          { startTime: { lt: endTime }, endTime: { gt: startTime } },
          { status: "CHECKED_IN", startTime: { lt: endTime } }
        ],
        status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
      },
      include: { reservationTables: true },
    });

    const occupancyMap: Record<string, any[]> = {};
    reservations.forEach((r) => {
      r.reservationTables.forEach((rt) => {
        if (!occupancyMap[rt.tableId]) occupancyMap[rt.tableId] = [];
        occupancyMap[rt.tableId].push({
          id: r.id, status: r.status, shortId: r.shortId,
          startTime: r.startTime, endTime: r.endTime, partySize: r.partySize,
          clientName: r.clientName, lateWarningSent: r.lateWarningSent, depositStatus: r.depositStatus
        });
      });
    });

    const tables = layout.tables.map((t) => {
      const tableReservations = occupancyMap[t.id] || [];
      let status = "AVAILABLE";
      if (tableReservations.length > 0) {
        const isActiveNow = tableReservations.some(r =>
          ['CONFIRMED', 'CHECKED_IN'].includes(r.status) &&
          ((new Date(r.startTime) <= now && new Date(r.endTime) >= now) || r.status === 'CHECKED_IN')
        );
        if (isActiveNow) {
          status = "OCCUPIED";
        } else if (tableReservations.some(r => ['CONFIRMED', 'PENDING_DEPOSIT', 'HOLD'].includes(r.status) && new Date(r.startTime) > now)) {
          status = "RESERVED";
        }
      }
      return {
        id: t.id,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        shape: t.shape as any,
        minCapacity: t.minCapacity,
        maxCapacity: t.maxCapacity,
        priorityScore: t.priorityScore,
        type: t.type as any,
        status, 
        reservations: tableReservations.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
          .map(r => ({
            id: r.id,
            status: r.status,
            shortId: r.shortId,
            startTime: r.startTime,
            endTime: r.endTime,
            partySize: r.partySize,
            clientName: r.clientName,
            lateWarningSent: r.lateWarningSent,
            depositStatus: r.depositStatus
          }))
      };
    });

    res.json({ layoutId: layout.id, tables });
  })
);

router.post(
  "/tables/:tableId/free",
  asyncHandler(async (req: Request, res: Response) => {
    const tableId = req.params.tableId as string;
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const now = new Date();

    const activeTable = await prisma.reservationTable.findFirst({
      where: {
        tableId,
        reservation: {
          status: { in: ["CONFIRMED", "CHECKED_IN", "PENDING_DEPOSIT", "HOLD"] },
          OR: [{ startTime: { lte: now } }, { status: "CHECKED_IN" }]
        },
      },
      include: { reservation: true },
      orderBy: { reservation: { startTime: "asc" } }
    });

    if (!activeTable) throw new HttpError(409, "Table is not occupied");

    const reservation = activeTable.reservation;
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "COMPLETED", endTime: now, freedAt: now, completedAt: now },
      });
      await tx.auditLog.create({
        data: {
          reservationId: reservation.id, tableId, action: "TABLE_FREED",
          before: maskPII({ status: reservation.status, endTime: reservation.endTime, reservation }) as Prisma.JsonObject,
          after: { status: "COMPLETED", endTime: now.toISOString() } as Prisma.JsonObject,
          reason: reason || "Admin freed table",
        },
      });
    });

    await refundReservationDeposit(reservation.id);
    res.json({ message: `Table ${tableId} freed` });
  })
);

// --- Utilities & Debug (Gated) ---

router.get("/ping", (_req, res) => res.json({ pong: true }));

router.get("/debug/force-seed", asyncHandler(async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") throw new HttpError(403, "Seed disabled");
  if (await prisma.table.count() > 0) { res.json({ message: "Already seeded" }); return; }

  const layout = await prisma.layout.create({
    data: {
      name: "Main Dining Room", isActive: true,
      adjacencyGraph: { T1: ["T2"], T2: ["T1", "T3"], T3: ["T2"], T4: ["T5"], T5: ["T4", "T6"], T6: ["T5"], T7: ["T8"], T8: ["T7"], T9: ["T10"], T10: ["T9", "T11"], T11: ["T10", "T12"], T12: ["T11", "T13"], T13: ["T12", "T14"], T14: ["T13"] } as Prisma.JsonObject,
      effectiveDate: new Date(),
    }
  });

  const tables = [
    { id: "T1", x: 280, y: 480, width: 120, height: 70, shape: "RECTANGLE", minCapacity: 2, maxCapacity: 4, type: "STANDARD", priorityScore: 1 },
    { id: "T2", x: 440, y: 480, width: 120, height: 70, shape: "RECTANGLE", minCapacity: 2, maxCapacity: 4, type: "STANDARD", priorityScore: 1 },
    { id: "T3", x: 600, y: 480, width: 120, height: 70, shape: "RECTANGLE", minCapacity: 2, maxCapacity: 4, type: "STANDARD", priorityScore: 1 },
    { id: "T15", x: 830, y: 450, width: 120, height: 70, shape: "RECTANGLE", minCapacity: 1, maxCapacity: 20, type: "STANDARD", priorityScore: 0 },
    { id: "T7", x: 50, y: 400, width: 120, height: 70, shape: "RECTANGLE", minCapacity: 2, maxCapacity: 4, type: "STANDARD", priorityScore: 1 },
    { id: "T8", x: 50, y: 300, width: 120, height: 70, shape: "RECTANGLE", minCapacity: 2, maxCapacity: 4, type: "STANDARD", priorityScore: 1 },
    { id: "T6", x: 350, y: 330, width: 90, height: 90, shape: "CIRCLE", minCapacity: 4, maxCapacity: 7, type: "CIRCULAR", priorityScore: 2 },
    { id: "T5", x: 500, y: 320, width: 70, height: 110, shape: "RECTANGLE", minCapacity: 2, maxCapacity: 4, type: "STANDARD", priorityScore: 1 },
    { id: "T4", x: 650, y: 330, width: 90, height: 90, shape: "CIRCLE", minCapacity: 4, maxCapacity: 7, type: "CIRCULAR", priorityScore: 2 },
    { id: "T14", x: 830, y: 320, width: 120, height: 70, shape: "RECTANGLE", minCapacity: 2, maxCapacity: 4, type: "STANDARD", priorityScore: 1 },
    { id: "T9", x: 50, y: 50, width: 120, height: 150, shape: "RECTANGLE", minCapacity: 6, maxCapacity: 12, type: "MERGED_FIXED", priorityScore: 3 },
    { id: "T10", x: 220, y: 80, width: 70, height: 110, shape: "RECTANGLE", minCapacity: 2, maxCapacity: 4, type: "STANDARD", priorityScore: 1 },
    { id: "T11", x: 350, y: 80, width: 220, height: 70, shape: "RECTANGLE", minCapacity: 8, maxCapacity: 12, type: "MERGED_FIXED", priorityScore: 3 },
    { id: "T12", x: 650, y: 80, width: 70, height: 110, shape: "RECTANGLE", minCapacity: 2, maxCapacity: 4, type: "STANDARD", priorityScore: 1 },
    { id: "T13", x: 800, y: 50, width: 120, height: 150, shape: "RECTANGLE", minCapacity: 6, maxCapacity: 12, type: "MERGED_FIXED", priorityScore: 3 },
  ];

  for (const t of tables) {
    await prisma.table.create({ data: { ...t, layoutId: layout.id, type: t.type as any } });
  }

  res.json({ message: "Seeded" });
}));

router.post("/debug/reset-reservations", asyncHandler(async (req: Request, res: Response) => {
  if (req.body.confirmCode !== "CONFIRM_RESET") throw new HttpError(400, "Wrong code");
  await prisma.reservationTable.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.auditLog.deleteMany({});
  const count = await prisma.reservation.deleteMany({});
  res.json({ message: `Reset ${count.count} reservations` });
}));

// --- Blackout Management ---

router.get(
  "/blackouts",
  asyncHandler(async (_req: Request, res: Response) => {
    const { start } = getStartAndEndOfDay(new Date().toISOString());
    // @ts-ignore - Temporary cast until dev server restart releases Prisma lock
    const blackouts = await (prisma as any).blackout.findMany({
      orderBy: { startTime: "asc" },
      where: {
        endTime: { gte: start } // Show all blackouts today and future
      }
    });
    res.json(blackouts);
  })
);

const blackoutSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  reason: z.string().optional(),
});

router.post(
  "/blackouts",
  asyncHandler(async (req: Request, res: Response) => {
    const data = blackoutSchema.parse(req.body);
    // @ts-ignore - Temporary cast until dev server restart releases Prisma lock
    const blackout = await (prisma as any).blackout.create({
      data: {
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        reason: data.reason
      }
    });

    // Logging the creation
    // @ts-ignore - Temporary cast until dev server restart releases Prisma lock
    await (prisma as any).auditLog.create({
      data: {
        action: "BLACKOUT_CREATED",
        after: blackout as any,
        reason: data.reason || "Manual restaurant closure",
      },
    });

    res.status(201).json(blackout);
  })
);

router.delete(
  "/blackouts/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    // @ts-ignore - Temporary cast until dev server restart releases Prisma lock
    const existing = await (prisma as any).blackout.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Blackout not found");

    // @ts-ignore - Temporary cast until dev server restart releases Prisma lock
    await (prisma as any).blackout.delete({ where: { id } });

    // Logging the deletion
    // @ts-ignore - Temporary cast until dev server restart releases Prisma lock
    await (prisma as any).auditLog.create({
      data: {
        action: "BLACKOUT_DELETED",
        before: existing as any,
        reason: "Manual removal by administrator",
      },
    });

    res.json({ message: "Blackout deleted" });
  })
);

export default router;
