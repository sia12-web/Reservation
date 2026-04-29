import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useState, useMemo } from "react";
import { confirmDemoPayment } from "../../api/reservations.api";
import { Loader2, AlertTriangle } from "lucide-react";

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
      onSuccess();
    }
  };

  const handleDemoBypass = async () => {
    if (!reservationId) return;
    setBypassing(true);
    try {
      await confirmDemoPayment(reservationId);
      onSuccess();
    } catch (err: any) {
      setError("Demo bypass failed. Check backend logs.");
      setBypassing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
         <p className="text-amber-800 font-semibold mb-1">Security Deposit Required</p>
         <p className="text-amber-700 text-sm">
           A fully refundable deposit of <strong>${amount}</strong> is required to hold your table.
           It will be freed once you finish your reservation.
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

