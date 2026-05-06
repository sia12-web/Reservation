const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Starting seed...")
    try {
        // Cleanup existing data
        await prisma.reservationTable.deleteMany({})
        await prisma.table.deleteMany({})
        await prisma.layout.deleteMany({})

        // Define Adjacency Graph (Connected tables)
        // Circular tables (4, 6) are excluded.
        // Merged tables (9, 11, 13) are single nodes.
        const adjacencyGraph = {
            "1": ["2"],
            "2": ["1", "3"],
            "3": ["2"],
            "7": ["8"],
            "8": ["7"],
            "9": ["10"],
            "10": ["9", "11"],
            "11": ["10", "12"],
            "12": ["11", "13"],
            "13": ["12", "14"],
            "14": ["13"]
        };

        const layout = await prisma.layout.create({
            data: {
                name: "Main Floor",
                isActive: true,
                adjacencyGraph,
                effectiveDate: new Date(),
            }
        })

        // Tables configuration
        // Canvas roughly 1000x600
        const tables = [
            // --- Top Row ---
            // 9: Merged Fixed (Stacked)
            { id: "9", type: "MERGED_FIXED", x: 80, y: 50, width: 100, height: 110, shape: "RECTANGLE", minCapacity: 6, maxCapacity: 8 },

            // 10: Standard Vertical
            { id: "10", type: "STANDARD", x: 240, y: 60, width: 60, height: 90, shape: "RECTANGLE", minCapacity: 1, maxCapacity: 4 },

            // 11: Merged Fixed (Side-by-side)
            { id: "11", type: "MERGED_FIXED", x: 380, y: 70, width: 190, height: 60, shape: "RECTANGLE", minCapacity: 8, maxCapacity: 10 },

            // 12: Standard Vertical (Middle, next to T11) - Matches T10 dimensions
            { id: "12", type: "STANDARD", x: 650, y: 60, width: 60, height: 90, shape: "RECTANGLE", minCapacity: 1, maxCapacity: 4 },

            // 13: Merged Fixed (Stacked) (Right, next to T12) - Matches T9 dimensions
            { id: "13", type: "MERGED_FIXED", x: 820, y: 50, width: 100, height: 110, shape: "RECTANGLE", minCapacity: 6, maxCapacity: 8 },

            // --- Left Side ---
            { id: "8", type: "STANDARD", x: 80, y: 250, width: 100, height: 60, shape: "RECTANGLE", minCapacity: 1, maxCapacity: 4 },
            { id: "7", type: "STANDARD", x: 80, y: 350, width: 100, height: 60, shape: "RECTANGLE", minCapacity: 1, maxCapacity: 4 },

            // --- Center Row ---
            // 6: Circular
            { id: "6", type: "CIRCULAR", x: 380, y: 320, width: 70, height: 70, shape: "CIRCLE", minCapacity: 4, maxCapacity: 7 },
            // 5: Standard Vertical
            { id: "5", type: "STANDARD", x: 530, y: 320, width: 60, height: 90, shape: "RECTANGLE", minCapacity: 1, maxCapacity: 4 },
            // 4: Circular
            { id: "4", type: "CIRCULAR", x: 640, y: 320, width: 70, height: 70, shape: "CIRCLE", minCapacity: 4, maxCapacity: 7 },

            // --- Right Side ---
            { id: "14", type: "STANDARD", x: 820, y: 270, width: 100, height: 60, shape: "RECTANGLE", minCapacity: 1, maxCapacity: 4 },

            // --- Bottom Row ---
            { id: "1", type: "STANDARD", x: 300, y: 500, width: 100, height: 60, shape: "RECTANGLE", minCapacity: 1, maxCapacity: 4 },
            { id: "2", type: "STANDARD", x: 450, y: 500, width: 100, height: 60, shape: "RECTANGLE", minCapacity: 1, maxCapacity: 4 },
            { id: "3", type: "STANDARD", x: 600, y: 500, width: 100, height: 60, shape: "RECTANGLE", minCapacity: 1, maxCapacity: 4 },
        ]

        for (const t of tables) {
            // Priority: Lower number (ID) = Higher Priority
            const num = parseInt(t.id.replace(/\D/g, '')) || 0;
            const priorityScore = 100 - num;

            await prisma.table.create({
                data: {
                    ...t,
                    priorityScore,
                    layoutId: layout.id,
                }
            })
        }
        console.log("Seeded layout and tables with updated assignment rules.")
    } catch (e) {
        console.error(e)
        process.exit(1)
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
