import type { ReservationResponse } from "../../api/reservations.api";
import { formatTimeWindow } from "../../utils/time";
import clsx from "clsx";

type ReservationSummaryProps = {
  reservation: ReservationResponse;
};

export default function ReservationSummary({ reservation }: ReservationSummaryProps) {
  const shortId = reservation.reservationId?.slice(0, 8) || "—";
  const status = reservation.status ?? "UNKNOWN";
  const statusClass =
    status === "CONFIRMED"
      ? "bg-green-100 text-green-800"
      : status === "PENDING_DEPOSIT"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-200 text-slate-800";


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Reservation ID</p>
          <p className="text-xl font-semibold">{shortId}</p>
        </div>
        <span className={clsx("px-3 py-1 rounded-full text-sm font-medium", statusClass)}>
          {status}
        </span>
      </div>
      {reservation.startTime && reservation.endTime && (
        <div>
          <p className="text-sm text-slate-500">Time</p>
          <p className="text-lg font-medium">
            {formatTimeWindow(reservation.startTime, reservation.endTime)}
          </p>
        </div>
      )}
      {reservation.clientEmail && reservation.status === "CONFIRMED" ? (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-blue-800 text-sm font-medium">
            ✉️ We have sent your reservation confirmation to your email.
          </p>
        </div>
      ) : null}
    </div>
  );
}
