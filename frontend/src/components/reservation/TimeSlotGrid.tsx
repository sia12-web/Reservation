import { Dayjs } from "dayjs";
import { formatTime } from "../../utils/time";
import clsx from "clsx";

export default function TimeSlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: Dayjs[];
  selected: Dayjs | null;
  onSelect: (slot: Dayjs) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {slots.map((slot) => {
        const isSelected = selected?.valueOf() === slot.valueOf();
        return (
          <button
            key={slot.toISOString()}
            type="button"
            className={clsx(
              "h-10 rounded-md border text-base font-medium",
              isSelected
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white border-slate-300"
            )}
            onClick={() => onSelect(slot)}
          >
            {formatTime(slot)}
          </button>
        );
      })}
    </div>
  );
}
