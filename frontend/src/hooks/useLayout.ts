import { useQuery } from "@tanstack/react-query";
import { getLayout, checkAvailability } from "../api/layout.api";

export function useLayout() {
    return useQuery({
        queryKey: ["layout"],
        queryFn: getLayout,
        staleTime: 1000 * 60 * 60, // Layout rarely changes
    });
}

export function useAvailability(startTime: string | null, partySize: number) {
    return useQuery({
        queryKey: ["availability", startTime, partySize],
        queryFn: () => checkAvailability(startTime!, partySize),
        enabled: !!startTime && partySize > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
