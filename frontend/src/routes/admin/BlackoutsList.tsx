import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBlackouts, createBlackout, deleteBlackout } from "../../api/admin.api";
import type { Blackout } from "../../api/admin.api";
import dayjs from "dayjs";
import { parseInRestaurantTime, toUtcIso } from "../../utils/time";
import { Calendar, Trash2, Clock, ShieldAlert, Plus, X } from "lucide-react";
import clsx from "clsx";

export default function BlackoutsList() {
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [form, setForm] = useState({
        date: dayjs().format("YYYY-MM-DD"),
        startTime: "12:00",
        endTime: "22:00",
        reason: ""
    });

    const { data: blackouts, isLoading } = useQuery({
        queryKey: ["admin_blackouts"],
        queryFn: fetchBlackouts,
    });

    const createMutation = useMutation({
        mutationFn: (data: typeof form) => {
            const start = toUtcIso(parseInRestaurantTime(data.date, data.startTime));
            const end = toUtcIso(parseInRestaurantTime(data.date, data.endTime));
            return createBlackout({ startTime: start, endTime: end, reason: data.reason });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin_blackouts"] });
            setIsCreateModalOpen(false);
            setForm({
                date: dayjs().format("YYYY-MM-DD"),
                startTime: "12:00",
                endTime: "22:00",
                reason: ""
            });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteBlackout(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin_blackouts"] });
        }
    });

    const handleDelete = (id: string) => {
        if (window.confirm("Are you sure you want to remove this closure?")) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900">Restaurant Closures</h1>
                    <p className="text-slate-500 font-medium text-sm">Manage blackout periods for holidays or private events.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Add Closure
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
                {isLoading ? (
                    <div className="p-12 text-center animate-pulse space-y-4">
                        <div className="h-4 w-48 bg-slate-100 rounded mx-auto" />
                        <div className="h-4 w-32 bg-slate-100 rounded mx-auto" />
                    </div>
                ) : (blackouts || []).length === 0 ? (
                    <div className="p-20 text-center text-slate-400">
                        <ShieldAlert className="w-16 h-16 mx-auto mb-4 opacity-10" />
                        <p className="text-lg font-bold">No planned closures</p>
                        <p className="text-sm">The restaurant is operating normally on all dates.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {blackouts?.map((b: Blackout) => {
                                    const start = dayjs(b.startTime);
                                    const end = dayjs(b.endTime);
                                    const isFullDay = start.format("HH:mm") === "12:00" && end.format("HH:mm") === "22:00";
                                    
                                    return (
                                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex flex-col items-center justify-center border border-blue-100 shrink-0">
                                                        <span className="text-[9px] font-black leading-none text-blue-400 uppercase">{start.format("MMM")}</span>
                                                        <span className="text-base font-black leading-none text-blue-700">{start.format("D")}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-900 text-sm">{start.format("dddd, MMM D")}</p>
                                                        <p className="text-xs font-bold text-slate-500">
                                                            {isFullDay ? "Full Day Closure" : `${start.format("h:mm A")} - ${end.format("h:mm A")}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={clsx(
                                                    "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                    isFullDay ? "bg-red-50 text-red-600 border-red-100" : "bg-amber-50 text-amber-600 border-amber-100"
                                                )}>
                                                    {isFullDay ? "CLOSED" : "PARTIAL"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-bold text-slate-600">
                                                {b.reason || "Scheduled maintenance"}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleDelete(b.id)}
                                                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all flex items-center justify-center group ml-auto"
                                                >
                                                    <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-slate-900">Add Planned Closure</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Select Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="date"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 bg-slate-50"
                                        value={form.date}
                                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">From</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="time"
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 bg-slate-50"
                                            value={form.startTime}
                                            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Until</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="time"
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 bg-slate-50"
                                            value={form.endTime}
                                            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => setForm({ ...form, startTime: "12:00", endTime: "22:00" })}
                                    className={clsx(
                                        "flex-grow py-2 rounded-lg text-xs font-black transition-all",
                                        form.startTime === "12:00" && form.endTime === "22:00" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-white/50"
                                    )}
                                >
                                    Full Day (12PM-10PM)
                                </button>
                                <button
                                    onClick={() => setForm({ ...form, startTime: "14:00", endTime: "18:00" })}
                                    className={clsx(
                                        "flex-grow py-2 rounded-lg text-xs font-black transition-all",
                                        form.startTime === "14:00" && form.endTime === "18:00" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-white/50"
                                    )}
                                >
                                    Afternoon Block
                                </button>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Reason (Visible to Guest)</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 bg-slate-50"
                                    placeholder="e.g. Private Event, Holiday, Renovations..."
                                    value={form.reason}
                                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-grow py-4 rounded-2xl font-black text-slate-400 hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => createMutation.mutate(form)}
                                    disabled={createMutation.isPending || !form.date || !form.startTime || !form.endTime}
                                    className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50"
                                >
                                    {createMutation.isPending ? "Applying..." : "Save Closure"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
