import { findBestTableAssignment } from "../src/services/tableAssignment/engine";
import { TableConfig } from "../src/services/tableAssignment/types";

const MOCK_TABLES: TableConfig[] = [
  { id: "T9", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 12, priorityScore: 100 },
  { id: "T10", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 110 },
  { id: "T11", type: "MERGED_FIXED", minCapacity: 8, maxCapacity: 12, priorityScore: 150 }, // HEAD
  { id: "T12", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 110 },
  { id: "T13", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 12, priorityScore: 100 },
  { id: "T14", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 50 },
  { id: "T7", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 60 },
  { id: "T8", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 60 },
];

const MOCK_ADJACENCY = {
  T7: ["T8"],
  T8: ["T7", "T9"],
  T9: ["T8", "T10"],
  T10: ["T9", "T11"],
  T11: ["T10", "T12"],
  T12: ["T11", "T13"],
  T13: ["T12", "T14"],
  T14: ["T13"],
};

describe("Zone A Tree Structure", () => {
  const options = {
    tables: MOCK_TABLES,
    adjacency: MOCK_ADJACENCY,
  };

  test("Small group (14) should use Short Hand (T11 + Neighbor)", () => {
    // T11 (12) + T10 (4) = 16 or T11 (12) + T12 (4) = 16
    const result = findBestTableAssignment(14, MOCK_TABLES.map(t => t.id), options);
    const best = result.candidates[0].tableIds;
    
    expect(best).toContain("T11");
    expect(best.length).toBe(2);
    expect(best.some(id => ["T10", "T12"].includes(id))).toBe(true);
  });

  test("Large group (24) should use Long Hand (T11 + 2 tables on one side)", () => {
    // T11 (12) + T10 (4) + T9 (12) = 28
    const result = findBestTableAssignment(24, MOCK_TABLES.map(t => t.id), options);
    const best = result.candidates[0].tableIds;
    
    expect(best).toContain("T11");
    // Should be T11, T10, T9 OR T11, T12, T13
    const isLeftLong = best.includes("T11") && best.includes("T10") && best.includes("T9");
    const isRightLong = best.includes("T11") && best.includes("T12") && best.includes("T13");
    expect(isLeftLong || isRightLong).toBe(true);
  });

  test("Isolation Rule: T12 and T14 must never combine", () => {
    // Even if T13 is free and connects them, they should be blocked.
    const result = findBestTableAssignment(14, ["T12", "T13", "T14"], options);
    
    // T12 (4) + T13 (12) = 16 (Valid)
    // T13 (12) + T14 (4) = 16 (Valid)
    // T12 + T13 + T14 = Forbidden
    
    result.candidates.forEach(c => {
      const has12 = c.tableIds.includes("T12");
      const has14 = c.tableIds.includes("T14");
      expect(has12 && has14).toBe(false);
    });
  });

  test("Head Priority: T11 should be preferred over mixed Zone C/A", () => {
    // T9 (12) + T8 (4) = 16 (Mix)
    // T11 (12) + T10 (4) = 16 (Zone A Head)
    const result = findBestTableAssignment(14, ["T8", "T9", "T10", "T11"], options);
    const best = result.candidates[0].tableIds;
    
    expect(best).toContain("T11");
    expect(best).toContain("T10");
    expect(best).not.toContain("T8");
  });
});
