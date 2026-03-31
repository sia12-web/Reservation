import { findBestTableAssignment } from "../src/services/tableAssignment/engine";

describe("table assignment engine", () => {

  // Mock Configuration to ensure tests are deterministic
  const MOCK_TABLES = [
    { id: "T1", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 1 },
    { id: "T2", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 1 },
    { id: "T3", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 1 },
    { id: "T9", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 8, priorityScore: 3 },
    { id: "T10", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 1 },
    { id: "T11", type: "MERGED_FIXED", minCapacity: 8, maxCapacity: 12, priorityScore: 3 },
  ] as any[];

  const MOCK_ADJACENCY: Record<string, string[]> = {
    T1: ["T9"],
    T9: ["T1", "T10"],
    T10: ["T9", "T11"],
    T11: ["T10"],
  };

  const options = {
    tables: MOCK_TABLES,
    adjacency: MOCK_ADJACENCY,
  };

  test("Case A: party of 2 prefers T1 over T9", () => {
    const available = ["T1", "T9"];
    // T1: max 4, score ~0. T9: max 8 (waste 6) -> T1 wins
    const result = findBestTableAssignment(2, available, options);

    expect(result.best?.tableIds).toEqual(["T1"]);
  });

  test("Case B: party of 8 finds T11", () => {
    // T11 max 12. Fits 8.
    const available = ["T1", "T2", "T3", "T10", "T11"];
    const result = findBestTableAssignment(8, available, options);

    expect(result.best?.tableIds).toEqual(["T11"]);
  });

  test("Case C: party of 12 finds [T10, T9]", () => {
    const available = ["T9", "T10", "T11"];

    // We want to force combination [T9, T10].
    // With default mock T11 (max 12), it would be chosen (0 waste).
    // So we reduce T11 maxCapacity to 10 for this test case so it fails for 12 pax.
    const modifiedTables = MOCK_TABLES.map(t => t.id === "T11" ? { ...t, maxCapacity: 10 } : t);

    const result = findBestTableAssignment(12, available, { ...options, tables: modifiedTables });

    // T9 (max 8) + T10 (max 4). T9 is MERGED_FIXED(2 units), T10 STANDARD(1 unit).
    // Total 3 units -> 15 capacity. Fits 12.
    // T11 (max 10) -> Too small.
    // Expect [T10, T9] or [T9, T10] (order depends on sort)

    expect(result.best?.tableIds).toEqual(expect.arrayContaining(["T9", "T10"]));
  });
});
