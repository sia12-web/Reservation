import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const jack = await prisma.reservation.findFirst({
    where: { 
      clientName: { contains: "jack", mode: "insensitive" },
      status: "WAITLIST"
    },
    include: { reservationTables: true }
  });

  if (!jack) {
    console.log("Jack's waitlist reservation not found");
    return;
  }

  console.log(`Found Jack's reservation: ${jack.id}`);

  // Find a free standard table (e.g. T1)
  // For simplicity, let's just pick T1 if it's not in the list of currently busy tables
  // But wait, my script earlier showed no other reservations for that time except Siavash and Amir.
  
  await prisma.$transaction(async (tx) => {
    // Remove from overflow
    await tx.reservationTable.deleteMany({
      where: { reservationId: jack.id }
    });

    // Assign to T1
    await tx.reservationTable.create({
      data: {
        reservationId: jack.id,
        tableId: "T1",
        layoutId: jack.reservationTables[0].layoutId,
        isPrimary: true
      }
    });

    // Update status
    await tx.reservation.update({
      where: { id: jack.id },
      data: { status: "CONFIRMED" }
    });
  });

  console.log("Successfully reassigned Jack to T1 and confirmed reservation.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
