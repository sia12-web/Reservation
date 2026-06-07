import { PrismaClient } from "@prisma/client";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  console.log(`Connecting to database: ${dbUrl?.split("@")[1] || dbUrl}`);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  try {
    // We can search by code '69BU6BC4' or client name 'Stephanie'
    const reservation = await prisma.reservation.findFirst({
      where: {
        OR: [
          { id: "69BU6BC4" },
          { id: "#69BU6BC4" },
          { clientName: { contains: "Stephanie", mode: "insensitive" } }
        ]
      }
    });

    if (!reservation) {
      console.log("Reservation for Stephanie Yung not found in this database.");
      return;
    }

    console.log(`Found reservation: ID=${reservation.id}, Name=${reservation.clientName}, Status=${reservation.status}, Date=${reservation.startTime}`);

    if (reservation.status === "CHECKED_IN") {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          status: "CONFIRMED",
          checkedInAt: null,
          version: { increment: 1 }
        }
      });
      console.log("Successfully reverted status to CONFIRMED and cleared checkedInAt.");
    } else {
      console.log(`Reservation is currently in status: ${reservation.status}. No action needed.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Error executing script:", err);
  process.exit(1);
});
