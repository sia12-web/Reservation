import { initDb } from "./src/config/initDb";
import { prisma } from "./src/config/prisma";

async function main() {
    await initDb();
    console.log("Database synchronized with new minCapacity: 1 for standard tables.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
