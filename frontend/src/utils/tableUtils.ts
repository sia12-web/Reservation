export interface TableSimple {
    type: string;
    maxCapacity: number;
}

function getTableUnits(table: TableSimple): number {
    if (table.type === "MERGED_FIXED") return 2;
    if (table.maxCapacity >= 6) return 2;
    return 1;
}

export function getGeometricCapacity(tables: TableSimple[]): number {
    if (!tables || tables.length === 0) return 0;
    if (tables.length === 1) return tables[0].maxCapacity;

    const totalUnits = tables.reduce((sum, t) => sum + getTableUnits(t), 0);

    if (totalUnits <= 1) return tables[0].maxCapacity;

    // Formula: 2->10, 3->15, 4->19, 5->24, 6->28...
    // Base 2 units = 10.
    let capacity = 10;
    for (let u = 3; u <= totalUnits; u++) {
        // Simplified: Always +5 per unit
        capacity += 5;
    }
    return capacity;
}
