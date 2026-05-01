import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import ReservationForm from "../../components/reservation/ReservationForm";
import StripePaymentModal from "../../components/reservation/StripePaymentModal";
import type { ReservationDraft } from "../../components/reservation/ReservationForm";
import type { ReservationResponse } from "../../api/reservations.api";
import ClientShell from "../../app/layout/ClientShell";

type LocationState = {
  draft?: ReservationDraft;
};

export default function NewReservationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingReservation, setPendingReservation] = useState<ReservationResponse | null>(null);

  const handleSuccess = (response: unknown) => {
    const reservation = response as ReservationResponse;

    // Check if deposit is required
    if (reservation.status === "PENDING_DEPOSIT" && reservation.clientSecret) {
      // Show payment modal immediately - user MUST pay before proceeding
      setPendingReservation(reservation);
      setShowPaymentModal(true);
    } else {
      // No payment needed, go directly to success page
      navigate(`/reservations/${reservation.reservationId}/success`, {
        state: { reservation },
        replace: true,
      });
    }
  };

  const handlePaymentSuccess = () => {
    // Payment completed, now go to success page with CONFIRMED status
    setShowPaymentModal(false);
    if (pendingReservation) {
      navigate(`/reservations/${pendingReservation.reservationId}/success`, {
        state: { reservation: { ...pendingReservation, status: "CONFIRMED" } },
        replace: true,
      });
    }
  };

  const handlePaymentCancel = () => {
    // User cancelled payment - show warning
    setShowPaymentModal(false);
    alert("⚠️ Payment Required!\n\nYour reservation will be automatically cancelled in 5 minutes if payment is not completed.\n\nPlease call us at (514) 485-9999 to complete your reservation.");

    // Navigate to success page showing PENDING_DEPOSIT warning
    if (pendingReservation) {
      navigate(`/reservations/${pendingReservation.reservationId}/success`, {
        state: { reservation: pendingReservation },
        replace: true,
      });
    }
  };

  return (
    <ClientShell
      title="Reserve a Table"
      subtitle="Select a time and guests to begin"
    >
      <ReservationForm
        defaultValues={state?.draft}
        onSuccess={handleSuccess}
      />

      {/* Payment Modal - Blocks until payment complete */}
      {showPaymentModal && pendingReservation && (
        <StripePaymentModal
          clientSecret={pendingReservation.clientSecret!}
          reservationId={pendingReservation.reservationId}
          amount={50}
          publishableKey={pendingReservation.stripePublishableKey}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )}
    </ClientShell>
  );
}
