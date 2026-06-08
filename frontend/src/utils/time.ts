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

const DAY_START_HOUR = 11; // 11:00 AM to allow 11:30 AM opening slots

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
  // If rounding lands before 11:00 AM, clamp forward to 11:00 AM of that same day.
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

  // Monday-Thursday (1-4): 4:00 PM - 10:00 PM
  // Last bookable: 90 min before close = 20:30 (8:30 PM)
  if (day >= 1 && day <= 4) {
    return timeNum >= 1600 && timeNum <= 2030;
  }

  // Friday & Saturday (5-6): 11:30 AM - 10:30 PM
  // Last bookable: 90 min before close = 21:00 (9:00 PM)
  if (day === 5 || day === 6) {
    return timeNum >= 1130 && timeNum <= 2100;
  }

  // Sunday (0): 11:30 AM - 10:00 PM
  // Last bookable: 90 min before close = 20:30 (8:30 PM)
  return timeNum >= 1130 && timeNum <= 2030;
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

export function getFirstValidSlot(
  fromTime: Dayjs = getRestaurantNow(),
  intervalMinutes = SLOT_INTERVAL_MINUTES
): Dayjs {
  const generated = generateTimeSlots(1, fromTime, intervalMinutes);
  return generated.length > 0 ? generated[0] : getNextStartSlot(fromTime, intervalMinutes);
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
