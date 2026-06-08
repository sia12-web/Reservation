import { useMemo } from "react";
import {
  RESTAURANT_TIMEZONE,
  SLOT_INTERVAL_MINUTES,
  generateTimeSlots,
  getRestaurantNow,
  getNextStartSlot,
  getFirstValidSlot,
  roundUpToSlot,
  toRestaurantTime,
  toUtcIso,
} from "../utils/time";

export function useRestaurantTime() {
  return useMemo(
    () => ({
      timezone: RESTAURANT_TIMEZONE,
      slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
      getRestaurantNow,
      getNextStartSlot,
      getFirstValidSlot,
      roundUpToSlot,
      generateTimeSlots,
      toRestaurantTime,
      toUtcIso,
    }),
    []
  );
}
