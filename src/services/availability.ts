import type { PrismaClient, ReservationStatus } from "@prisma/client";
import type Redlock from "redlock";

export interface AvailabilityParams {
  startTime: Date;
  endTime: Date;
  excludeReservationId?: string;
}

export async function checkAvailability(
  prisma: PrismaClient,
  { startTime, endTime, excludeReservationId }: AvailabilityParams
): Promise<string[]> {
  const reservations = await prisma.reservationTable.findMany({
    where: {
      reservationId: excludeReservationId ? { not: excludeReservationId } : undefined,
      reservation: {
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        status: { in: activeReservationStatuses() },
      },
    },
    select: { tableId: true },
  });

  const unavailableIds = [...new Set(reservations.map((row) => row.tableId))];

  // T15 is an "Always Available" / Overflow table. It should never be reported as unavailable.
  return unavailableIds.filter(id => id !== "T15");
}

export async function checkBlackout(
  prisma: PrismaClient,
  { startTime, endTime }: { startTime: Date; endTime: Date }
): Promise<string | null> {
  const blackout = await prisma.blackout.findFirst({
    where: {
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });

  return blackout ? (blackout.reason || "Restaurant is closed during these hours") : null;
}

export interface LockParams {
  tableIds: string[];
  startTime: Date;
  endTime: Date;
  ttlMs: number;
}

export async function acquireTableLocks(
  redlock: Redlock,
  { tableIds, startTime, endTime, ttlMs }: LockParams
) {
  const resources = buildLockKeys(tableIds, startTime, endTime);
  return redlock.acquire(resources, ttlMs);
}

export function buildLockKeys(tableIds: string[], startTime: Date, endTime: Date): string[] {
  const hours = enumerateHourlyBuckets(startTime, endTime);
  const date = startTime.toISOString().slice(0, 10);
  const keys: string[] = [];

  for (const tableId of tableIds) {
    for (const hour of hours) {
      keys.push(`LOCK:TABLE:${tableId}:${date}:${hour}`);
    }
  }

  return keys;
}

function enumerateHourlyBuckets(startTime: Date, endTime: Date): string[] {
  const buckets: string[] = [];
  const cursor = new Date(startTime);

  cursor.setUTCMinutes(0, 0, 0);
  while (cursor < endTime) {
    const hour = cursor.getUTCHours().toString().padStart(2, "0");
    buckets.push(hour);
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }

  return buckets;
}

function activeReservationStatuses(): ReservationStatus[] {
  return ["HOLD", "WAITLIST", "PENDING_DEPOSIT", "CONFIRMED", "CHECKED_IN"];
}
