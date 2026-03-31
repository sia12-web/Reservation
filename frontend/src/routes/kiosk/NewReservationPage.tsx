import { useLocation, useNavigate } from "react-router-dom";
import ReservationForm from "../../components/reservation/ReservationForm";
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

  const handleSuccess = (response: unknown) => {
    const reservation = response as ReservationResponse;
    navigate(`/reservations/${reservation.reservationId}/success`, {
      state: { reservation },
      replace: true,
    });
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
    </ClientShell>
  );
}
