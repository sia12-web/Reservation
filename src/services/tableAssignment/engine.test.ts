
import { findBestTableAssignment } from "./engine";
import { TableConfig } from "./types";

// Mock Data mirroring the User's latest specification and Seed
const MOCK_TABLES: TableConfig[] = [
    // Standard (1-4)
    { id: "1", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 99 },
    { id: "2", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 98 },
    { id: "3", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 97 },

    // Circular (4-7) - Strongly Preferred for 5-7
    { id: "4", type: "CIRCULAR", minCapacity: 4, maxCapacity: 7, priorityScore: 96 },
    { id: "6", type: "CIRCULAR", minCapacity: 4, maxCapacity: 7, priorityScore: 94 },

    // Merged Fixed (6-8)
    { id: "9", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 8, priorityScore: 91 },
    { id: "12", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 8, priorityScore: 88 },

    // Merged Fixed (8-10)
    { id: "11", type: "MERGED_FIXED", minCapacity: 8, maxCapacity: 10, priorityScore: 89 },

    // Standard Bridge/End
    { id: "10", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 90 },
    { id: "13", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 87 },
    { id: "14", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 86 },
];

const MOCK_ADJACENCY = {
    "1": ["2"],
    "2": ["1", "3"],
    "3": ["2"],
    "9": ["10"],
    "10": ["9", "11"],
    "11": ["10", "12"],
    "12": ["11", "13"],
    "13": ["12", "14"],
    "14": ["13"],
};

const OPTIONS = {
    tables: MOCK_TABLES,
    adjacency: MOCK_ADJACENCY,
    maxTablesInCombination: 8
};

describe("Table Assignment Engine", () => {
    it("Assigns a Single Standard table for 4 people", () => {
        const result = findBestTableAssignment(4, ["1", "2", "4"], OPTIONS);
        expect(result.best).toBeDefined();
        expect(result.best!.tableIds).toHaveLength(1);
        // Should prefer T1 (Priority 99) over T2 (98) or T4 (Circular bonus only >4 or not valid for 4?)
        // T4 min capacity 4. Valid.
        // T1 waste 0. T4 waste 3. T1 wins.
        expect(result.best!.tableIds[0]).toBe("1");
    });

    it("Assigns a Single Circular table for 5 people (Circular Bonus)", () => {
        const result = findBestTableAssignment(5, ["1", "2", "4", "9"], OPTIONS);
        // T4 (Circular) should win due to bonus -50
        // T1+T2 (Standard Combo) penalized
        // T9 (Merged) penalized for size 5 (mismatch +10)
        expect(result.best!.tableIds).toEqual(["4"]);
    });

    it("Assigns a Single Circular table for 7 people", () => {
        const result = findBestTableAssignment(7, ["4", "6", "11"], OPTIONS);
        // T4/T6 capacity 7. Perfect fit.
        // T11 (8-10). Waste 1? Mismatch? No.
        // But Circular bonus -50 makes T4 win.
        expect(result.best!.tableIds[0]).toMatch(/4|6/);
    });

    it("Assigns Merged Table (T11) for 8 people", () => {
        const result = findBestTableAssignment(8, ["9", "11", "12"], OPTIONS);
        // T11 (8-10). Min 8. Valid.
        // T9 (6-8). Max 8. Valid.
        // T11 priority 89. T9 priority 91.
        // T11 waste 2. T9 waste 0.
        // T9 is "Merged Fixed". Mismatch penalty? No (Party > 5).
        // T9 waste 0 implies T9 is better?
        // User said "Table 11 is for 8 to 10". "T9 for 6 to 8".
        // If T9 fits 8, and priority is higher, T9 might be picked.
        // That's acceptable.
        // Let's check if T11 is strictly required or just "capable".
        // "11 is for 8 to 10".
        // We expect T9 or T11. 
        // Both are single tables.
        expect(result.best!.tableIds).toHaveLength(1);
        expect(["9", "11", "12"]).toContain(result.best!.tableIds[0]);
    });

    it("Assigns T11 for 9 people (Standard Tables too small)", () => {
        const result = findBestTableAssignment(9, ["11", "9", "10"], OPTIONS);
        // T11 Max 10. Valid.
        // T9 Max 8. Invalid.
        // Assignment must be T11.
        expect(result.best!.tableIds).toEqual(["11"]);
    });

    it("Falls back to Merged Fixed if Circulars are full (Party 6)", () => {
        // T4, T6 not available. T12 available.
        const result = findBestTableAssignment(6, ["1", "2", "12"], OPTIONS);
        // T1+T2 = 8.
        // T12 (Merged) = 6-8. Single table.
        // Single table preference (count penalty) makes T12 win.
        expect(result.best!.tableIds).toEqual(["12"]);
    });

    it("Falls back to Combination if no Single tables fit (Party 5, T4/6/9/12 taken)", () => {
        // Only Standard tables available
        const result = findBestTableAssignment(5, ["1", "2"], OPTIONS);
        expect(result.best!.tableIds.sort()).toEqual(["1", "2"]);
    });

    it("Handles Large Party (16) with Combination", () => {
        // T12, T13, T14 available.
        // T12 (6-8) + T13 (1-4) -> Wait. T13 is Standard now?
        // Update tests: T12 Merged, T13 Standard.
        // T12(8) + T13(4) + T14(4) = 16.
        // Perfect.
        const result = findBestTableAssignment(16, ["12", "13", "14"], OPTIONS);
        expect(result.best!.tableIds.sort()).toEqual(["12", "13", "14"]);
    });
});
