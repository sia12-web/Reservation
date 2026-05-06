
import { findBestTableAssignment } from "../../../src/services/tableAssignment/engine";
import { TableConfig } from "../../../src/services/tableAssignment/types";

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

    // Merged Fixed (8-10) - Corrected minCapacity to 8
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
        expect(result.best!.tableIds[0]).toBe("1");
    });

    it("Assigns a Single Circular table for 5 people (Circular Bonus)", () => {
        const result = findBestTableAssignment(5, ["1", "2", "4", "9"], OPTIONS);
        // T4 (Circular) should win due to bonus -50
        expect(result.best!.tableIds).toEqual(["4"]);
    });

    it("Assigns a Single Circular table for 7 people", () => {
        const result = findBestTableAssignment(7, ["4", "6", "11"], OPTIONS);
        expect(result.best!.tableIds[0]).toMatch(/4|6/);
    });

    it("Assigns merged T11 or T9 for 8 people", () => {
        const result = findBestTableAssignment(8, ["9", "11", "12"], OPTIONS);
        // T11 (8-10) is valid. T9 (6-8) is valid.
        // T11 priority 89. T9 priority 91.
        // Priority Adjustment (-priority * 0.1).
        // T9 (-9.1) is BETTER than T11 (-8.9).
        // So it might pick T9.
        // Both are acceptable single tables.
        expect(result.best!.tableIds).toHaveLength(1);
        expect(["9", "11", "12"]).toContain(result.best!.tableIds[0]);
    });

    it("Assigns T11 for 9 people (Standard Tables too small)", () => {
        const result = findBestTableAssignment(9, ["11", "9", "10"], OPTIONS);
        expect(result.best!.tableIds).toEqual(["11"]);
    });

    it("Falls back to Merged Fixed if Circulars are full (Party 6)", () => {
        const result = findBestTableAssignment(6, ["1", "2", "12"], OPTIONS);
        expect(result.best!.tableIds).toEqual(["12"]);
    });

    it("Falls back to Combination if no Single tables fit (Party 5, T4/6/9/12 taken)", () => {
        const result = findBestTableAssignment(5, ["1", "2"], OPTIONS);
        expect(result.best!.tableIds.sort()).toEqual(["1", "2"]);
    });

    it("Handles Large Party (16) with Combination", () => {
        // T12 (Merged 8), T13 (Standard 4), T14 (Standard 4).
        // Wait. T12 is 6-8. T13 is 1-4. T14 is 1-4.
        // 8 + 4 + 4 = 16.
        // Min Capacity Sum?
        // T12(6) + T13(1) + T14(1) = 8.
        // Party size 16. 
        // Min cap 8 <= 16. Ok.
        // Result should be T12, T13, T14.
        const result = findBestTableAssignment(16, ["12", "13", "14"], OPTIONS);
        expect(result.best!.tableIds.sort()).toEqual(["12", "13", "14"]);
    });
});
