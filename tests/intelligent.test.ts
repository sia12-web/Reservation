
import { findBestTableAssignment } from "../src/services/tableAssignment/engine";
import { TableConfig } from "../src/services/tableAssignment/types";

// The "REAL" specification from initDb.ts and layout.ts
const TABLES: TableConfig[] = [
  { id: "T1", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 }, // Zone B
  { id: "T2", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 }, // Zone B
  { id: "T3", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 }, // Zone B
  { id: "T4", type: "CIRCULAR", minCapacity: 4, maxCapacity: 7, priorityScore: 2 },
  { id: "T5", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 1 },
  { id: "T6", type: "CIRCULAR", minCapacity: 4, maxCapacity: 7, priorityScore: 2 },
  { id: "T7", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 60 }, // Zone C
  { id: "T8", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 60 }, // Zone C
  { id: "T9", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 12, priorityScore: 100 }, // Zone A
  { id: "T10", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 100 }, // Zone A
  { id: "T11", type: "MERGED_FIXED", minCapacity: 8, maxCapacity: 12, priorityScore: 100 }, // Zone A
  { id: "T12", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 100 }, // Zone A
  { id: "T13", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 12, priorityScore: 100 }, // Zone A
  { id: "T14", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 50 },
  { id: "T15", type: "STANDARD", minCapacity: 1, maxCapacity: 20, priorityScore: 0 },
];

const ADJACENCY_GRAPH: Record<string, string[]> = {
  T1: ["T2"],
  T2: ["T1", "T3"],
  T3: ["T2"],
  T4: [],
  T5: [],
  T6: [],
  T7: ["T8"],
  T8: ["T7", "T9"],
  T9: ["T8", "T10"],
  T10: ["T9", "T11"],
  T11: ["T10", "T12"],
  T12: ["T11"],
  T13: ["T14"],
  T14: ["T13"],
};

const OPTIONS = {
    tables: TABLES,
    adjacency: ADJACENCY_GRAPH,
    maxTablesInCombination: 4
};

describe("Intelligent Seating System - Zone Priorities & Special Rules", () => {
  
  describe("1. Zone Priority: A > B > C", () => {
    it("Should prioritize Zone A (Top Wall) for a party of 4 if available", () => {
      // Zone A (T10, T12), Zone B (T1, T2, T3)
      const result = findBestTableAssignment(4, ["T1", "T2", "T10", "T12"], OPTIONS);
      // Both match perfectly (4 seats). 
      // Zone A PRI is 100. Zone B PRI is 80.
      expect(result.best!.tableIds[0]).toMatch(/T10|T12/);
    });

    it("Should prefer Zone B if Zone A is full", () => {
      const result = findBestTableAssignment(4, ["T1", "T2", "T7", "T8"], OPTIONS);
      // Zone B (T1, T2) PRI 80. Zone C (T7, T8) PRI 60.
      expect(result.best!.tableIds[0]).toMatch(/T1|T2/);
    });

    it("Should use Zone C as third choice", () => {
      const result = findBestTableAssignment(4, ["T7", "T8", "T14"], OPTIONS);
      // Zone C (T7, T8) PRI 60. T14 PRI 50.
      expect(result.best!.tableIds[0]).toMatch(/T7|T8/);
    });
  });

  describe("2. T12 & T14 Isolation Rule", () => {
    it("Should NOT combine T12 with T13 or T14", () => {
      // Try to fit 16 people.
      // T12 (4) + T13 (12) = would form 16, but NOT adjecent.
      const available = ["T12", "T13"];
      const result = findBestTableAssignment(16, available, OPTIONS);
      expect(result.best).toBeUndefined(); // Cannot combine T12 + T13
    });
  });

  describe("3. Circular Table Rules", () => {
    it("Should NOT combine Circular tables (T4, T6) with ANY other table", () => {
      const available = ["T4", "T2"];
      const result = findBestTableAssignment(10, available, OPTIONS);
      // T4 + T2 = 7+4 = 11. 
      expect(result.best).toBeUndefined();
    });

    it("Should ONLY use Circular tables for party 5-7", () => {
      const result = findBestTableAssignment(5, ["T4", "T1"], OPTIONS);
      // T4 is prioritized for 5-7 (Circular Bonus -50).
      expect(result.best!.tableIds).toEqual(["T4"]);
    });
  });

  describe("4. Table 15 (Overflow) last resort", () => {
    it("Should only use T15 if ALL other options are exhausted", () => {
      const available = ["T1", "T15"];
      // T1 Prize 80. T15 Pri 0.
      const result = findBestTableAssignment(4, available, OPTIONS);
      expect(result.best!.tableIds).toEqual(["T1"]);
    });

    it("Should use T15 when no other tables fit", () => {
      const result = findBestTableAssignment(15, ["T1", "T2", "T15"], OPTIONS);
      expect(result.best!.tableIds).toEqual(["T15"]);
    });
  });

});
