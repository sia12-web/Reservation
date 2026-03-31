import { findBestTableAssignment } from "../src/services/tableAssignment/engine";
import { TableConfig } from "../src/services/tableAssignment/types";

// PROPER SPECIFICATION (Matches initDb.ts and layout.ts)
const TABLES: TableConfig[] = [
  { id: "T1", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 }, // Zone B
  { id: "T2", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 }, // Zone B
  { id: "T3", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 }, // Zone B
  { id: "T4", type: "CIRCULAR", minCapacity: 4, maxCapacity: 7, priorityScore: 2 },
  { id: "T5", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 1 },
  { id: "T6", type: "CIRCULAR", minCapacity: 4, maxCapacity: 7, priorityScore: 2 },
  { id: "T7", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 60 }, // Zone C
  { id: "T8", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 60 }, // Zone C
  { id: "T9", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 12, priorityScore: 100 }, // Zone A (Hand)
  { id: "T10", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 110 }, // Zone A (Inner Hand)
  { id: "T11", type: "MERGED_FIXED", minCapacity: 8, maxCapacity: 12, priorityScore: 150 }, // Zone A (HEAD)
  { id: "T12", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 110 }, // Zone A (Inner Hand)
  { id: "T13", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 12, priorityScore: 100 }, // Zone A (Hand)
  { id: "T14", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 50 },
  { id: "T15", type: "STANDARD", minCapacity: 1, maxCapacity: 20, priorityScore: 0 }, // Overflow
];

const ADJACENCY_GRAPH: Record<string, string[]> = {
  T1: ["T2"], T2: ["T1", "T3"], T3: ["T2"],
  T4: [], T5: [], T6: [],
  T7: ["T8"], T8: ["T7", "T9"],
  T9: ["T8", "T10"], 
  T10: ["T9", "T11"], 
  T11: ["T10", "T12"], 
  T12: ["T11", "T13"],
  T13: ["T12", "T14"], 
  T14: ["T13"],
};

const OPTIONS = {
    tables: TABLES,
    adjacency: ADJACENCY_GRAPH,
};

describe("Diba Seating Engine - Full Specification Tests", () => {
  
  describe("1. Zone Hierarchy (A > B > C)", () => {
    it("Should fill Zone A (T11 head) before any other zone", () => {
      // Party of 8. Zone A (T11) is PRI 150. Zone B (T1+T2) is PRI 80.
      const available = ["T1", "T2", "T3", "T11"];
      const result = findBestTableAssignment(8, available, OPTIONS);
      expect(result.best!.tableIds).toEqual(["T11"]);
    });

    it("Should prefer Zone B over Zone C", () => {
      const available = ["T7", "T8", "T1", "T2"];
      const result = findBestTableAssignment(4, available, OPTIONS);
      expect(["T1", "T2"]).toContain(result.best!.tableIds[0]);
    });
  });

  describe("2. Zone A 'Tree' Branching", () => {
    it("Small Group (14): Anchors to T11 and picks a Short Hand neighbor (T10 or T12)", () => {
      const result = findBestTableAssignment(14, ["T9", "T10", "T11", "T12", "T13"], OPTIONS);
      const ids = result.best!.tableIds;
      expect(ids).toContain("T11");
      expect(ids.length).toBe(2);
      expect(ids).toContain(ids.includes("T10") ? "T10" : "T12");
    });

    it("Large Group (24): Correctly forms Long Left Hand (T11 + T10 + T9)", () => {
        // T11 (2 units) + T10 (1 unit) + T9 (2 units) = 5 units = 24 capacity
        const result = findBestTableAssignment(24, ["T9", "T10", "T11"], OPTIONS);
        expect(result.best!.tableIds).toContain("T11");
        expect(result.best!.tableIds).toContain("T10");
        expect(result.best!.tableIds).toContain("T9");
    });

    it("Large Group (24): Correctly forms Long Right Hand (T11 + T12 + T13)", () => {
        // T11 (2 units) + T12 (1 unit) + T13 (2 units) = 5 units = 24 capacity
        const result = findBestTableAssignment(24, ["T11", "T12", "T13"], OPTIONS);
        expect(result.best!.tableIds).toContain("T11");
        expect(result.best!.tableIds).toContain("T12");
        expect(result.best!.tableIds).toContain("T13");
    });
  });

  describe("3. Structural Isolation (T12 / T14 Rule)", () => {
    it("Strictly forbids combining T12 and T14 even with T13 in between", () => {
      const available = ["T12", "T13", "T14"];
      // T12 (1) + T13 (2) + T14 (1) = 4 units = 19 capacity.
      // We'll search for 15+ to ensure it's not a single table solution.
      const result = findBestTableAssignment(15, available, OPTIONS);
      
      // Candidates must NEVER contain both 12 and 14.
      result.candidates.forEach(c => {
          const has12 = c.tableIds.includes("T12");
          const has14 = c.tableIds.includes("T14");
          expect(has12 && has14).toBe(false);
      });
    });
  });

  describe("4. Global Optimization Tiers", () => {
    it("Assigns a Tier 1 score (<-1000) to Zone A groups", () => {
      const result = findBestTableAssignment(20, ["T11", "T12", "T13"], OPTIONS);
      expect(result.best!.score).toBeLessThan(-1000);
    });

    it("Assigns a Tier 3 score (>400) to Overflow groups (T15)", () => {
      const result = findBestTableAssignment(20, ["T15"], OPTIONS);
      expect(result.best!.score).toBeGreaterThan(400); 
    });
  });

  describe("5. Capacity Limits", () => {
    it("Respects max combinations (Max 6 tables for 32 people)", () => {
      // Trying to book 32 people with only small tables (Capacity 4 each)
      // Needs 8 tables.
      const available = ["T1", "T2", "T3", "T7", "T8", "T10", "T12", "T14"];
      const result = findBestTableAssignment(32, available, OPTIONS);
      // Even if available, getMaxTablesForParty(32) should return 6 or 7.
      // So it should fail to find a valid combo of 8 tables.
      expect(result.best).toBeUndefined();
    });
  });

});
