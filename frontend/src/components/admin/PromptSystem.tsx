import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFloorState, sendLateWarning } from "../../api/admin.api";
import { X, Clock, Mail } from "lucide-react";
import dayjs from "dayjs";

type PromptItem = {
    id: string;
    type: "OCCUPANCY" | "LATE";
    data?: any;
};

export default function PromptSystem() {
    const queryClient = useQueryClient();
    const [promptQueue, setPromptQueue] = useState<PromptItem[]>([]);
    const lastPromptedAt = useRef<Record<string, number>>({});

    const { data: floor } = useQuery({
        queryKey: ["prompt_floor_check"],
        queryFn: () => fetchFloorState(),
        refetchInterval: 30000, // Check every 30s
    });

    useEffect(() => {
        if (!floor) return;

        const now = dayjs();
        const fifteenMinutesAgo = now.subtract(15, 'minute');

        const newPrompts: PromptItem[] = [];

        floor.tables.forEach(t => {
            // 1. Check for Occupancy (Stale Tables)
            if (t.status === "OCCUPIED" && !lastPromptedAt.current[`occ:${t.id}`]) {
                // Determine occupancy duration check if needed (omitted for brevity, relying on user interaction mostly)
                // For now, let's keep the logic simple: if we tracked occupancy start we'd use it.
                // Since api doesn't give occupancy start, we might skip or rely on local timer.
                // Reverting to previous logic: checking against a ref if we had it. 
                // Since this is a specialized prompt, let's focus on the NEW req: Late Arrivals.
                // The previous logic for occupancy was based on local timer which is reset on refresh.
                const lastTime = lastPromptedAt.current[`occ:${t.id}`] || 0;
                if (Date.now() - lastTime > 30 * 60 * 1000) {
                    // newPrompts.push({ id: t.id, type: "OCCUPANCY" });
                    // disable automatic occupancy prompt for now to focus on Late Arrival as req
                }
            }

            // 2. Check for Late Arrivals
            t.reservations.forEach(res => {
                if (res.status === 'CONFIRMED' && !res.lateWarningSent) {
                    const start = dayjs(res.startTime);
                    if (start.isBefore(fifteenMinutesAgo)) {
                        // It is late!
                        if (!lastPromptedAt.current[`late:${res.id}`]) {
                            newPrompts.push({
                                id: res.id,
                                type: "LATE",
                                data: { name: res.clientName, time: start.format("h:mm A"), shortId: res.shortId }
                            });
                        }
                    }
                }
            });
        });

        if (newPrompts.length > 0) {
            setPromptQueue(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const filtered = newPrompts.filter(p => !existingIds.has(p.id));
                return [...prev, ...filtered];
            });

            // Mark as prompted
            newPrompts.forEach(p => {
                lastPromptedAt.current[`${p.type.toLowerCase()}:${p.id}`] = Date.now();
            });
        }

    }, [floor]);

    const currentPrompt = promptQueue[0];

    const handleDismiss = (id: string) => {
        setPromptQueue(prev => prev.filter(p => p.id !== id));
    };

    const handleLateResponse = (isHere: boolean) => {
        if (!currentPrompt) return;

        if (isHere) {
            // User is here. Dismiss. Admin can check them in manually.
            handleDismiss(currentPrompt.id);
        } else {
            // User is NOT here. Send Email.
            sendLateWarning(currentPrompt.id).then(() => {
                queryClient.invalidateQueries({ queryKey: ["admin_floor_state"] });
                // Also invalidate list if needed
            });
            handleDismiss(currentPrompt.id);
        }
    };

    if (!currentPrompt) return null;

    if (currentPrompt.type === 'LATE') {
        return (
            <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-right-8 duration-500">
                <div className="bg-white rounded-3xl shadow-2xl border-4 border-red-500 p-8 w-[400px] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2">
                        <button onClick={() => handleDismiss(currentPrompt.id)} className="text-slate-300 hover:text-slate-600 p-2">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
                                <Clock className="w-10 h-10" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Late Arrival Check</p>
                                <h4 className="text-xl font-black text-slate-900 line-clamp-1">{currentPrompt.data.name}</h4>
                            </div>
                        </div>

                        <p className="text-slate-600 font-medium leading-relaxed">
                            Reservation for <span className="font-bold text-slate-900">{currentPrompt.data.time}</span> is over 15 mins late. <br />
                            <span className="font-black text-slate-900 text-lg">Has the guest arrived?</span>
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleLateResponse(false)}
                                className="py-3 px-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex flex-col items-center justify-center gap-1"
                            >
                                <span className="text-xs uppercase tracking-wider opacity-90">No</span>
                                <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> Send Email</span>
                            </button>
                            <button
                                onClick={() => handleLateResponse(true)}
                                className="py-3 px-4 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200"
                            >
                                Yes, they are here
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default Occupancy UI (if needed in future, essentially hidden for now based on logic above)
    return null;
}
