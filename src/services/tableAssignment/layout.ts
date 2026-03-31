import { TableConfig } from "./types";

// Note: This file is a fallback/reference. The source of truth is the Database.
export const TABLES: TableConfig[] = [
  { id: "T1", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 },
  { id: "T2", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 },
  { id: "T3", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 },
  { id: "T4", type: "CIRCULAR", minCapacity: 4, maxCapacity: 7, priorityScore: 2 },
  { id: "T5", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 1 },
  { id: "T6", type: "CIRCULAR", minCapacity: 4, maxCapacity: 7, priorityScore: 2 },
  { id: "T7", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 },
  { id: "T8", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 80 },
  { id: "T9", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 12, priorityScore: 100 },
  { id: "T10", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 110 },
  { id: "T11", type: "MERGED_FIXED", minCapacity: 8, maxCapacity: 12, priorityScore: 150 },
  { id: "T12", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 110 },
  { id: "T13", type: "MERGED_FIXED", minCapacity: 6, maxCapacity: 12, priorityScore: 100 },
  { id: "T14", type: "STANDARD", minCapacity: 2, maxCapacity: 4, priorityScore: 50 },
  { id: "T15", type: "STANDARD", minCapacity: 1, maxCapacity: 20, priorityScore: 0 },
];

export const ADJACENCY_GRAPH: Record<string, string[]> = {
  T1: ["T2"],
  T2: ["T1", "T3"],
  T3: ["T2"],
  T4: [],
  T5: [],
  T6: ["T5", "T7"],
  T7: ["T8", "T6"],
  T8: ["T7", "T9"],
  T9: ["T8", "T10"],
  T10: ["T9", "T11"],
  T11: ["T10", "T12"],
  T12: ["T11", "T13"],
  T13: ["T12", "T14"],
  T14: ["T13"],
};
