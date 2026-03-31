import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log("Seeding started...");

    // 1. Ensure Layout exists
    let layout = await prisma.layout.findFirst({ where: { isActive: true } });
    if (!layout) {
        console.log("Creating default layout...");
        layout = await prisma.layout.create({
            data: {
                name: "Main Dining Room",
                isActive: true,
                adjacencyGraph: {
                    T1: ["T2"], T2: ["T1", "T3"], T3: ["T2"], T4: ["T5"], T5: ["T4", "T6"], T6: ["T5"],
                    T7: ["T8"], T8: ["T7", "T9"], T9: ["T8", "T10"], T10: ["T9", "T11"], T11: ["T10", "T12"],
                    T12: ["T11", "T13"], T13: ["T12"], T14: []
                },
                effectiveDate: new Date(),
            }
        });
    }

    // 2. Define Tables
    const tables = [
        { id: "T1", x: 280, y: 480, width: 120, height: 70, shape: "RECTANGLE", min: 2, max: 4, type: "STANDARD", pri: 1 },
        { id: "T2", x: 440, y: 480, width: 120, height: 70, shape: "RECTANGLE", min: 2, max: 4, type: "STANDARD", pri: 1 },
        { id: "T3", x: 600, y: 480, width: 120, height: 70, shape: "RECTANGLE", min: 2, max: 4, type: "STANDARD", pri: 1 },
        { id: "T15", x: 830, y: 450, width: 120, height: 70, shape: "RECTANGLE", min: 1, max: 20, type: "STANDARD", pri: 0 }, // Optional Table
        { id: "T7", x: 50, y: 400, width: 120, height: 70, shape: "RECTANGLE", min: 2, max: 4, type: "STANDARD", pri: 1 },
        { id: "T8", x: 50, y: 300, width: 120, height: 70, shape: "RECTANGLE", min: 2, max: 4, type: "STANDARD", pri: 1 },
        { id: "T6", x: 350, y: 330, width: 90, height: 90, shape: "CIRCLE", min: 4, max: 7, type: "CIRCULAR", pri: 2 },
        { id: "T5", x: 500, y: 320, width: 70, height: 110, shape: "RECTANGLE", min: 2, max: 4, type: "STANDARD", pri: 1 },
        { id: "T4", x: 650, y: 330, width: 90, height: 90, shape: "CIRCLE", min: 4, max: 7, type: "CIRCULAR", pri: 2 },
        { id: "T14", x: 830, y: 320, width: 120, height: 70, shape: "RECTANGLE", min: 2, max: 4, type: "STANDARD", pri: 1 },
        { id: "T9", x: 50, y: 50, width: 120, height: 150, shape: "RECTANGLE", min: 6, max: 12, type: "MERGED_FIXED", pri: 3 },
        { id: "T10", x: 220, y: 80, width: 70, height: 110, shape: "RECTANGLE", min: 2, max: 4, type: "STANDARD", pri: 1 },
        { id: "T11", x: 350, y: 80, width: 220, height: 70, shape: "RECTANGLE", min: 8, max: 12, type: "MERGED_FIXED", pri: 3 },
        { id: "T12", x: 650, y: 80, width: 70, height: 110, shape: "RECTANGLE", min: 2, max: 4, type: "STANDARD", pri: 1 },
        { id: "T13", x: 800, y: 50, width: 120, height: 150, shape: "RECTANGLE", min: 6, max: 12, type: "MERGED_FIXED", pri: 3 },
    ];

    // 3. Upsert Tables (Create if missing)
    console.log("Upserting tables...");
    for (const t of tables) {
        const existing = await prisma.table.findUnique({
            where: {
                id_layoutId: {
                    id: t.id,
                    layoutId: layout.id
                }
            }
        });
        if (!existing) {
            await prisma.table.create({
                data: {
                    id: t.id,
                    type: t.type as "STANDARD" | "CIRCULAR" | "MERGED_FIXED",
                    x: t.x, y: t.y, width: t.width, height: t.height, shape: t.shape,
                    minCapacity: t.min, maxCapacity: t.max, priorityScore: t.pri,
                    layoutId: layout.id,
                }
            });
            console.log(`Created table ${t.id}`);
        }
    }

    console.log("Seeding complete.");
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
