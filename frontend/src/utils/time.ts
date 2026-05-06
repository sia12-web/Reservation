import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const RESTAURANT_TIMEZONE =
  import.meta.env.VITE_RESTAURANT_TIMEZONE || "America/Montreal";

export const SLOT_INTERVAL_MINUTES = Number(
  import.meta.env.VITE_SLOT_INTERVAL_MINUTES || 15
);

const DAY_START_HOUR = 12; // 12:00 PM

export function getRestaurantNow(): Dayjs {
  return dayjs().tz(RESTAURANT_TIMEZONE);
}

function clampToDayStart(time: Dayjs): Dayjs {
  if (time.hour() < DAY_START_HOUR) {
    return time.hour(DAY_START_HOUR).minute(0).second(0).millisecond(0);
  }
  return time;
}

export function roundUpToSlot(time: Dayjs, intervalMinutes = SLOT_INTERVAL_MINUTES): Dayjs {
  const minute = time.minute();
  const remainder = minute % intervalMinutes;
  const base = time.second(0).millisecond(0);

  if (remainder === 0 && time.second() === 0) {
    return base.add(intervalMinutes, "minute");
  }

  const diff = intervalMinutes - remainder;
  return base.add(diff, "minute");
}

export function getNextStartSlot(
  fromTime: Dayjs = getRestaurantNow(),
  intervalMinutes = SLOT_INTERVAL_MINUTES
): Dayjs {
  const rounded = roundUpToSlot(fromTime, intervalMinutes);
  // If rounding lands before 12:00 PM (e.g., 11:50 PM -> 12:00 AM next day),
  // clamp forward to 12:00 PM of that same day.
  if (rounded.hour() < DAY_START_HOUR) {
    return rounded.hour(DAY_START_HOUR).minute(0).second(0).millisecond(0);
  }
  return clampToDayStart(rounded);
}

export function isWithinBusinessHours(time: Dayjs): boolean {
  const day = time.day(); // 0 is Sunday, 6 is Saturday
  const hour = time.hour();
  const minute = time.minute();
  const timeNum = hour * 100 + minute;

  // Monday-Thursday (1-4) and Sunday (0)
  if (day >= 0 && day <= 4) {
    // 12:00 - 21:45
    return timeNum >= 1200 && timeNum <= 2145;
  }

  // Friday & Saturday (5-6)
  // 12:00 - 22:15
  return timeNum >= 1200 && timeNum <= 2215;
}

export function generateTimeSlots(
  count: number = 48, // Default to a large number to show many slots
  fromTime: Dayjs = getRestaurantNow(),
  intervalMinutes = SLOT_INTERVAL_MINUTES
): Dayjs[] {
  const start = getNextStartSlot(fromTime, intervalMinutes);
  const slots: Dayjs[] = [];
  let i = 0;

  // Search up to 24 hours ahead (96 slots of 15 min) or until we have enough
  while (slots.length < count && i < 96) {
    const slot = start.add(i * intervalMinutes, "minute");
    if (isWithinBusinessHours(slot)) {
      slots.push(slot);
    } else if (slots.length > 0) {
      // Hit closing time after finding some slots
      break;
    }
    i++;
  }

  return slots;
}

export function toUtcIso(time: Dayjs): string {
  if (!time || !time.isValid()) return "";
  return time.utc().toISOString();
}

export function toRestaurantTime(iso: string): Dayjs {
  return dayjs(iso).tz(RESTAURANT_TIMEZONE);
}

export function addMinutesInRestaurant(iso: string, minutes: number): Dayjs {
  return toRestaurantTime(iso).add(minutes, "minute");
}

export function parseInRestaurantTime(date: string, time: string): Dayjs {
  return dayjs.tz(`${date} ${time}`, RESTAURANT_TIMEZONE);
}

export function formatTime(time: Dayjs): string {
  return time.format("h:mm A");
}

export function formatTimeWindow(startIso: string, endIso: string): string {
  const start = toRestaurantTime(startIso);
  const end = toRestaurantTime(endIso);
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatDateTimeWindow(startIso: string, endIso: string): string {
  const start = toRestaurantTime(startIso);
  const end = toRestaurantTime(endIso);
  const startLabel = start.format("ddd MMM D, h:mm A");
  const endLabel = end.format("h:mm A");
  return `${startLabel} - ${endLabel}`;
}
