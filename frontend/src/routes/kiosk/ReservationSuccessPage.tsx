import { useLocation, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import ReservationSummary from "../../components/reservation/ReservationSummary";
import type { ReservationResponse } from "../../api/reservations.api";
import { useKioskReset } from "../../components/kiosk/InactivityGuard";
import { CreditCard, CheckCircle2 } from "lucide-react";

type LocationState = {
  reservation?: ReservationResponse;
};

export default function ReservationSuccessPage() {
  const { id } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { resetKiosk } = useKioskReset();

  const state = location.state as LocationState | null;
  const cached = id ? (queryClient.getQueryData(["reservation", id]) as ReservationResponse) : null;
  const reservation = state?.reservation ?? cached;

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2 py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-2">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900">Thank you!</h1>
          <p className="text-xl text-slate-600 font-medium">
            {reservation?.status === "PENDING_DEPOSIT" 
              ? "Request Received" 
              : reservation?.status === "WAITLIST"
              ? "You're on our waiting list!"
              : "Your reservation is confirmed."}
          </p>
        </div>

        {reservation ? (
          <ReservationSummary reservation={reservation} />
        ) : (
          <div className="rounded-2xl bg-white p-8 border border-slate-200 shadow-sm">
            <p className="text-lg font-semibold text-slate-800">Reservation ID</p>
            <p className="text-3xl font-mono text-blue-600 tracking-wider">
              {id?.slice(0, 8).toUpperCase() ?? "—"}
            </p>
            <p className="text-slate-500 mt-4 text-sm italic">
              A summary has been sent to your email.
            </p>
          </div>
        )}

        {/* Pending Deposit Instructions */}
        {reservation?.status === "PENDING_DEPOSIT" && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl text-red-600 shadow-sm">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-red-900">Payment Required - Action Needed!</h3>
                <p className="text-red-800 font-medium leading-relaxed">
                  Your reservation is NOT confirmed yet. Payment must be completed immediately.
                </p>
              </div>
            </div>

            <div className="bg-white/60 rounded-xl p-5 border border-red-100 space-y-3">
               <div className="flex gap-3">
                 <div className="w-6 h-6 bg-red-200 text-red-900 rounded-full flex items-center justify-center font-black text-xs shrink-0">!</div>
                 <p className="text-red-900 font-bold">
                   This reservation will be automatically cancelled in 5 minutes if payment is not received.
                 </p>
               </div>
               <div className="flex gap-3">
                 <div className="w-6 h-6 bg-red-200 text-red-900 rounded-full flex items-center justify-center font-black text-xs shrink-0">⚠</div>
                 <p className="text-red-700 font-semibold">
                   Please contact the restaurant immediately at (XXX) XXX-XXXX to complete payment.
                 </p>
               </div>
            </div>
          </div>
        )}

        {/* Waitlist Instructions */}
        {reservation?.status === "WAITLIST" && (
          <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl text-purple-600 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-purple-900">You're on the Waiting List</h3>
                <p className="text-purple-800 font-medium leading-relaxed">
                  All tables are currently reserved for this time. We've added you to our waiting list.
                </p>
              </div>
            </div>
            
            <div className="bg-white/60 rounded-xl p-5 border border-purple-100 space-y-3">
               <div className="flex gap-3">
                 <div className="w-6 h-6 bg-purple-200 text-purple-900 rounded-full flex items-center justify-center font-black text-xs shrink-0">1</div>
                 <p className="text-purple-900 font-semibold">If a table opens up, we'll notify you immediately.</p>
               </div>
               <div className="flex gap-3">
                 <div className="w-6 h-6 bg-purple-200 text-purple-900 rounded-full flex items-center justify-center font-black text-xs shrink-0">2</div>
                 <p className="text-purple-900 font-semibold">No action needed — just keep your phone nearby.</p>
               </div>
            </div>
          </div>
        )}

        {/* No review section here since they haven't dined yet */}

        <button
          className="h-16 w-full rounded-2xl bg-slate-900 text-white text-xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98]"
          onClick={resetKiosk}
        >
          New Reservation
        </button>

        <p className="text-center text-slate-400 text-sm">
           Returning to home screen in 30 seconds...
        </p>
      </div>
    </div>
  );
}
