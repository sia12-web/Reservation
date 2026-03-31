import type { Dayjs } from "dayjs";
import clsx from "clsx";

type DateChipsProps = {
  days: Dayjs[];
  selectedDay: Dayjs;
  onSelectDay: (day: Dayjs) => void;
  size?: "kiosk" | "client";
};

export default function DateChips({
  days,
  selectedDay,
  onSelectDay,
  size = "kiosk",
}: DateChipsProps) {
  const btnClass =
    size === "kiosk"
      ? "h-12 px-4 text-lg"
      : "h-10 px-3 text-sm";

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {days.map((day) => {
        const isSelected = day.isSame(selectedDay, "day");
        return (
          <button
            key={day.format("YYYY-MM-DD")}
            type="button"
            className={clsx(
              "shrink-0 rounded-md border font-medium",
              btnClass,
              isSelected
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white border-slate-300"
            )}
            onClick={() => onSelectDay(day)}
          >
            {day.format("ddd MMM D")}
          </button>
        );
      })}
    </div>
  );
}

