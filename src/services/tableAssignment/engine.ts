import { ADJACENCY_GRAPH, TABLES } from "./layout";
import { AssignmentOptions, CandidateSet, TableConfig, TableType } from "./types";

const DEFAULT_OPTIONS: AssignmentOptions = {
  maxTablesInCombination: 3,
  tables: TABLES,
  adjacency: ADJACENCY_GRAPH,
};

export interface AssignmentResult {
  candidates: CandidateSet[];
  best?: CandidateSet;
}

export function getMaxTablesForParty(partySize: number): number {
  if (partySize <= 10) return 2;
  if (partySize <= 15) return 3;
  if (partySize <= 22) return 4;
  if (partySize <= 35) return 8;
  return 10;
}

export function findBestTableAssignment(
  partySize: number,
  availableTableIds: string[],
  options: Partial<AssignmentOptions> = {}
): AssignmentResult {
  const mergedOptions = { 
    ...DEFAULT_OPTIONS, 
    maxTablesInCombination: getMaxTablesForParty(partySize),
    ...options 
  };
  const tables = mergedOptions.tables ?? TABLES;
  const adjacency = mergedOptions.adjacency ?? ADJACENCY_GRAPH;
  const tableMap = new Map(tables.map((table) => [table.id, table]));
  const eligibleTables = buildEligibleTables(partySize, availableTableIds, tableMap);

  const candidates = [
    ...generateSingleTableCandidates(partySize, eligibleTables),
    ...generateCombinationCandidates(partySize, eligibleTables, mergedOptions, tableMap, adjacency),
  ];

  const sorted = candidates.sort(
    (a, b) => a.score - b.score || a.tableIds[0].localeCompare(b.tableIds[0], undefined, { numeric: true })
  );
  return { candidates: sorted, best: sorted[0] };
}

function buildEligibleTables(
  partySize: number,
  availableTableIds: string[],
  tableMap: Map<string, TableConfig>
): TableConfig[] {
  const availableSet = new Set(availableTableIds);

  return Array.from(tableMap.values()).filter((table) => {
    if (!availableSet.has(table.id)) return false;
    if (table.minCapacity > partySize) return false;
    // Circular tables are for parties of 5-7 only (business rule)
    if (table.type === "CIRCULAR" && (partySize < 5 || partySize > 7)) return false;
    return true;
  });
}

function generateSingleTableCandidates(
  partySize: number,
  eligibleTables: TableConfig[]
): CandidateSet[] {
  return eligibleTables
    .filter((table) => table.maxCapacity >= partySize)
    .map((table) => buildCandidate([table], partySize));
}

function generateCombinationCandidates(
  partySize: number,
  eligibleTables: TableConfig[],
  options: AssignmentOptions,
  tableMap: Map<string, TableConfig>,
  adjacency: Record<string, string[]>
): CandidateSet[] {
  const eligibleSet = new Set(eligibleTables.map((table) => table.id));
  const candidates: CandidateSet[] = [];
  const seen = new Set<string>();

  for (const table of eligibleTables) {
    const stack: string[][] = [[table.id]];

    while (stack.length > 0) {
      const path = stack.pop();
      if (!path) continue;

      if (path.length > 1) {
        const tables = path.map((id) => tableMap.get(id)).filter(Boolean) as TableConfig[];
        const total = getGeometricCapacity(tables);

        if (total >= partySize) {
          const candidate = buildCandidate(tables, partySize);
          const key = candidate.tableIds.join(",");
          if (!seen.has(key)) {
            seen.add(key);
            candidates.push(candidate);
          }
        }
      }

      if (path.length >= options.maxTablesInCombination) continue;

      const last = path[path.length - 1];
      const neighbors = adjacency[last] ?? [];

      for (const neighbor of neighbors) {
        if (!eligibleSet.has(neighbor)) continue;
        if (path.includes(neighbor)) continue;

        const tablesInPath = path.map((id) => tableMap.get(id)).filter(Boolean) as TableConfig[];
        if (wouldCombineCircular(tablesInPath, neighbor, tableMap)) continue;

        stack.push([...path, neighbor]);
      }
    }
  }

  return candidates;
}

function buildCandidate(tables: TableConfig[], partySize: number): CandidateSet {
  const sortedIds = [...tables]
    .map((table) => table.id)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const totalCapacity = getGeometricCapacity(tables);
  const score = scoreCandidate(tables, partySize);

  return {
    tableIds: sortedIds,
    maxCapacity: totalCapacity,
    score,
  };
}

