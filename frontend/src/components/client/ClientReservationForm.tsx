import { useMemo, useState } from "react";
import { useCreateReservation } from "../../hooks/useCreateReservation";
import { useRestaurantTime } from "../../hooks/useRestaurantTime";
import { normalizePhone } from "../../utils/phone";
import {
  reservationRequestSchema,
} from "../../utils/validation";
import type { FieldErrors, ReservationRequest } from "../../utils/validation";
import PartySizeStepper from "../reservation/PartySizeStepper";
import TimeSlotGrid from "../reservation/TimeSlotGrid";
import PhoneInput from "../reservation/PhoneInput";
import DateChips from "../reservation/DateChips";
import { ApiError } from "../../api/httpClient";
import { addMinutesInRestaurant, toUtcIso } from "../../utils/time";
import clsx from "clsx";
import { useLayout, useAvailability } from "../../hooks/useLayout";
import FloorMap from "../reservation/FloorMap";

type ClientReservationFormProps = {
  onSuccess: (response: unknown) => void;
};

const SLOT_COUNT = 48; // Show slots until closing
const SLOT_PAGE_SIZE = 12;
const TRY_OPTIONS = [15, 30, 45];

export default function ClientReservationForm({ onSuccess }: ClientReservationFormProps) {
  const { generateTimeSlots, getNextStartSlot, getRestaurantNow } = useRestaurantTime();
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [selectedSlot, setSelectedSlot] = useState(() => getNextStartSlot(getRestaurantNow()));
  const [selectedDay, setSelectedDay] = useState(() => selectedSlot.startOf("day"));
  const [slotPage, setSlotPage] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<ReservationRequest | null>(null);
  const [conflictPayload, setConflictPayload] = useState<ReservationRequest | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(false);

  const { data: layout } = useLayout();
  const { data: availability } = useAvailability(
    selectedSlot ? toUtcIso(selectedSlot) : null,
    partySize
  );

  const { mutate, isPending } = useCreateReservation();

  const dayOptions = useMemo(() => {
    const today = getRestaurantNow().startOf("day");
    return Array.from({ length: 14 }, (_, i) => today.add(i, "day"));
  }, [getRestaurantNow]);

  const slots = useMemo(() => {
    const now = getRestaurantNow();
    const dayNoon = selectedDay.hour(12).minute(0).second(0).millisecond(0);
    const fromTime = dayNoon.isAfter(now) ? dayNoon : now;
    const generated = generateTimeSlots(SLOT_COUNT, fromTime);
    if (!selectedSlot) return generated;
    const exists = generated.some((slot) => slot.valueOf() === selectedSlot.valueOf());
    if (exists) return generated;
    return [...generated, selectedSlot].sort((a, b) => a.valueOf() - b.valueOf());
  }, [generateTimeSlots, getRestaurantNow, selectedDay, selectedSlot]);

  const pagedSlots = useMemo(() => {
    const start = slotPage * SLOT_PAGE_SIZE;
    return slots.slice(start, start + SLOT_PAGE_SIZE);
  }, [slotPage, slots]);

  const canPrevSlots = slotPage > 0;
  const canNextSlots = (slotPage + 1) * SLOT_PAGE_SIZE < slots.length;

  const resetForm = () => {
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setSpecialRequests("");
    setPartySize(2);
    setSelectedDay(getRestaurantNow().startOf("day"));
    setSelectedSlot(getNextStartSlot(getRestaurantNow()));
    setSlotPage(0);
    setFieldErrors({});
    setFormError(null);
    setConflictPayload(null);
  };

  const submitPayload = (payload: ReservationRequest) => {
    setPendingPayload(payload);
    mutate(payload, {
      onSuccess: (response) => {
        setFieldErrors({});
        setFormError(null);
        setConflictPayload(null);
        onSuccess(response);
      },
      onError: (error) => {
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/b059efa1-b0a0-4c8f-848d-af5db46f8072", {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "B",
            location: "src/components/client/ClientReservationForm.tsx:submitPayload",
            message: "mutation error",
            data: {
              isApiError: error instanceof ApiError,
              apiStatus: error instanceof ApiError ? error.status : undefined,
              apiIsNetworkError: error instanceof ApiError ? error.isNetworkError : undefined,
              errorName: error instanceof Error ? error.name : typeof error,
              errorMessage: error instanceof Error ? error.message : undefined,
              // no PII: only non-identifying fields
              partySize: payload.partySize,
              source: payload.source,
              startTime: payload.startTime,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => { });
        // #endregion

        if (error instanceof ApiError && error.isNetworkError) {
          setShowNetworkModal(true);
          return;
        }

        if (error instanceof ApiError && error.status === 429) {
          setFormError(error.message);
          return;
        }

        if (error instanceof ApiError && error.status === 409) {
          setConflictPayload(payload);
          setFormError("That time is unavailable. Try another option.");
          return;
        }

        if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
          const nextErrors: FieldErrors = {};
          const details = error.details as Array<{ path?: string[]; message?: string }> | undefined;
          details?.forEach((issue) => {
            const field = issue.path?.[0];
            if (field && typeof field === "string") {
              nextErrors[field as keyof ReservationRequest] = issue.message || "Invalid value";
            }
          });

          if (Object.keys(nextErrors).length === 0) {
            nextErrors.startTime = error.message || "Please choose a different time";
          }

          if (
            error.message?.toLowerCase().includes("starttime") ||
            error.message?.toLowerCase().includes("align") ||
            error.message?.toLowerCase().includes("future")
          ) {
            setSelectedSlot(getNextStartSlot(getRestaurantNow()));
          }

          setFieldErrors(nextErrors);
          setFormError("Please correct the highlighted fields.");
          return;
        }

        if (error instanceof ApiError && error.status && error.status >= 500) {
          setFormError("System unavailable. Please try again.");
          return;
        }

        setFormError("Something went wrong. Please try again.");
      },
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const normalizedPhone = normalizePhone(clientPhone);
    const payload: ReservationRequest = {
      clientName: clientName.trim(),
      clientPhone: normalizedPhone,
      clientEmail: clientEmail.trim(),
      partySize,
      startTime: toUtcIso(selectedSlot),
      source: "WEB",
    };

    const validation = reservationRequestSchema.safeParse(payload);
    if (!validation.success) {
      const nextErrors: FieldErrors = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path?.[0] as keyof ReservationRequest | undefined;
        if (field) {
          nextErrors[field] = issue.message;
        }
      });
      setFieldErrors(nextErrors);
      setFormError("Please correct the highlighted fields.");
      return;
    }

    submitPayload(payload);
  };

  const handleTryMinutes = (minutes: number) => {
    if (!conflictPayload) return;
    const newTime = addMinutesInRestaurant(conflictPayload.startTime, minutes);
    const nextPayload = { ...conflictPayload, startTime: toUtcIso(newTime) };
    submitPayload(nextPayload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
          {formError}
        </div>
      ) : null}

      <label className="block space-y-2">
        <span className="text-base font-medium">Name</span>
        <input
          className="h-12 w-full rounded-md border border-slate-300 px-4 text-base"
          value={clientName}
          onChange={(event) => setClientName(event.target.value)}
          placeholder="Your name"
          autoComplete="name"
        />
        {fieldErrors.clientName ? (
          <span className="text-red-600 text-sm">{fieldErrors.clientName}</span>
        ) : null}
      </label>

      <div className="space-y-2">
        <PhoneInput
          label="Phone"
          value={clientPhone}
          onChange={setClientPhone}
          error={fieldErrors.clientPhone}
        />
        <p className="text-xs text-slate-500">Include country code if outside Canada.</p>
      </div>

      <label className="block space-y-2">
        <span className="text-base font-medium">Email address</span>
        <input
          type="email"
          className="h-12 w-full rounded-md border border-slate-300 px-4 text-base"
          value={clientEmail}
          onChange={(event) => setClientEmail(event.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
        />
        {fieldErrors.clientEmail ? (
          <span className="text-red-600 text-sm">{fieldErrors.clientEmail}</span>
        ) : null}
      </label>

      <div className="space-y-2">
        <span className="text-base font-medium">Party size</span>
        <PartySizeStepper value={partySize} onChange={setPartySize} />
        {fieldErrors.partySize ? (
          <span className="text-red-600 text-sm">{fieldErrors.partySize}</span>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="space-y-2">
          <span className="text-base font-medium">Date of reservation</span>
          <DateChips
            days={dayOptions}
            selectedDay={selectedDay}
            onSelectDay={(day) => {
              const dayStart = day.startOf("day");
              setSelectedDay(dayStart);
              const now = getRestaurantNow();
              const noon = dayStart.hour(12).minute(0).second(0).millisecond(0);
              const fromTime = noon.isAfter(now) ? noon : now;
              setSelectedSlot(getNextStartSlot(fromTime));
              setSlotPage(0);
            }}
            size="client"
          />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-base font-medium">Time</span>
          <span className="text-xs text-slate-500">{selectedSlot.format("ddd MMM D")}</span>
        </div>
        <TimeSlotGrid
          slots={pagedSlots}
          selected={selectedSlot}
          onSelect={(slot) => {
            setSelectedSlot(slot);
            setSelectedDay(slot.startOf("day"));
            const index = slots.findIndex((s) => s.valueOf() === slot.valueOf());
            if (index >= 0) setSlotPage(Math.floor(index / SLOT_PAGE_SIZE));
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="h-11 flex-1 rounded-md border border-slate-300 bg-white text-sm"
            onClick={() => setSlotPage((p) => Math.max(0, p - 1))}
            disabled={!canPrevSlots}
          >
            Earlier
          </button>
          <button
            type="button"
            className="h-11 flex-1 rounded-md border border-slate-300 bg-white text-sm"
            onClick={() => setSlotPage((p) => p + 1)}
            disabled={!canNextSlots}
          >
            Later
          </button>
        </div>
        {fieldErrors.startTime ? (
          <span className="text-red-600 text-sm">{fieldErrors.startTime}</span>
        ) : null}
      </div>

      <label className="block space-y-2">
        <span className="text-base font-medium">Special requests (optional)</span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-4 py-3 text-base min-h-[96px]"
          value={specialRequests}
          onChange={(event) => setSpecialRequests(event.target.value)}
          placeholder="Allergies, seating preferences, etc."
          autoComplete="off"
        />
        <p className="text-xs text-slate-500">Not sent to the reservation system yet.</p>
      </label>

      {/* Floor Map Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-base font-medium">Select a table (Optional)</span>
          <button
            type="button"
            className="text-sm text-blue-600 font-medium"
            onClick={() => setShowMap(!showMap)}
          >
            {showMap ? "Hide Map" : "Show Map"}
          </button>
        </div>

        {showMap && layout ? (
          <div className="space-y-2">
            <FloorMap
              layout={layout}
              unavailableTableIds={availability?.unavailableTableIds}
              selectedTableIds={selectedTableIds}
              onSelectTable={(id) => {
                setSelectedTableIds((prev) =>
                  prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
                );
              }}
            />
            <p className="text-xs text-slate-500">
              Click tables to select/deselect. Green = Available, Gray = Taken.
            </p>
          </div>
        ) : null}
      </div>

      {conflictPayload ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm text-slate-700">Time not available. Try another option:</p>
          <div className="grid grid-cols-3 gap-2">
            {TRY_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className="h-11 rounded-md bg-slate-900 text-white text-sm"
                onClick={() => handleTryMinutes(minutes)}
                disabled={isPending}
              >
                Try +{minutes} min
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Or pick a different time above.</p>
        </div>
      ) : null}

      <button
        type="submit"
        className={clsx(
          "h-12 w-full rounded-md text-base font-semibold",
          isPending ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white"
        )}
        disabled={isPending}
      >
        {isPending ? "Creating reservation..." : "Request reservation"}
      </button>

      {showNetworkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-semibold">Connection unstable</h2>
            <p className="text-slate-600">
              Reservation may or may not have been created. Do not retry blindly.
            </p>
            <div className="grid gap-3">
              <button
                type="button"
                className="h-11 rounded-md bg-slate-900 text-white text-base"
                onClick={() => {
                  setShowNetworkModal(false);
                  if (pendingPayload) submitPayload(pendingPayload);
                }}
              >
                Retry anyway
              </button>
              <button
                type="button"
                className="h-11 rounded-md bg-slate-100 text-slate-700 text-base"
                onClick={() => {
                  setShowNetworkModal(false);
                  resetForm();
                }}
              >
                Start over
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
