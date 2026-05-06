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
  source?: string; // WEB, KIOSK, PHONE, WALK_IN
  depositStatus: string;
  customerNotes: string | null;
  tableIds?: string[]; // Unified: creation response uses this
  reservationTables?: { tableId: string }[];
  clientSecret?: string | null;
  stripePublishableKey?: string;
};

export async function createReservation(payload: ReservationRequest): Promise<ReservationResponse> {
  // Use 30s timeout for reservation creation due to Stripe API + DB operations
  return httpPost<ReservationResponse>("/reservations", payload, { timeoutMs: 30000 });
}

export async function fetchReservationByShortId(shortId: string): Promise<ReservationResponse> {
  return httpGet<ReservationResponse>(`/reservations/${shortId}`);
}

export async function cancelReservation(shortId: string, reason: string, clientPhone: string): Promise<{ message: string }> {
  // Fix #10: Use shortId + phone verification instead of UUID
  return httpPost<{ message: string }>(`/reservations/${shortId}/cancel`, { reason, clientPhone });
}
export async function confirmDemoPayment(id: string): Promise<{ message: string }> {
  return httpPost<{ message: string }>(`/reservations/${id}/confirm-payment-demo`, {});
}
