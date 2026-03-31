import { useState, useMemo, useEffect } from "react";
import type { Dayjs } from "dayjs";
import clsx from "clsx";

type CalendarSelectorProps = {
    selectedDay: Dayjs;
    onSelectDay: (day: Dayjs) => void;
};

export default function CalendarSelector({
    selectedDay,
    onSelectDay,
}: CalendarSelectorProps) {
    // Initialize viewer month to the selected day's month
    const [currentMonth, setCurrentMonth] = useState(() => selectedDay.startOf("month"));

    // Sync viewer if selectedDay changes externally to a different month
    useEffect(() => {
        setCurrentMonth((prev) => {
            if (!selectedDay.isSame(prev, "month")) {
                return selectedDay.startOf("month");
            }
            return prev;
        });
    }, [selectedDay]);

    const calendarDays = useMemo(() => {
        const startOfMonth = currentMonth.startOf("month");

        // Start grid from Sunday
        const startGrid = startOfMonth.startOf("week");
        // End grid on Saturday
        // const endGrid = endOfMonth.endOf("week");

        const days: Dayjs[] = [];
        let curr = startGrid;
        // Generate at least 6 weeks to ensure stable height
        // or just until we reach end of grid. 
        // Standard calendar usually fixes 6 rows (42 days).
        const TOTAL_DAYS = 42;

        for (let i = 0; i < TOTAL_DAYS; i++) {
            days.push(curr);
            curr = curr.add(1, "day");
        }

        return days;
    }, [currentMonth]);

    const handlePrevMonth = () => setCurrentMonth((prev) => prev.subtract(1, "month"));
    const handleNextMonth = () => setCurrentMonth((prev) => prev.add(1, "month"));

    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
        <div className="w-full bg-white max-w-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 px-2">
                <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 text-red-500 hover:bg-slate-50 hover:text-red-600 rounded-full transition-colors"
                    aria-label="Previous month"
                >
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-2 text-2xl font-light text-slate-600">
                    <span>{currentMonth.format("MMMM")}</span>
                    <ChevronDownIcon className="w-5 h-5 mt-1 text-slate-800" />
                    <span>{currentMonth.format("YYYY")}</span>
                </div>

                <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-full transition-colors"
                    aria-label="Next month"
                >
                    <ChevronRightIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 mb-4 text-center">
                {weekDays.map((d) => (
                    <div key={d} className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                        {d}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-y-2 place-items-center">
                {calendarDays.map((day) => {
                    const isSelected = day.isSame(selectedDay, "day");
                    const isCurrentMonth = day.month() === currentMonth.month();

                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => onSelectDay(day)}
                            className={clsx(
                                "h-10 w-10 flex items-center justify-center rounded-full text-lg transition-all",
                                !isCurrentMonth && "text-slate-300 font-light",
                                isCurrentMonth && !isSelected && "text-slate-600 hover:bg-slate-100",
                                isSelected && "border-[1.5px] border-slate-500 text-slate-900 font-semibold"
                            )}
                        >
                            {day.date()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ChevronLeftIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={className}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
    );
}

function ChevronRightIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={className}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
    );
}

function ChevronDownIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={className}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
    );
}
