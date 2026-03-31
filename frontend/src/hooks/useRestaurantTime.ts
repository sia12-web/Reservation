import { useMemo } from "react";
import {
  RESTAURANT_TIMEZONE,
  SLOT_INTERVAL_MINUTES,
  generateTimeSlots,
  getRestaurantNow,
  getNextStartSlot,
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
      roundUpToSlot,
      generateTimeSlots,
      toRestaurantTime,
      toUtcIso,
    }),
    []
  );
}
