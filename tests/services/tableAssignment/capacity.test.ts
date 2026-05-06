
import { findBestTableAssignment, getGeometricCapacity } from "../../../src/services/tableAssignment/engine";
import { TableConfig } from "../../../src/services/tableAssignment/types";

// Mock Data with Units logic implied by Type
// Standard = 1, Merged = 2.
const MOCK_TABLES: TableConfig[] = [
    { id: "10", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 90, x: 100, y: 50 },
    { id: "11", type: "MERGED_FIXED", minCapacity: 8, maxCapacity: 10, priorityScore: 89, x: 200, y: 50 },
    { id: "12", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 8, priorityScore: 88, x: 300, y: 50 },
    { id: "9", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 8, priorityScore: 91, x: 50, y: 50 },
    { id: "1", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 99, x: 100, y: 250 },
    { id: "2", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 98, x: 200, y: 250 },
    { id: "13", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 87, x: 400, y: 250 }, // Vertical? No Y 250 is bottom
    { id: "14", type: "STANDARD", minCapacity: 1, maxCapacity: 4, priorityScore: 86, x: 400, y: 350 }, // below 13?
];

const MOCK_ADJACENCY = {
    "9": ["10"],
    "10": ["9", "11"],
    "11": ["10", "12"], // Connected chain
    "12": ["11"],
    "1": ["2"],
    "2": ["1"],
    "13": ["14"],
    "14": ["13"]
};

const OPTIONS = {
    tables: MOCK_TABLES,
    adjacency: MOCK_ADJACENCY,
    maxTablesInCombination: 8
};

describe("Geometric Capacity Logic", () => {
    it("Single Standard Table = 4", () => {
        const caps = getGeometricCapacity([MOCK_TABLES.find(t => t.id === "1")!]);
        expect(caps).toBe(4);
    });

    it("Single Merged Table = Max Capacity (T11=10)", () => {
        const caps = getGeometricCapacity([MOCK_TABLES.find(t => t.id === "11")!]);
        expect(caps).toBe(10);
    });

    it("2 Standard Tables (Horizontal) = 10 (2 Units)", () => {
        // T1 + T2. Y=250. Aligned.
        // 1+1 = 2 units. Formula(2) -> 10.
        const tables = [MOCK_TABLES.find(t => t.id === "1")!, MOCK_TABLES.find(t => t.id === "2")!];
        const caps = getGeometricCapacity(tables);
        expect(caps).toBe(10);
    });

    it("Standard + Merged (Horizontal) = 15 (3 Units)", () => {
        // T10 (Std) + T11 (Merged). Y=50. Aligned.
        // 1 + 2 = 3 units. Formula(3) -> 15.
        const tables = [MOCK_TABLES.find(t => t.id === "10")!, MOCK_TABLES.find(t => t.id === "11")!];
        const caps = getGeometricCapacity(tables);
        expect(caps).toBe(15);
    });

    it("Standard + Merged + Merged = 24 (5 Units)", () => {
        // T10 + T11 + T12.
        // 1 + 2 + 2 = 5 units. Formula(5) -> 24.
        const tables = [
            MOCK_TABLES.find(t => t.id === "10")!,
            MOCK_TABLES.find(t => t.id === "11")!,
            MOCK_TABLES.find(t => t.id === "12")!
        ];
        const caps = getGeometricCapacity(tables);
        expect(caps).toBe(24);
    });

    it("Vertical Stack (T13 + T14) = Sum (8)", () => {
        // T13 (Y250) + T14 (Y350). Diff 100 > 50.
        // Should be Sum (4+4=8).
        const tables = [MOCK_TABLES.find(t => t.id === "13")!, MOCK_TABLES.find(t => t.id === "14")!];
        const caps = getGeometricCapacity(tables);
        expect(caps).toBe(8);
    });

    it("Finds assignment using Geometric Capacity (15 people -> T10+T11)", () => {
        // 15 people. T10+T11 fits (15).
        // T11 max 10. T10 max 4. Sum 14.
        // Without geometric, would fail.
        const result = findBestTableAssignment(15, ["10", "11"], OPTIONS);
        expect(result.best).toBeDefined();
        expect(result.best!.tableIds.sort()).toEqual(["10", "11"]);
    });
});
