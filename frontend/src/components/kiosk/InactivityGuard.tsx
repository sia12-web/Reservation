import React, { createContext, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useInactivityTimer } from "../../hooks/useInactivityTimer";

const KIOSK_INACTIVITY_SECONDS = Number(
  import.meta.env.VITE_KIOSK_INACTIVITY_SECONDS || 60
);

type KioskResetContextValue = {
  resetKiosk: () => void;
};

const KioskResetContext = createContext<KioskResetContextValue>({
  resetKiosk: () => undefined,
});

export function useKioskReset() {
  return useContext(KioskResetContext);
}

export default function InactivityGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const resetKiosk = useCallback(() => {
    queryClient.getMutationCache().clear();
    queryClient.removeQueries({ queryKey: ["reservation"] });
    navigate("/reservations", { replace: true, state: null });
  }, [navigate, queryClient]);

  useInactivityTimer({ timeoutSeconds: KIOSK_INACTIVITY_SECONDS, onTimeout: resetKiosk });

  return (
    <KioskResetContext.Provider value={{ resetKiosk }}>
      {children}
    </KioskResetContext.Provider>
  );
}
