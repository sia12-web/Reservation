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
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl text-amber-600 shadow-sm">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-amber-900">Security Deposit Required</h3>
                <p className="text-amber-800 font-medium leading-relaxed">
                  For large parties, we require a $50 deposit to confirm your table.
                </p>
              </div>
            </div>
            
            <div className="bg-white/60 rounded-xl p-5 border border-amber-100 space-y-3">
               <div className="flex gap-3">
                 <div className="w-6 h-6 bg-amber-200 text-amber-900 rounded-full flex items-center justify-center font-black text-xs shrink-0">1</div>
                 <p className="text-amber-900 font-semibold">Check your email for the secure payment link.</p>
               </div>
               <div className="flex gap-3">
                 <div className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center font-black text-xs shrink-0">2</div>
                 <p className="text-red-700 font-bold">
                   Payment must be completed in 15 minutes or your table will be released.
                 </p>
               </div>
            </div>
          </div>
        )}

        {/* Review Section */}
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">How was your booking experience?</h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              We strive to make your visit perfect. If you enjoyed using our system, please share your feedback.
            </p>
            <a 
              href={import.meta.env.VITE_REVIEW_LINK || "https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID"} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all border border-blue-200"
            >
              <span>Leave us a Google Review</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
        </div>

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
