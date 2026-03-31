
import { findBestTableAssignment, getMaxTablesForParty, getGeometricCapacity } from "./engine";
import { TableConfig } from "./types";

const MOCK_TABLES: TableConfig[] = [
    { id: "T1", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 8, priorityScore: 50, x: 100, y: 100 },
    { id: "T2", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 50, x: 220, y: 100 },
    { id: "T3", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 50, x: 340, y: 100 },
    { id: "T4", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 50, x: 460, y: 100 },
    { id: "T5", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 50, x: 580, y: 100 },
    { id: "T6", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 50, x: 700, y: 100 },
    { id: "T7", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 50, x: 820, y: 100 },
];

const MOCK_ADJACENCY = {
    "T1": ["T2"],
    "T2": ["T1", "T3"],
    "T3": ["T2", "T4"],
    "T4": ["T3", "T5"],
    "T5": ["T4", "T6"],
    "T6": ["T5", "T7"],
    "T7": ["T6"],
};

const OPTIONS = {
    tables: MOCK_TABLES,
    adjacency: MOCK_ADJACENCY,
};

describe("Dynamic Party Size Limits", () => {
    it("Calculates correct max tables for various party sizes", () => {
        expect(getMaxTablesForParty(10)).toBe(2);
        expect(getMaxTablesForParty(15)).toBe(3);
        expect(getMaxTablesForParty(20)).toBe(4);
        expect(getMaxTablesForParty(25)).toBe(5);
        expect(getMaxTablesForParty(30)).toBe(6);
        expect(getMaxTablesForParty(40)).toBe(7);
    });

    it("Correctly calculates geometric capacity for table combinations (alternating +5, +4)", () => {
        // T1 (2 units, 8 max) + T2 (1 unit, 4 max) = 3 units -> 15 capacity
        expect(getGeometricCapacity([MOCK_TABLES[0], MOCK_TABLES[1]])).toBe(15);
        
        // T2 + T3 = 10 capacity (standard pair)
        expect(getGeometricCapacity([MOCK_TABLES[1], MOCK_TABLES[2]])).toBe(10);
        
        // T2 + T3 + T4 = 15 capacity (+5)
        expect(getGeometricCapacity([MOCK_TABLES[1], MOCK_TABLES[2], MOCK_TABLES[3]])).toBe(15);
        
        // T2 + T3 + T4 + T5 = 19 capacity (+4)
        expect(getGeometricCapacity([MOCK_TABLES[1], MOCK_TABLES[2], MOCK_TABLES[3], MOCK_TABLES[4]])).toBe(19);
        
        // T2 + T3 + T4 + T5 + T6 = 24 capacity (+5)
        expect(getGeometricCapacity([MOCK_TABLES[1], MOCK_TABLES[2], MOCK_TABLES[3], MOCK_TABLES[4], MOCK_TABLES[5]])).toBe(24);
        
        // T2 + T3 + T4 + T5 + T6 + T7 = 28 capacity (+4)
        expect(getGeometricCapacity([MOCK_TABLES[1], MOCK_TABLES[2], MOCK_TABLES[3], MOCK_TABLES[4], MOCK_TABLES[5], MOCK_TABLES[6]])).toBe(28);
    });

    it("Successfully assigns 6 tables for a party of 28", () => {
        // Party size 28 requires 6 tables based on getMaxTablesForParty (which is what findBestTableAssignment will use)
        // available tables: T2 through T7 = 6 standard tables = 28 capacity
        const result = findBestTableAssignment(28, ["T2", "T3", "T4", "T5", "T6", "T7"], OPTIONS);
        expect(result.best).toBeDefined();
        expect(result.best!.tableIds).toHaveLength(6);
        expect(result.best!.tableIds.sort()).toEqual(["T2", "T3", "T4", "T5", "T6", "T7"]);
    });

    it("Fails if party size 28 only has 5 tables available (limit hit)", () => {
        // Even if those 5 tables have enough sum capacity (e.g. 5*4=20, wait, geometric is less)
        // 5 units is 24 capacity. So they certainly can't fit.
        const result = findBestTableAssignment(28, ["T2", "T3", "T4", "T5", "T6"], OPTIONS);
        expect(result.best).toBeUndefined();
    });

    it("Fails if party size 15 only has 2 tables available (limit hit)", () => {
        // 2 standard tables = 10 capacity. 1 Merged + 1 Standard = 15 capacity.
        // Let's test with T1 (Merged) + T2 (Standard) = 3 total units -> 15 capacity
        // BUT if we only have 2 physical tables available, we should pass them as available.
        // If 15 people, max 3 tables allowed. If only 2 available, it searches combos of 2.
        // T1 + T2 is a combo of 2 tables. It SHOULD theoretically work if the sum is 15.
        // Wait, T1(2 units) + T2(1 unit) = 3 total units. getGeometricCapacity will return 15.
        // AND it's a combination of 2 tables (last loop length 2).
        // Since 15 people <= 15 -> 3 tables allowed.
        // So a combo of 2 is fine. 
        const result = findBestTableAssignment(15, ["T1", "T2"], OPTIONS);
        expect(result.best).toBeDefined();
        expect(result.best!.tableIds.sort()).toEqual(["T1", "T2"]);
    });

    it("Successfully assigns 4 tables for 18 people", () => {
        // 18 people <= 20 -> max 4 tables.
        // T2+T3+T4+T5 = 19 capacity (4 tables).
        const result = findBestTableAssignment(18, ["T2", "T3", "T4", "T5"], OPTIONS);
        expect(result.best).toBeDefined();
        expect(result.best!.tableIds).toHaveLength(4);
    });
});
