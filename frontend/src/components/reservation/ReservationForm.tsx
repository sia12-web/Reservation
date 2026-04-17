import { useEffect, useMemo, useState } from "react";
import { useCreateReservation } from "../../hooks/useCreateReservation";
import { useRestaurantTime } from "../../hooks/useRestaurantTime";
import { normalizePhone } from "../../utils/phone";
import { reservationRequestSchema } from "../../utils/validation";
import type { FieldErrors, ReservationRequest } from "../../utils/validation";
import PartySizeStepper from "./PartySizeStepper";
import TimeSlotGrid from "./TimeSlotGrid";
import PhoneInput from "./PhoneInput";
import CalendarSelector from "./CalendarSelector";
import FloorMap from "./FloorMap";
import { useLayout, useAvailability } from "../../hooks/useLayout";
import { ApiError } from "../../api/httpClient";

import { useKioskReset } from "../kiosk/InactivityGuard";
import clsx from "clsx";
import { ShieldAlert } from "lucide-react";

export type ReservationDraft = {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  specialRequests?: string;
  partySize: number;
  startTime: string;
};

type ReservationFormProps = {
  defaultValues?: Partial<ReservationDraft>;
  onSuccess: (response: unknown) => void;
};



const SLOT_COUNT = 48; // generated pool; UI shows a smaller window at a time
const SLOT_PAGE_SIZE = 24;

