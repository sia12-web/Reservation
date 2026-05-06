import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Updating layout adjacency...");

    const layout = await prisma.layout.findFirst({
        where: { isActive: true }
    });

    if (!layout) {
        console.error("No active layout found!");
        return;
    }

    const newAdjacency = {
        T1: ["T2"],
        T2: ["T1", "T3"],
        T3: ["T2"],
        T4: ["T5"],
        T5: ["T4", "T6"],
        T6: ["T5"],
        T7: ["T8"],
        T8: ["T7", "T9"], // Connected T8 <-> T9
        T9: ["T8", "T10"], // Connected T9 <-> T8
        T10: ["T9", "T11"],
        T11: ["T10", "T12"],
        T12: ["T11", "T13"],
        T13: ["T12"], // Disconnected T14
        T14: [],      // Disconnected T13
        T15: []
    };

    await prisma.layout.update({
        where: { id: layout.id },
        data: {
            adjacencyGraph: newAdjacency
        }
    });

    console.log("Layout adjacency updated successfully.");
    console.log("T8 is now connected to T9.");
    console.log("T13 is now disconnected from T14.");
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
