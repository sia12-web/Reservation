import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Creating fresh start... Deleting all reservation data.");

    // Delete in order to satisfy foreign key constraints

    // 1. Delete ReservationTables (depend on Reservation)
    const rtCount = await prisma.reservationTable.deleteMany({});
    console.log(`Deleted ${rtCount.count} reservation table entries.`);

    // 2. Delete Payments (depend on Reservation)
    const paymentCount = await prisma.payment.deleteMany({});
    console.log(`Deleted ${paymentCount.count} payments.`);

    // 3. Delete AuditLogs (depend on Reservation)
    // Note: AuditLogs might reference other things, but typically we want to clear them for a 'fresh start' regarding reservations.
    const auditCount = await prisma.auditLog.deleteMany({});
    console.log(`Deleted ${auditCount.count} audit logs.`);

    // 4. Finally, delete Reservations
    const rCount = await prisma.reservation.deleteMany({});
    console.log(`Deleted ${rCount.count} reservations.`);

    console.log("All reservation data cleared successfully!");
}

main()
    .catch((e) => {
        console.log("DB URL:", process.env.DATABASE_URL);
        console.error("Full Error:", e);
        console.error("Error Message:", e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
