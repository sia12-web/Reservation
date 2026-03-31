import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";


dayjs.extend(utc);
dayjs.extend(timezone);

const RESTAURANT_TZ = "America/Montreal";

const CLEANUP_BUFFER = 15;

export function calculateDurationMinutes(partySize: number): number {
  let baseDuration = 0;
  if (partySize <= 2) baseDuration = 75;
  else if (partySize <= 4) baseDuration = 90;
  else if (partySize <= 6) baseDuration = 105;
  else if (partySize <= 8) baseDuration = 120;
  else if (partySize <= 10) baseDuration = 135;
  else if (partySize <= 14) baseDuration = 150;
  else baseDuration = 180;

  return baseDuration + CLEANUP_BUFFER;
}

export function alignToSlotInterval(date: Date, intervalMinutes: number): boolean {
  return (
    date.getUTCMinutes() % intervalMinutes === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

export function isWithinBusinessHours(date: Date): boolean {
  const d = dayjs(date).tz(RESTAURANT_TZ);
  const day = d.day(); // 0 is Sunday, 6 is Saturday
  const hour = d.hour();
  const minute = d.minute();
  const timeNum = hour * 100 + minute;

  // Monday-Thursday (1-4) and Sunday (0)
  if (day >= 0 && day <= 4) {
    // 11:30 - 21:45
    return timeNum >= 1130 && timeNum <= 2145;
  }

  // Friday & Saturday (5-6)
  // 11:30 - 22:15
  return timeNum >= 1130 && timeNum <= 2215;
}

export function getClosingTime(date: Date): Date {
  const d = dayjs(date).tz(RESTAURANT_TZ);
  const day = d.day();

  // Closing: 22:00 (Sun-Thu), 23:00 (Fri-Sat)
  let closingHours = 22;
  if (day === 5 || day === 6) {
    closingHours = 23;
  }

  return d.hour(closingHours).minute(0).second(0).millisecond(0).toDate();
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
