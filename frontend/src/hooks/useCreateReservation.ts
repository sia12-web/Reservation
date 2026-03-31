import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReservation } from "../api/reservations.api";
import type { ReservationRequest } from "../utils/validation";

export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["createReservation"],
    mutationFn: (payload: ReservationRequest) => createReservation(payload),
    onSuccess: (data) => {
      if (data?.reservationId) {
        queryClient.setQueryData(["reservation", data.reservationId], data);
      }
    },
  });
}
