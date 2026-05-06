import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding visual layout...");

    // 1. Deactivate old layouts
    await prisma.layout.updateMany({
        data: { isActive: false },
    });

    // 2. Create new layout
    const layout = await prisma.layout.create({
        data: {
            name: "Visual Floor Plan v1",
            isActive: true, // Make this the active one
            effectiveDate: new Date(),
            adjacencyGraph: {
                // Define adjacent tables for combining
                T7: ["T8a"],
                T8a: ["T7", "T8b"],
                T8b: ["T8a", "T9"], // Bridge Left to Top
                T9: ["T8b", "T10a"],
                T10a: ["T9", "T10b"],
                T10b: ["T10a", "T11", "T13"], // Bridge Top to Middle
                T11: ["T10b", "T12a"],
                T12a: ["T11", "T12b"],
                T12b: ["T12a"],
                T13: ["T10b", "T4"],
            },
        },
    });

    console.log(`Created layout: ${layout.id}`);

    // 3. Define Tables with Coordinates (approx based on image)
    // Canvas: ~1000 x 600

    const tables = [
        // --- Bottom Row ---
        { id: "T6", type: "CIRCULAR", min: 4, max: 7, x: 50, y: 450, w: 80, h: 80, shape: "CIRCLE" },
        { id: "T1", type: "STANDARD", min: 2, max: 2, x: 300, y: 450, w: 100, h: 60, shape: "RECTANGLE", p: 2 }, // Group B
        { id: "T2", type: "STANDARD", min: 2, max: 2, x: 450, y: 450, w: 100, h: 60, shape: "RECTANGLE", p: 2 },
        { id: "T3", type: "STANDARD", min: 2, max: 2, x: 600, y: 450, w: 100, h: 60, shape: "RECTANGLE", p: 2 },

        // --- Circular (Middle) ---
        { id: "T5", type: "STANDARD", min: 2, max: 4, x: 380, y: 300, w: 100, h: 60, shape: "RECTANGLE" }, // Label 5
        { id: "T4", type: "CIRCULAR", min: 4, max: 6, x: 650, y: 300, w: 80, h: 80, shape: "CIRCLE" }, // Label 4

        // --- Left Column ---
        { id: "T7", type: "STANDARD", min: 4, max: 6, x: 50, y: 300, w: 100, h: 60, shape: "RECTANGLE", p: 3 }, // Group C
        { id: "T8a", type: "STANDARD", min: 4, max: 6, x: 50, y: 150, w: 100, h: 60, shape: "RECTANGLE", p: 3 },
        { id: "T8b", type: "STANDARD", min: 4, max: 6, x: 50, y: 50, w: 100, h: 60, shape: "RECTANGLE", p: 3 },

        // --- Top Row ---
        { id: "T9", type: "MERGED_FIXED", min: 6, max: 8, x: 220, y: 50, w: 60, h: 100, shape: "RECTANGLE", p: 3 }, // Group C
        { id: "T10a", type: "STANDARD", min: 2, max: 4, x: 350, y: 50, w: 100, h: 60, shape: "RECTANGLE", p: 5 },
        { id: "T10b", type: "STANDARD", min: 2, max: 4, x: 460, y: 50, w: 100, h: 60, shape: "RECTANGLE", p: 5 },
        { id: "T11", type: "STANDARD", min: 2, max: 4, x: 650, y: 50, w: 60, h: 100, shape: "RECTANGLE", p: 1 }, // Group A

        // --- Right Column (Top) ---
        { id: "T12a", type: "STANDARD", min: 4, max: 6, x: 800, y: 50, w: 100, h: 60, shape: "RECTANGLE", p: 1 }, // Group A
        { id: "T12b", type: "STANDARD", min: 4, max: 6, x: 800, y: 150, w: 100, h: 60, shape: "RECTANGLE", p: 1 }, // Group A

        // --- Extras (No Name / Unlabeled) ---
        // Vertical rect between circles
        { id: "T13", type: "MERGED_FIXED", min: 6, max: 8, x: 520, y: 300, w: 60, h: 80, shape: "RECTANGLE", p: 1 }, // Group A

        // Rect on far right
        { id: "T14", type: "STANDARD", min: 2, max: 4, x: 800, y: 350, w: 100, h: 60, shape: "RECTANGLE" }, // "no name 2"
    ];

    for (const t of tables) {
        await prisma.table.create({
            data: {
                id: t.id,
                layoutId: layout.id,
                type: t.type as any,
                minCapacity: t.min,
                maxCapacity: t.max,
                priorityScore: (t as any).p ?? 10,
                x: t.x,
                y: t.y,
                width: t.w,
                height: t.h,
                shape: t.shape,
            },
        });
    }

    console.log(`Seeded ${tables.length} tables.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
