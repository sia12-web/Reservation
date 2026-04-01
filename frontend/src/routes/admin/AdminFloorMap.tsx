import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFloorState, freeTable } from "../../api/admin.api";
import FloorMap from "../../components/reservation/FloorMap";
import {
    Power, Info, AlertCircle, CheckCircle2,
    Loader2, ChevronLeft, ChevronRight, CalendarDays
} from "lucide-react";
import dayjs from "dayjs";
import { toRestaurantTime, getRestaurantNow } from "../../utils/time";
import { clsx } from "clsx";

export default function AdminFloorMap() {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const queryDate = searchParams.get("date");

    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(() => {
        if (queryDate && dayjs(queryDate).isValid()) return queryDate;
        return toRestaurantTime(new Date().toISOString()).format("YYYY-MM-DD");
    });

    const [isFreeModalOpen, setIsFreeModalOpen] = useState(false);
    const [reason, setReason] = useState("");

    const { data: floor, isLoading: isFloorLoading, error: floorError } = useQuery({
        queryKey: ["admin_floor_state", selectedDate],
        queryFn: () => fetchFloorState(selectedDate),
        refetchInterval: 5000,
        enabled: !!selectedDate && dayjs(selectedDate).isValid()
    });


    const isToday = selectedDate === toRestaurantTime(new Date().toISOString()).format("YYYY-MM-DD");
    const now = getRestaurantNow();

    const getNextBusyDay = (targetDay: number) => {
        let d = now.add(1, 'day');
        while (d.day() !== targetDay) d = d.add(1, 'day');
        return d;
    };

    const quickDates = [
        { label: "Today", date: now },
        { label: "Tomorrow", date: now.add(1, 'day') },
        { label: "Next Fri", date: getNextBusyDay(5) },
        { label: "Next Sat", date: getNextBusyDay(6) },
        { label: "Next Sun", date: getNextBusyDay(0) },
    ];

    const changeDate = (days: number) => {
        const newDate = dayjs(selectedDate).add(days, 'day').format("YYYY-MM-DD");
        setSelectedDate(newDate);
        setSearchParams({ date: newDate });
    };

    const handleDateChange = (date: string) => {
        setSelectedDate(date);
        setSearchParams({ date });
    };

    const handleTableSelect = (tableId: string) => {
        setSelectedTableId(tableId === selectedTableId ? null : tableId);
    };

    const freeMutation = useMutation({
        mutationFn: (tableId: string) => freeTable(tableId, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin_floor_state"] });
            setIsFreeModalOpen(false);
            setSelectedTableId(null);
            setReason("");
        }
    });

    const selectedTable = floor?.tables.find(t => t.id === selectedTableId);
    const isOccupied = selectedTable?.status === "OCCUPIED" || selectedTable?.status === "RESERVED";

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] lg:flex-row gap-3 p-3 md:p-4 overflow-hidden">
            {/* Main Area */}
            <div className="flex-grow flex flex-col bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
                <div className="p-4 md:p-6 pb-2 flex-grow flex flex-col">
                    <div className="flex flex-col gap-4 mb-6 z-10 relative">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                                <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white hover:shadow rounded-lg transition-all text-slate-500">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => handleDateChange(e.target.value)}
                                    className="bg-transparent border-none outline-none font-black text-slate-900 px-2 cursor-pointer"
                                />
                                <button onClick={() => changeDate(1)} className="p-2 hover:bg-white hover:shadow rounded-lg transition-all text-slate-500">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={clsx(
                                    "flex items-center gap-2 px-4 py-2 rounded-full border border-blue-100 transition-all text-sm font-bold",
                                    isToday ? "bg-blue-50 text-blue-800" : "bg-purple-50 text-purple-800 border-purple-100"
                                )}>
                                    {isToday ? <CheckCircle2 className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
                                    <span>
                                        {isToday ? "Live View" : "Historical View"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Dates */}
                        <div className="flex gap-2 pb-2 overflow-x-auto items-center">
                            {quickDates
                                .filter((item, index, self) => 
                                    index === self.findIndex(t => t.date.isSame(item.date, 'day'))
                                )
                                .map((item) => {
                                    const dateStr = item.date.format("YYYY-MM-DD");
                                    const isSelected = selectedDate === dateStr;
                                    return (
                                        <button
                                            key={item.label}
                                            onClick={() => handleDateChange(dateStr)}
                                        className={clsx(
                                            "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap",
                                            isSelected ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                                        )}
                                    >
                                        {item.label} <span className="font-normal opacity-70 ml-1">{item.date.format("MMM D")}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {isFloorLoading && !floor ? (
                        <div className="flex-grow flex flex-col items-center justify-center gap-4">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                            <p className="text-slate-500 font-medium">Loading floor plan...</p>
                        </div>
                    ) : floorError ? (
                        <div className="flex-grow flex flex-col items-center justify-center gap-4 text-red-600">
                            <AlertCircle className="w-12 h-12 opacity-50" />
                            <p className="text-lg font-bold">Failed to load floor state</p>
                            <p className="text-slate-500 text-sm">Please check your connection or select a valid date.</p>
                        </div>
                    ) : floor && (
                        <div className="flex-grow flex items-center justify-center relative">
                            {isFloorLoading && (
                                <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-xl">
                                    <div className="bg-white/80 p-4 rounded-full shadow-lg border border-slate-100">
                                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                    </div>
                                </div>
                            )}
                            <FloorMap
                                layout={{ layoutId: floor.layoutId, tables: floor.tables as any, name: "Floor View" }}
                                selectedTableIds={selectedTableId ? [selectedTableId] : []}
                                unavailableTableIds={[]}
                                onSelectTable={handleTableSelect}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-3 h-full overflow-hidden">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-5 flex-grow overflow-y-auto">
                    <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                        <Info className="w-6 h-6 text-blue-600" />
                        Table Details
                    </h3>

                    {selectedTableId && selectedTable ? (
                        <div className="space-y-8">
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Table</div>
                                        <div className="text-3xl font-black text-slate-900">{selectedTable.id}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Capacity</div>
                                        <div className="text-xl font-black text-slate-700">{selectedTable.minCapacity}-{selectedTable.maxCapacity}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={clsx("w-3 h-3 rounded-full animate-pulse", selectedTable.status === "AVAILABLE" ? "bg-emerald-500" : "bg-orange-500")} />
                                    <span className="text-sm font-bold text-slate-600">{selectedTable.status}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4" />
                                    {isToday ? "Today's Schedule" : `${dayjs(selectedDate).format("MMM D")} Schedule`}
                                </h4>
                                {selectedTable.reservations.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedTable.reservations.map(res => (
                                            <Link
                                                key={res.id}
                                                to={`/admin/reservations/${res.id}`}
                                                className="block p-4 bg-white border border-slate-100 rounded-xl hover:shadow-md transition-all group"
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-mono text-xs font-black text-blue-600">#{res.shortId}</span>
                                                    <StatusBadge status={res.status} />
                                                </div>
                                                <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{res.clientName}</div>
                                                <div className="text-sm font-bold text-slate-500 mt-1 flex justify-between">
                                                    <span>{toRestaurantTime(res.startTime).format("HH:mm")} - {toRestaurantTime(res.endTime).format("HH:mm")}</span>
                                                    <span>{res.partySize} Guests</span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-6 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-sm font-bold text-slate-400">No bookings for this date</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-3 pt-2">
                                {isOccupied && (
                                    <button
                                        onClick={() => setIsFreeModalOpen(true)}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Power className="w-5 h-5" />
                                        Free Table Now
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center space-y-3 opacity-40">
                            <AlertCircle className="w-12 h-12 mx-auto" />
                            <p className="font-bold">Select a table to see details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {
                isFreeModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                                <Power className="w-8 h-8 text-red-600" />
                                Free Table {selectedTableId}
                            </h2>
                            <div className="space-y-6">
                                {(() => {
                                    // Find the reservation that is actually causing the "Occupied" status
                                    // Usually the one where startTime <= now and status is CONFIRMED or CHECKED_IN
                                    const activeRes = selectedTable?.reservations.find(r => 
                                        ['CONFIRMED', 'CHECKED_IN'].includes(r.status)
                                    );
                                    
                                    if (activeRes?.depositStatus === "PAID" || activeRes?.depositStatus === "SUCCEEDED") {
                                        return (
                                            <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-start gap-3 animate-pulse">
                                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-black text-amber-900 leading-none uppercase tracking-tight">Security Deposit Active</p>
                                                    <p className="text-xs font-bold text-amber-700 leading-snug">
                                                        Reservation <strong>#{activeRes.shortId}</strong> has a paid deposit. Freeing this table will mark it as complete and <strong>automatically refund</strong> the deposit.
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Reason for release</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Guest left early..."
                                        className="w-full px-4 py-4 rounded-xl bg-slate-50 border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsFreeModalOpen(false)}
                                        className="flex-grow py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all border border-slate-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => selectedTableId && freeMutation.mutate(selectedTableId)}
                                        disabled={!reason || freeMutation.isPending}
                                        className="flex-[2] bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {freeMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Free Now"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-100",
        CHECKED_IN: "bg-blue-50 text-blue-700 border-blue-100",
        COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
        CANCELLED: "bg-red-50 text-red-700 border-red-100",
        NO_SHOW: "bg-orange-50 text-orange-700 border-orange-100",
        PENDING_DEPOSIT: "bg-amber-50 text-amber-700 border-amber-100",
    };

    return (
        <span className={clsx(
            "px-2 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider shadow-sm inline-block",
            styles[status] || "bg-slate-100 text-slate-600"
        )}>
            {status.replace("_", " ")}
        </span>
    );
}
