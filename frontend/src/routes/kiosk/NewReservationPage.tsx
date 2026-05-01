import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import ReservationForm from "../../components/reservation/ReservationForm";
import StripePaymentModal from "../../components/reservation/StripePaymentModal";
import { cancelReservation } from "../../api/reservations.api";
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

  const handlePaymentCancel = async () => {
    if (!pendingReservation) return;

    setShowPaymentModal(false);

    // Immediately cancel the reservation
    try {
      await cancelReservation(
        pendingReservation.shortId,
        "Customer cancelled payment",
        pendingReservation.clientPhone
      );

      alert("❌ Reservation Cancelled\n\nYour reservation has been cancelled. The table is now available for others.\n\nIf you'd like to make a new reservation, please start over.");

      // Go back to home/booking page
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Failed to cancel reservation:", error);
      alert("⚠️ Error\n\nCould not cancel reservation. Please contact the restaurant at (514) 485-9999.");
      navigate("/", { replace: true });
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
          cancelLabel="Cancel Reservation"
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )}
    </ClientShell>
  );
}