export default function ReservationForm({
  defaultValues,
  onSuccess,
}: ReservationFormProps) {
  const { resetKiosk } = useKioskReset();
  const { generateTimeSlots, getNextStartSlot, getRestaurantNow, toRestaurantTime, toUtcIso } =
    useRestaurantTime();

  const [clientName, setClientName] = useState(defaultValues?.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(defaultValues?.clientPhone ?? "");
  const [clientEmail, setClientEmail] = useState(defaultValues?.clientEmail ?? "");
  const [specialRequests, setSpecialRequests] = useState(defaultValues?.specialRequests ?? "");
  const [partySize, setPartySize] = useState(defaultValues?.partySize ?? 1);
  const [selectedSlot, setSelectedSlot] = useState(() => {
    if (defaultValues?.startTime) {
      return toRestaurantTime(defaultValues.startTime);
    }
    return getNextStartSlot(getRestaurantNow());
  });
  const [selectedDay, setSelectedDay] = useState(() => selectedSlot.startOf("day"));
  const [slotPage, setSlotPage] = useState(0);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<ReservationRequest | null>(null);

  const { data: layoutData } = useLayout();
  // Valid start time string for availability check
  const availabilityTime = selectedSlot ? toUtcIso(selectedSlot) : null;
  const { data: availabilityData } = useAvailability(availabilityTime, partySize);

  // Reset table selection when time/day or party size changes
  useEffect(() => {
    setSelectedTableIds([]);
    setFormError(null);
  }, [selectedSlot, partySize]);

  const { mutate, isPending } = useCreateReservation();

  useEffect(() => {
    if (defaultValues?.startTime) {
      const t = toRestaurantTime(defaultValues.startTime);
      setSelectedSlot(t);
      setSelectedDay(t.startOf("day"));
    }
  }, [defaultValues?.startTime, toRestaurantTime]);

  useEffect(() => {
    setSelectedDay(selectedSlot.startOf("day"));
  }, [selectedSlot]);


  const quickDates = useMemo(() => {
    const today = getRestaurantNow().startOf("day");
    const tomorrow = today.add(1, "day");

    const getNextDay = (targetDayNum: number) => {
      let d = today.day(targetDayNum);
      // If today is targetDay or after, move to next week
      if (d.isBefore(today, "day") || d.isSame(today, "day")) {
        d = d.add(1, "week");
      }
      return d;
    };

    const nextFri = getNextDay(5);
    const nextSat = getNextDay(6);
    const nextSun = getNextDay(0);

    return [
      { label: "Today", date: today },
      { label: "Tomorrow", date: tomorrow },
      { label: "Next Fri", date: nextFri },
      { label: "Next Sat", date: nextSat },
      { label: "Next Sun", date: nextSun },
    ].filter((item, index, self) =>
      index === self.findIndex((t) => t.date.isSame(item.date, "day"))
    );
  }, [getRestaurantNow]);

  const slots = useMemo(() => {
    const now = getRestaurantNow();
    const dayNoon = selectedDay.hour(12).minute(0).second(0).millisecond(0);
    const fromTime = dayNoon.isAfter(now) ? dayNoon : now;
    const generated = generateTimeSlots(SLOT_COUNT, fromTime);
    if (!selectedSlot) return generated;
    const exists = generated.some((slot) => slot.valueOf() === selectedSlot.valueOf());
    if (exists) return generated;
    const merged = [...generated, selectedSlot].sort((a, b) => a.valueOf() - b.valueOf());
    return merged;
  }, [generateTimeSlots, getRestaurantNow, selectedDay, selectedSlot]);

  useEffect(() => {
    const index = slots.findIndex((slot) => slot.valueOf() === selectedSlot.valueOf());
    if (index >= 0) {
      setSlotPage(Math.floor(index / SLOT_PAGE_SIZE));
    }
  }, [selectedSlot, slots]);

  const pagedSlots = useMemo(() => {
    const start = slotPage * SLOT_PAGE_SIZE;
    return slots.slice(start, start + SLOT_PAGE_SIZE);
  }, [slotPage, slots]);

  const canPrevSlots = slotPage > 0;
  const canNextSlots = (slotPage + 1) * SLOT_PAGE_SIZE < slots.length;

  const submitPayload = (payload: ReservationRequest) => {
    setPendingPayload(payload);
    mutate(payload, {
      onSuccess: (data: any) => {
        setFormError(null);
        setFieldErrors({});
        
        // No longer showing immediate popup. Guest will pay via email link.
        onSuccess(data);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.isNetworkError) {
          setShowNetworkModal(true);
          return;
        }

        if (error instanceof ApiError && error.status === 429) {
          setFormError(error.message);
          return;
        }

        if (error instanceof ApiError && error.status === 409) {
          // Tables are strictly booked, but we should retry or refresh
          setFormError(error.message || "Tables are no longer available. Please select another slot.");
          return;
        }

        if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
          const nextErrors: FieldErrors = {};
          const details = error.details;
          if (Array.isArray(details)) {
              (details as any[]).forEach((issue) => {
                  const field = issue.path?.[0];
                  if (field && typeof field === "string") {
                      nextErrors[field as keyof ReservationRequest] = issue.message || "Invalid value";
                  }
              });
          }

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

    if (!selectedSlot) {
      setFieldErrors({ startTime: "Please select a time." });
      return;
    }

    const normalizedPhone = normalizePhone(clientPhone);
    const payload: ReservationRequest = {
      clientName: clientName.trim(),
      clientPhone: normalizedPhone,
      clientEmail: clientEmail.trim(),
      partySize,
      startTime: toUtcIso(selectedSlot),
      source: "KIOSK",
      tableIds: selectedTableIds.length > 0 ? selectedTableIds : undefined,
      customerNotes: specialRequests.trim() || undefined,
      marketingOptIn,
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
      return;
    }

    submitPayload(payload);
  };

  const handleRetry = () => {
    if (pendingPayload) {
      setShowNetworkModal(false);
      submitPayload(pendingPayload);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>


      <div className="grid gap-6 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-lg font-medium text-slate-700">Name</span>
          <input
            className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            value={clientName}
            onChange={(event) => {
              setClientName(event.target.value);
              if (fieldErrors.clientName) {
                setFieldErrors(prev => {
                  const n = { ...prev };
                  delete n.clientName;
                  return n;
                });
              }
            }}
            placeholder="Guest name"
            autoComplete="off"
          />
          {fieldErrors.clientName ? (
            <span className="text-red-600 text-sm">{fieldErrors.clientName}</span>
          ) : null}
        </label>

        <div className="space-y-2">
          <PhoneInput
            label="Phone"
            value={clientPhone}
            onChange={(val) => {
              setClientPhone(val);
              if (fieldErrors.clientPhone) {
                setFieldErrors(prev => {
                  const n = { ...prev };
                  delete n.clientPhone;
                  return n;
                });
              }
            }}
            error={fieldErrors.clientPhone}
          />
        </div>

        <label className="block space-y-2">
          <span className="text-lg font-medium text-slate-700">Email</span>
          <input
            type="email"
            className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            value={clientEmail}
            onChange={(event) => setClientEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="off"
          />
          {fieldErrors.clientEmail ? (
            <p className="text-red-600 text-sm mt-1">{fieldErrors.clientEmail}</p>
          ) : null}
        </label>

        <div className="space-y-2">
          <span className="text-lg font-medium text-slate-700">Party Size</span>
          <div className="flex flex-col gap-2">
            <PartySizeStepper value={partySize} onChange={setPartySize} max={32} />
            {partySize >= 32 && (
              <p className="text-amber-700 text-sm font-medium bg-amber-50 p-2 rounded-lg border border-amber-100 italic">
                For groups larger than 32, please call us to arrange seating.
              </p>
            )}
          </div>
          {fieldErrors.partySize ? (
            <span className="text-red-600 text-sm">{fieldErrors.partySize}</span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8">
        <div className="space-y-2">
          <span className="text-lg font-medium">Quick Dates</span>
          <div className="flex flex-wrap gap-2">
            {quickDates.map((item) => {
              const isSelected = selectedDay.isSame(item.date, "day");
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setSelectedDay(item.date.startOf("day"));
                    const now = getRestaurantNow();
                    const noon = item.date.hour(12).minute(0).second(0).millisecond(0);
                    const fromTime = noon.isAfter(now) ? noon : now;
                    const next = getNextStartSlot(fromTime);
                    setSelectedSlot(next);
                  }}
                  className={clsx(
                    "px-4 h-10 rounded-md border text-sm font-medium transition-all whitespace-nowrap",
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                  )}
                >
                  {item.label}{" "}
                  <span className="opacity-60 font-normal ml-1">
                    {item.date.format("MMM D")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>



        <div className="space-y-2">
          <div className="space-y-2">
            <span className="text-lg font-medium">Date of Reservation</span>
            <CalendarSelector
              selectedDay={selectedDay}
              onSelectDay={(day) => {
                setSelectedDay(day.startOf("day"));
                const now = getRestaurantNow();
                const noon = day.hour(12).minute(0).second(0).millisecond(0);
                const fromTime = noon.isAfter(now) ? noon : now;
                const next = getNextStartSlot(fromTime);
                setSelectedSlot(next);
              }}
            />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-medium">Time</span>
            <span className="text-sm text-slate-500">{selectedSlot.format("ddd MMM D")}</span>
          </div>
          <TimeSlotGrid
            slots={pagedSlots}
            selected={selectedSlot}
            onSelect={setSelectedSlot}
          />
          <div className="flex gap-3">
            <button
              type="button"
              className="h-12 flex-1 rounded-md border border-slate-300 bg-white text-lg"
              onClick={() => setSlotPage((p) => Math.max(0, p - 1))}
              disabled={!canPrevSlots}
            >
              Earlier
            </button>
            <button
              type="button"
              className="h-12 flex-1 rounded-md border border-slate-300 bg-white text-lg"
              onClick={() => setSlotPage((p) => p + 1)}
              disabled={!canNextSlots}
            >
              Later
            </button>
          </div>
          {fieldErrors.startTime ? (
            <span className="text-red-600 text-sm">{fieldErrors.startTime}</span>
          ) : null}

          {availabilityData?.blackoutReason && (
            <div className="p-6 bg-red-50 border-2 border-red-100 rounded-3xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-300">
               <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 shadow-inner">
                  <ShieldAlert className="w-10 h-10" />
               </div>
               <div className="space-y-1">
                  <h3 className="text-xl font-black text-red-900 leading-none">RESTAURANT CLOSED</h3>
                  <p className="text-red-700 font-bold">{availabilityData.blackoutReason}</p>
               </div>
               <p className="text-xs font-medium text-red-400 uppercase tracking-widest max-w-[240px]">Please select another date or time for your reservation.</p>
            </div>
          )}

          {layoutData && partySize <= 14 && !availabilityData?.blackoutReason && (
            (() => {
              const availableRealTables = layoutData.tables.filter(t => {
                if (t.id === "T15") return false;
                
                // 1. Check physical occupancy
                if (availabilityData?.unavailableTableIds?.includes(t.id)) return false;

                // 2. Check capacity rules (from FloorMap getTableStatus)
                // Rule: Party must fit max capacity
                if (partySize > t.maxCapacity) return false;

                // Rule: Large tables (merged) must meet min capacity
                const isLarge = t.type === "MERGED_FIXED" || t.maxCapacity >= 8;
                if (isLarge && partySize < t.minCapacity) return false;

                // Rule: Circular tables for 5-7 only
                if (t.type === "CIRCULAR" && (partySize < 5 || partySize > 7)) return false;

                return true;
              });
              
              if (availableRealTables.length === 0) return null;

              return (
                <div className="space-y-2 pt-2">
                  <span className="text-lg font-medium">Select a Table (Optional)</span>
                  <FloorMap
                    layout={layoutData}
                    unavailableTableIds={availabilityData?.unavailableTableIds}
                    selectedTableIds={selectedTableIds}
                    partySize={partySize}
                    onSelectTable={(id) => {
                      const table = layoutData.tables.find(t => t.id === id);
                      if (!table) return;

                      const isCircular = table.type === "CIRCULAR";
                      const isLarge = table.type === "MERGED_FIXED" || table.maxCapacity >= 8;
                      const isOverflow = table.id === "T15";

                      if (isCircular && partySize < 5) {
                        setFormError("Circular tables are reserved for parties of 5 or more.");
                        return;
                      }

                      if (isLarge && partySize < table.minCapacity) {
                        setFormError(`Table ${id} requires a minimum of ${table.minCapacity} guests.`);
                        return;
                      }

                      if (partySize > table.maxCapacity && !isOverflow) {
                        setFormError(`Table ${id} only seats up to ${table.maxCapacity} people.`);
                        return;
                      }

                      setFormError(null);
                      setSelectedTableIds((prev) => prev.includes(id) ? [] : [id]);
                    }}
                  />
                  {selectedTableIds.length > 0 && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <h3 className="text-sm font-semibold text-blue-900 mb-1">Selected Tables:</h3>
                      <ul className="text-sm text-blue-800 space-y-1">
                        {selectedTableIds.map((id) => (
                          <li key={id} className="font-bold">Table {id}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>

        <label className="block space-y-2">
          <span className="text-lg font-medium">Special Requests (optional)</span>
          <textarea
            className="w-full rounded-md border border-slate-300 px-4 py-3 text-lg min-h-[96px]"
            value={specialRequests}
            onChange={(event) => setSpecialRequests(event.target.value)}
            placeholder="Allergies, seating preferences, etc."
            autoComplete="off"
          />
          <p className="text-xs text-slate-500">
            Not sent to the reservation system yet.
          </p>
        </label>
      </div>

      <div className="space-y-4 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-slate-800">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-lg">Terms & Conditions</h3>
          </div>
          <div className="h-32 overflow-y-auto pr-2 text-sm text-slate-600 space-y-4 font-medium leading-relaxed custom-scrollbar">
            <p>1. <b>Late Arrivals</b>: Your reservation is held for a maximum of 15 minutes. Beyond this time, we may release your table to other guests waiting on the list.</p>
            <p>2. <b>Stay Duration (Holidays & Weekends)</b>: To accommodate all our guests, stay times are limited on holidays and weekends. For groups of 10 or more, the stay is limited to 2 hours. For groups of less than 10, the stay is limited to 75 minutes.</p>
            <p>3. <b>Property Damage & Costs</b>: By reserving, you agree to be held liable for any physical damage caused to the restaurant’s property, including but not limited to furniture, equipment, or decor. <b>In the event of damage, Diba Restaurant reserves the right to hold your security deposit for an investigation and to cover repair or replacement costs.</b></p>
            <p>4. <b>Conduct</b>: We reserve the right to refuse service or remove guests who are disruptive, intoxicated, or demonstrate behavior that compromises the safety or comfort of our staff and other diners.</p>
            <p>5. <b>Liability</b>: Diba Restaurant is not responsible for lost or stolen personal belongings left on the premises.</p>
          </div>

          <label className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors select-none group">
            <div className="pt-1">
              <input
                type="checkbox"
                className="w-6 h-6 rounded-md border-2 border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
            </div>
            <span className="text-slate-700 font-bold leading-tight group-hover:text-blue-900">
              I have read and agree to all the terms above, including the property damage and liability policies.
            </span>
          </label>

          <label className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-green-50 transition-colors select-none group">
            <div className="pt-1">
              <input
                type="checkbox"
                className="w-6 h-6 rounded-md border-2 border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
              />
            </div>
            <span className="text-slate-700 font-bold leading-tight group-hover:text-green-900">
              Keep me in the loop! Send me updates on new menus, desserts, and special events.
            </span>
          </label>
      </div>

      <button
        type="submit"
        className={clsx(
          "h-16 w-full rounded-2xl text-xl font-black transition-all shadow-lg active:scale-[0.98]",
          isPending || !!availabilityData?.blackoutReason || !agreedToTerms
            ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-70"
            : "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-xl"
        )}
        disabled={isPending || !!availabilityData?.blackoutReason || !agreedToTerms}
      >
        {isPending ? "Creating reservation…" : !!availabilityData?.blackoutReason ? "Unavailable" : "Reserve Now"}
      </button>

      {formError ? <p className="text-red-600 text-sm text-center font-bold animate-in fade-in slide-in-from-top-1">{formError}</p> : null}

      {Object.keys(fieldErrors).length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl animate-in fade-in slide-in-from-top-2">
          <p className="text-red-800 font-bold mb-1">Please correct the following:</p>
          <ul className="list-disc list-inside text-red-700 text-sm">
            {Object.entries(fieldErrors).map(([key, err]) => (
              <li key={key} className="capitalize-first">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {showNetworkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h2 className="text-xl font-semibold">Connection unstable</h2>
            <p className="text-slate-600">
              Reservation may or may not have been created. Do not retry blindly.
            </p>
            <div className="grid gap-3">
              <button
                type="button"
                className="h-12 rounded-md bg-slate-900 text-white text-lg"
                onClick={handleRetry}
              >
                Retry anyway
              </button>
              <button
                type="button"
                className="h-12 rounded-md bg-slate-200 text-slate-800 text-lg"
                onClick={resetKiosk}
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
