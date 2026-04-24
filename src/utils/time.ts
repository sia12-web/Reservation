import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";


dayjs.extend(utc);
dayjs.extend(timezone);

const RESTAURANT_TZ = "America/Montreal";

const CLEANUP_BUFFER = 15;
const MINIMUM_SERVICEABLE_MINUTES = 45;

export function calculateDurationMinutes(partySize: number): number {
  // Stay duration rules:
  // - Less than 10 guests: 75 minutes stay
  // - 10 or more guests: 120 minutes stay (2 hours)
  // Plus CLEANUP_BUFFER for the total slot length.

  const baseDuration = partySize < 10 ? 75 : 120;
  return baseDuration + CLEANUP_BUFFER;
}

export function alignToSlotInterval(date: Date, intervalMinutes: number): boolean {
  // Fix #12: Use restaurant timezone minutes instead of UTC to avoid
  // coincidental correctness that would break with non-15 intervals
  const d = dayjs(date).tz(RESTAURANT_TZ);
  return (
    d.minute() % intervalMinutes === 0 &&
    d.second() === 0 &&
    d.millisecond() === 0
  );
}

export function isWithinBusinessHours(date: Date): boolean {
  const d = dayjs(date).tz(RESTAURANT_TZ);
  const day = d.day(); // 0 is Sunday, 6 is Saturday
  const hour = d.hour();
  const minute = d.minute();
  const timeNum = hour * 100 + minute;

  // Monday-Thursday (1-4) and Sunday (0)
  // Open: 11:30, Close: 22:00 (10 PM)
  // Last bookable: 90 min before close = 20:30 (8:30 PM)
  if (day >= 0 && day <= 4) {
    return timeNum >= 1130 && timeNum <= 2030;
  }

  // Friday & Saturday (5-6)
  // Open: 11:30, Close: 22:30 (10:30 PM)
  // Last bookable: 90 min before close = 21:00 (9:00 PM)
  return timeNum >= 1130 && timeNum <= 2100;
}

export function getClosingTime(date: Date): Date {
  const d = dayjs(date).tz(RESTAURANT_TZ);
  const day = d.day();

  // Closing: 22:00 (Sun-Thu), 22:30 (Fri-Sat)
  let closingHour = 22;
  let closingMinute = 0;

  if (day === 5 || day === 6) {
    closingHour = 22;
    closingMinute = 30;
  }

  return d.hour(closingHour).minute(closingMinute).second(0).millisecond(0).toDate();
}

/**
 * Fix #5: Validate that the clamped endTime still leaves enough serviceable duration.
 * Returns null if valid, or an error message string if the slot is too short.
 */
export function validateMinimumDuration(startTime: Date, endTime: Date): string | null {
  const effectiveMinutes = (endTime.getTime() - startTime.getTime()) / 60_000;
  if (effectiveMinutes < MINIMUM_SERVICEABLE_MINUTES) {
    return `This time slot is too close to closing. Only ${Math.round(effectiveMinutes)} minutes available, minimum is ${MINIMUM_SERVICEABLE_MINUTES}.`;
  }
  return null;
}

export function parseSafeDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  const d = dayjs(dateStr);
  if (!d.isValid()) return null;

  // Logical check for extreme dates (e.g., year 0 or far future)
  const year = d.year();
  if (year < 2020 || year > 2100) return null;

  return d.toDate();
}

export function getStartAndEndOfDay(date: string): { start: Date; end: Date } {
  // Parse directly in the timezone to keep "2026-02-05" as Feb 5th Montreal time
  // instead of Feb 5th UTC converted to Montreal (which becomes Feb 4th)
  let d = date ? (dayjs as any).tz(date, RESTAURANT_TZ) : (dayjs as any)().tz(RESTAURANT_TZ);

  return {
    start: d.startOf("day").toDate(),
    end: d.endOf("day").toDate(),
  };
}
