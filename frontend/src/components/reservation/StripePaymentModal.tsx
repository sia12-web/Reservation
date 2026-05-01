import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useState, useMemo, useEffect } from "react";
import { confirmDemoPayment } from "../../api/reservations.api";
import { Loader2, AlertTriangle, Clock } from "lucide-react";

// Get key from env
const defaultPublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

interface StripePaymentModalProps {
  clientSecret: string;
  reservationId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  amount?: number;
  cancelLabel?: string;
  publishableKey?: string; // New prop for dynamic key
}

function CheckoutForm({
  onSuccess,
  onCancel,
  amount = 50,
  cancelLabel = "Cancel & Start Over",
  reservationId
}: {
  onSuccess: () => void;
  onCancel: () => void;
  amount?: number;
  cancelLabel?: string;
  reservationId?: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [bypassing, setBypassing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5 * 60); // 5 minutes in seconds

  // Countdown timer
  useEffect(() => {
    if (succeeded || processing || bypassing) return; // Pause timer during processing

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-close when time expires
          alert("⏰ Payment time expired!\n\nYour reservation has been cancelled. Please make a new reservation.");
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [succeeded, processing, bypassing, onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setProcessing(true);
    const { error: submitError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message ?? "An error occurred");
      setProcessing(false);
    } else {
      setSucceeded(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    }
  };

  const handleDemoBypass = async () => {
    if (!reservationId) return;
    setBypassing(true);
    try {
      await confirmDemoPayment(reservationId);
      setSucceeded(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError("Demo bypass failed. Check backend logs.");
      setBypassing(false);
    }
  };

  if (succeeded) {
    return (
      <div className="py-12 text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-slate-900">Payment Successful!</h2>
          <p className="text-slate-600 font-medium">Your reservation is being confirmed...</p>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft <= 60; // Last minute

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Countdown Timer */}
      <div className={`${isUrgent ? 'bg-red-100 border-red-300 animate-pulse' : 'bg-blue-50 border-blue-200'} border-2 p-4 rounded-xl flex items-center justify-center gap-3`}>
        <Clock className={`w-6 h-6 ${isUrgent ? 'text-red-700' : 'text-blue-700'}`} />
        <div className="text-center">
          <p className={`${isUrgent ? 'text-red-900' : 'text-blue-900'} font-bold text-lg`}>
            Time Remaining: {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
          <p className={`${isUrgent ? 'text-red-700' : 'text-blue-700'} text-xs font-medium`}>
            {isUrgent ? '⚠️ Hurry! Your reservation will be cancelled soon!' : 'Complete payment to confirm your reservation'}
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
         <p className="text-amber-800 font-semibold mb-1">Security Deposit Required</p>
         <p className="text-amber-700 text-sm">
           A security deposit of <strong>${amount}</strong> is required to hold your table.
           The deposit (minus a $2.00 processing fee) will be refunded once you finish your reservation.
         </p>
      </div>

      <PaymentElement className="min-h-[300px]" />
      
      {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
      
      <div className="grid gap-3 pt-4">
        <button
          disabled={!stripe || processing || bypassing}
          type="submit"
          className="h-14 w-full rounded-xl bg-slate-900 text-white text-xl font-bold shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {processing ? "Processing..." : `Pay $${amount} Deposit`}
        </button>
        {reservationId && (
          <button
            type="button"
            onClick={handleDemoBypass}
            disabled={processing || bypassing}
            className="h-12 w-full rounded-xl bg-emerald-100 text-emerald-700 font-bold border-2 border-emerald-200 hover:bg-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            {bypassing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Demo Bypass (Mark as Paid)"}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="h-12 w-full rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all"
        >
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}

export default function StripePaymentModal({
  clientSecret,
  reservationId,
  onSuccess,
  onCancel,
  amount,
  cancelLabel,
  publishableKey
}: StripePaymentModalProps) {
  // Use provided key or fall back to env
  const key = publishableKey || defaultPublishableKey;
  
  // Memoize stripePromise so we don't recreate it on every render
  const stripePromise = useMemo(() => {
    if (!key) {
        console.error("❌ Stripe Publishable Key is missing!");
        return null;
    }
    console.log("✅ Initializing Stripe with key (starts with):", key.substring(0, 7));
    return loadStripe(key);
  }, [key]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-300 custom-scrollbar">
        {stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm 
                onSuccess={onSuccess} 
                onCancel={onCancel} 
                amount={amount} 
                cancelLabel={cancelLabel} 
                reservationId={reservationId}
              />
            </Elements>
        ) : (
            <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <p className="text-red-600 font-bold">Stripe configuration missing.</p>
                <button 
                    onClick={onCancel}
                    className="w-full h-12 bg-slate-100 rounded-xl font-bold"
                >
                    Back
                </button>
            </div>
        )}
      </div>
    </div>
  );
}

