import { trySmartReassignment } from "../src/services/reassignment";
import { findBestTableAssignment } from "../src/services/tableAssignment/engine";
import { checkAvailability } from "../src/services/availability";

jest.mock("../src/services/tableAssignment/engine");
jest.mock("../src/services/availability");

const prismaMock = {
    reservationTable: {
        findMany: jest.fn(),
    },
} as any;

describe("Smart Reassignment Depth Logic", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    test("checks full duration availability for moved reservations", async () => {
        const startTime = new Date("2024-02-05T19:00:00Z");
        const endTime = new Date("2024-02-05T20:30:00Z");
        const layoutId = "L1";
        const allTables = [
            { id: "T1", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 1 },
            { id: "T2", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 1 },
            { id: "T3", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 1 },
        ] as any;

        // Conflict: T1 is taken by ResA (19:00 - 21:00)
        // New party wants T1 (19:00 - 20:30)
        prismaMock.reservationTable.findMany.mockResolvedValue([
            {
                tableId: "T1",
                reservationId: "ResA",
                reservation: {
                    id: "ResA",
                    startTime: new Date("2024-02-05T19:00:00Z"),
                    endTime: new Date("2024-02-05T21:00:00Z"), // Long stay
                    partySize: 2
                }
            }
        ]);

        (findBestTableAssignment as jest.Mock)
            .mockReturnValueOnce({ candidates: [{ tableIds: ["T1"] }], best: { tableIds: ["T1"] } }) // Ideal for new party
            .mockReturnValueOnce({ candidates: [{ tableIds: ["T2"] }], best: { tableIds: ["T2"] } }); // Move ResA to T2

        // CRITICAL: checkAvailability should be called twice
        // 1. Initial check (not shown here as it's passed into the function usually, but internal to reassignment now?)
        // Wait, reassignment calls checkAvailability INTERNALLY now.

        // Mock checkAvailability for ResA's move (19:00 - 21:00)
        (checkAvailability as jest.Mock).mockResolvedValue(["T3"]); // T3 is occupied during ResA's stay

        const result = await trySmartReassignment(prismaMock, {
            newPartySize: 2,
            startTime,
            endTime,
            layoutId,
            allTables,
            adjacency: {}
        });

        expect(result.canReassign).toBe(true);
        expect(result.moves[0].reservationId).toBe("ResA");
        expect(result.moves[0].newTableIds).toEqual(["T2"]);

        // Verify that checkAvailability was called with FULL duration of ResA
        expect(checkAvailability).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            startTime: new Date("2024-02-05T19:00:00Z"),
            endTime: new Date("2024-02-05T21:00:00Z"),
            excludeReservationId: "ResA"
        }));
    });
});
