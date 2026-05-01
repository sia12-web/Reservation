import { prisma } from "./prisma";
import { logger } from "./logger";

/**
 * Ensures the database has the required layout and tables.
 * This runs on every server start and creates missing data.
 */
export async function initDb() {
    logger.info("[initDb] Checking database state...");

    // 1. Ensure Layout exists
    let layout = await prisma.layout.findFirst({ where: { isActive: true } });
    const targetAdjacency = {
        T1: ["T2"], T2: ["T1", "T3"], T3: ["T2"], T4: [], T5: [], T6: [],
        T7: ["T8"], T8: ["T7", "T9"], T9: ["T8", "T10"], T10: ["T9", "T11"], T11: ["T10", "T12"],
        T12: ["T11", "T13"], T13: ["T12", "T14"], T14: ["T13"]
    };

    if (!layout) {
        logger.info("[initDb] Creating default layout...");
        layout = await prisma.layout.create({
            data: {
                name: "Main Dining Room",
                isActive: true,
                adjacencyGraph: targetAdjacency,
                effectiveDate: new Date(),
            }
        });
    } else {
        // Sync adjacencyGraph if it changed
        await prisma.layout.update({
            where: { id: layout.id },
            data: { adjacencyGraph: targetAdjacency }
        });
        logger.info("[initDb] Adjacency graph synchronized.");
    }

    // 2. Define Tables
    const tables = [
        { id: "T1", x: 280, y: 480, width: 120, height: 70, shape: "RECTANGLE", min: 1, max: 4, type: "STANDARD", pri: 80 }, // Zone B
        { id: "T2", x: 440, y: 480, width: 120, height: 70, shape: "RECTANGLE", min: 1, max: 4, type: "STANDARD", pri: 80 }, // Zone B
        { id: "T3", x: 600, y: 480, width: 120, height: 70, shape: "RECTANGLE", min: 1, max: 4, type: "STANDARD", pri: 80 }, // Zone B
        { id: "T15", x: 830, y: 450, width: 120, height: 70, shape: "RECTANGLE", min: 1, max: 20, type: "STANDARD", pri: 0 },
        { id: "T7", x: 50, y: 400, width: 120, height: 70, shape: "RECTANGLE", min: 1, max: 4, type: "STANDARD", pri: 60 }, // Zone C
        { id: "T8", x: 50, y: 300, width: 120, height: 70, shape: "RECTANGLE", min: 1, max: 4, type: "STANDARD", pri: 60 }, // Zone C
        { id: "T6", x: 350, y: 330, width: 90, height: 90, shape: "CIRCLE", min: 5, max: 7, type: "CIRCULAR", pri: 2 },
        { id: "T5", x: 500, y: 320, width: 70, height: 110, shape: "RECTANGLE", min: 1, max: 4, type: "STANDARD", pri: 1 },
        { id: "T4", x: 650, y: 330, width: 90, height: 90, shape: "CIRCLE", min: 5, max: 7, type: "CIRCULAR", pri: 2 },
        { id: "T14", x: 830, y: 320, width: 120, height: 70, shape: "RECTANGLE", min: 1, max: 4, type: "STANDARD", pri: 50 },
        { id: "T9", x: 50, y: 50, width: 120, height: 150, shape: "RECTANGLE", min: 6, max: 12, type: "MERGED_FIXED", pri: 100 }, // Zone A
        { id: "T10", x: 220, y: 80, width: 70, height: 110, shape: "RECTANGLE", min: 1, max: 4, type: "STANDARD", pri: 110 }, // Zone A (Inner Hand)
        { id: "T11", x: 350, y: 80, width: 220, height: 70, shape: "RECTANGLE", min: 8, max: 12, type: "MERGED_FIXED", pri: 150 }, // Zone A (HEAD)
        { id: "T12", x: 650, y: 80, width: 70, height: 110, shape: "RECTANGLE", min: 1, max: 4, type: "STANDARD", pri: 110 }, // Zone A (Inner Hand)
        { id: "T13", x: 800, y: 50, width: 120, height: 150, shape: "RECTANGLE", min: 6, max: 12, type: "MERGED_FIXED", pri: 100 }, // Zone A
    ];

    // 3. Sync Tables (Create or Update)
    for (const t of tables) {
        await prisma.table.upsert({
            where: { id_layoutId: { id: t.id, layoutId: layout.id } },
            update: {
                type: t.type as any,
                minCapacity: t.min,
                maxCapacity: t.max,
                priorityScore: t.pri,
                x: t.x, y: t.y, width: t.width, height: t.height, shape: t.shape
            },
            create: {
                id: t.id,
                layoutId: layout.id,
                type: t.type as any,
                minCapacity: t.min,
                maxCapacity: t.max,
                priorityScore: t.pri,
                x: t.x, y: t.y, width: t.width, height: t.height, shape: t.shape
            }
        });
    }

    logger.info("[initDb] Database initialization complete.");
}
