export type TableType = "STANDARD" | "MERGED_FIXED" | "CIRCULAR";

export interface TableConfig {
  id: string;
  type: TableType;
  minCapacity: number;
  maxCapacity: number;
  priorityScore: number;
  x?: number;
  y?: number;
}

export interface CandidateSet {
  tableIds: string[];
  maxCapacity: number;
  score: number;
}

export interface AssignmentOptions {
  maxTablesInCombination: number;
  tables?: TableConfig[];
  adjacency?: Record<string, string[]>;
}
