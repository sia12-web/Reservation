import { httpGet, httpPost } from "./httpClient";
import type { ReservationRequest } from "../utils/validation";

export type ReservationResponse = {
  id?: string;
  reservationId?: string; // Unified: creation response uses this
  shortId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  partySize: number;
  startTime: string;
  endTime: string;
  status: string;
  depositStatus: string;
  customerNotes: string | null;
  tableIds?: string[]; // Unified: creation response uses this
  reservationTables?: { tableId: string }[];
  clientSecret?: string | null;
};

export async function createReservation(payload: ReservationRequest): Promise<ReservationResponse> {
  // Use 30s timeout for reservation creation due to Stripe API + DB operations
  return httpPost<ReservationResponse>("/reservations", payload, { timeoutMs: 30000 });
}

export async function fetchReservationByShortId(shortId: string): Promise<ReservationResponse> {
  return httpGet<ReservationResponse>(`/reservations/${shortId}`);
}

export async function cancelReservation(id: string, reason: string): Promise<{ message: string }> {
  // NOTE: We might need a public cancellation endpoint or use admin one if we allow public access.
  // For now, let's assume we add a public one in reservations.ts or just handle it here.
  // Actually, let's just stick to viewing for now as per user's "see his current reservation" request.
  return httpPost<{ message: string }>(`/reservations/${id}/cancel`, { reason });
}
export async function confirmDemoPayment(id: string): Promise<{ message: string }> {
  return httpPost<{ message: string }>(`/reservations/${id}/confirm-payment-demo`, {});
}
