import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "depositRequestedAt" TIMESTAMPTZ(6)`);
  console.log("✅ depositRequestedAt column added");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error("Error:", e.message); prisma.$disconnect(); });
