import { httpGet } from "./httpClient";

export type Table = {
    id: string;
    type: string;
    minCapacity: number;
    maxCapacity: number;
    x: number;
    y: number;
    width: number;
    height: number;
    shape: string;
    rotation: number;
    priorityScore: number;
    // Optional status fields for Admin View
    status?: string;
    reservations?: any[];
};

export type LayoutResponse = {
    layoutId: string;
    name: string;
    tables: Table[];
};

export type AvailabilityResponse = {
    unavailableTableIds: string[];
    blackoutReason?: string | null;
};

export async function getLayout(): Promise<LayoutResponse> {
    return httpGet<LayoutResponse>("/layout");
}

export async function checkAvailability(
    startTime: string,
    partySize: number
): Promise<AvailabilityResponse> {
    const params = new URLSearchParams({
        startTime,
        partySize: partySize.toString(),
    });
    return httpGet<AvailabilityResponse>(`/availability?${params.toString()}`);
}