function scoreCandidate(tables: TableConfig[], partySize: number): number {
  const totalCapacity = getGeometricCapacity(tables);
  const waste = totalCapacity - partySize;

  // Heavily penalize multiple tables to favor single-table solutions
  const tableCountPenalty = (tables.length - 1) * 150; // Increased to 150 to strongly favor single tables over priority gaps

  const mismatchPenalty = tables.reduce((sum, table) => {
    // Penalize using a large Merged Fixed table for very small groups if not needed
    if (table.type === "MERGED_FIXED" && partySize <= 5) return sum + 10;
    return sum;
  }, 0);

  // const fragmentPenalty = calculateTopChainFragmentPenalty(tables);
  const circularPenalty = tables.some((table) => table.type === "CIRCULAR") && tables.length > 1 ? 100 : 0;

  // Bonus for using Circular tables for their ideal range (4-7)
  let circularBonus = 0;
  if (tables.length === 1 && tables[0].type === "CIRCULAR" && partySize >= 5 && partySize <= 7) {
    circularBonus = -50;
  }

  // Generalized Bonus for using "Premium" or "High Priority" tables for larger groups
  // This rewards the restaurant's preferred seating arrangement
  const bigTableBonus = tables.reduce((sum, t) => {
    if (t.priorityScore > 50 && partySize >= 8) return sum - 5;
    return sum;
  }, 0);

  const fragmentPenalty = calculateTopChainFragmentPenalty(tables);
  // Use average priority instead of sum to avoid favoring combinations
  const avgPriority = tables.reduce((sum, table) => sum + table.priorityScore, 0) / tables.length;

  // ABSOLUTELY MASSIVE priority adjustment to force Zone A > B > C
  // With a multiplier of 10, a group at Zone A (pri 100) gets -1000 bonus.
  // Zone B (pri 80) gets -800. The 200-point gap overrides ALWAYS.
  const priorityAdjustment = -avgPriority * 10.0;

  // Explicit semi-ban on Priority 0 (Overflow) tables unless necessary
  // If avgPriority is low (e.g. 0), we add a massive penalty to make it a LAST RESORT
  const lowPriorityPenalty = avgPriority < 0.5 ? 500 : 0;

  return (
    waste +
    tableCountPenalty +
    mismatchPenalty +
    fragmentPenalty +
    circularPenalty +
    circularBonus +
    bigTableBonus +
    priorityAdjustment +
    lowPriorityPenalty
  );
}

function wouldCombineCircular(
  tablesInPath: TableConfig[],
  candidateId: string,
  tableMap: Map<string, TableConfig>
): boolean {
  const candidate = tableMap.get(candidateId);
  if (!candidate) return true;

  // Relaxation: Allow Circular tables (like T4, T6) to be merged with Standard tables
  // but prevent them from being the "middle" of a long chain if possible.
  // Table T5 remains strictly standalone as requested before.
  if (candidate.id === "T5") return true;
  if (tablesInPath.some(t => t.id === "T5")) return true;

  // Isolation Rule: T12 and T14 cannot be in the same combination
  if (candidate.id === "T12" && tablesInPath.some(t => t.id === "T14")) return true;
  if (candidate.id === "T14" && tablesInPath.some(t => t.id === "T12")) return true;

  return false;
}

export function getTableType(tableId: string): TableType | undefined {
  const table = (DEFAULT_OPTIONS.tables ?? TABLES).find((t) => t.id === tableId);
  return table?.type;
}

function calculateTopChainFragmentPenalty(
  _tables: TableConfig[],
  adjacency?: Record<string, string[]>
): number {
  if (!adjacency || _tables.length === 1) return 0;

  let penalty = 0;

  // Penalize a combination if it includes tables that are NOT adjacent in the graph
  // though the generator already handles adjacency.
  // Instead, let's penalize "orphaning" a table's neighbor that has a very high priority.
  // Actually, the simplest way is to penalize fragmented selections.

  return penalty;
}

function getTableUnits(table: TableConfig): number {
  // Merged Fixed tables count as 2 units (e.g. T9, T11, T12)
  if (table.type === "MERGED_FIXED") return 2;
  return 1;
}

export function getGeometricCapacity(tables: TableConfig[]): number {
  if (tables.length === 0) return 0;
  if (tables.length === 1) return tables[0].maxCapacity;

  // Horizontal/Vertical Layout check:
  // If tables are vertically stacked (Y diff > 50), capacity is simply the sum.
  // This prevents over-imagining joined capacities in aisles.
  const yValues = tables.map(t => t.y).filter(y => y !== undefined) as number[];
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const isVertical = yValues.length > 1 && (maxY - minY) > 50;

  if (isVertical) {
    return tables.reduce((sum, t) => sum + t.maxCapacity, 0);
  }

  const totalUnits = tables.reduce((sum, t) => sum + getTableUnits(t), 0);

  if (totalUnits <= 1) return tables[0].maxCapacity;

  // Formula alternates +5, +4, +5, +4...
  // 2 units -> 10
  // 3 units -> 15 (+5)
  // 4 units -> 19 (+4)
  // 5 units -> 24 (+5)
  // 6 units -> 28 (+4)
  let capacity = 10;
  for (let u = 3; u <= totalUnits; u++) {
    const increment = u % 2 === 1 ? 5 : 4;
    capacity += increment;
  }
  return capacity;
}
