import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const layout = await prisma.layout.findFirst({
    where: { isActive: true },
  });

  if (!layout) {
    console.log("No active layout found");
    return;
  }

  console.log(`Updating tables for layout: ${layout.name} (${layout.id})`);

  const result = await prisma.table.updateMany({
    where: {
      layoutId: layout.id,
      type: "STANDARD",
      id: { not: "T15" }
    },
    data: {
      minCapacity: 1
    }
  });

  console.log(`Successfully updated ${result.count} tables.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
