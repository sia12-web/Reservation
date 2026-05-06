import { useEffect, useRef } from "react";

type InactivityTimerOptions = {
  timeoutSeconds: number;
  onTimeout: () => void;
};

const EVENTS = ["pointerdown", "touchstart", "mousedown", "keydown", "click"];

export function useInactivityTimer({ timeoutSeconds, onTimeout }: InactivityTimerOptions) {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(onTimeout, timeoutSeconds * 1000);
    };

    EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [onTimeout, timeoutSeconds]);
}
