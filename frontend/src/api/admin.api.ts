import { httpGet, httpPost, httpDelete } from "./httpClient";

export interface ReservationAdmin {
    id: string;
    shortId: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string | null;
    partySize: number;
    startTime: string;
    endTime: string;
    status: string;
    depositStatus: string;
    source: string;
    tableIds: string[];
    internalNotes?: string;
    createdAt: string;
}

export interface FloorState {
    layoutId: string;
    tables: Array<{
        id: string;
        type: string;
        x: number;
        y: number;
        width: number;
        height: number;
        shape: string;
        minCapacity: number;
        maxCapacity: number;
        status: string; // "AVAILABLE" | "OCCUPIED" | "RESERVED"
        reservations: Array<{
            id: string;
            status: string;
            shortId: string;
            startTime: string;
            endTime: string;
            partySize: number;
            clientName: string;
            lateWarningSent?: boolean;
            depositStatus?: string;
        }>;
    }>;
}

export async function fetchAdminReservations(params: any = {}): Promise<ReservationAdmin[]> {
    const qs = new URLSearchParams(params).toString();
    return httpGet<ReservationAdmin[]>(`/admin/reservations?${qs}`);
}

export async function fetchAdminReservation(id: string): Promise<ReservationAdmin> {
    return httpGet<ReservationAdmin>(`/admin/reservations/${id}`);
}

export async function fetchFloorState(date?: string): Promise<FloorState> {
    const qs = date ? `?date=${date}` : "";
    return httpGet<FloorState>(`/admin/floor${qs}`);
}

export async function reassignTables(id: string, payload: { newTableIds: string[]; reason: string }) {
    return httpPost<{ message: string; newTableIds: string[] }>(`/admin/reservations/${id}/reassign`, payload);
}

export async function freeTable(tableId: string, reason: string) {
    return httpPost<{ message: string }>(`/admin/tables/${tableId}/free`, { reason });
}

export async function cancelReservation(id: string, reason: string) {
    return httpPost<{ message: string }>(`/admin/reservations/${id}/cancel`, { reason });
}

export async function sendLateWarning(id: string) {
    return httpPost<{ message: string }>(`/admin/reservations/${id}/late-warning`, {});
}

export async function createReservation(payload: {
    clientName: string;
    clientPhone: string;
    partySize: number;
    startTime: string; // ISO string
    internalNotes?: string;
}) {
    return httpPost<ReservationAdmin>("/admin/reservations", payload);
}

export async function resetReservations() {
    return httpPost<{ message: string }>("/admin/debug/reset-reservations", { confirmCode: "CONFIRM_RESET" });
}

// --- Blackouts ---
export interface Blackout {
    id: string;
    startTime: string;
    endTime: string;
    reason: string | null;
}

export async function fetchBlackouts(): Promise<Blackout[]> {
    return httpGet<Blackout[]>("/admin/blackouts");
}

export async function createBlackout(payload: { startTime: string; endTime: string; reason?: string }) {
    return httpPost<Blackout>("/admin/blackouts", payload);
}

export async function deleteBlackout(id: string) {
    return httpDelete<{ message: string }>(`/admin/blackouts/${id}`);
}
