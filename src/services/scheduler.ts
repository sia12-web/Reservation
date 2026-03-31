
import { prisma } from "../config/prisma";
import { sendReservationReminder, sendLateWarning, sendThankYouEmail } from "./email";
import { cleanupStaleReservations } from "./reservation";
import pino from "pino";

const logger = pino();

export function startScheduler() {
    logger.info("Starting reservation notification scheduler...");

    // Run every minute
    setInterval(async () => {
        try {
            await checkReminders();
            await checkLateWarnings();
            await checkThankYouEmails();
            await cleanupStaleReservations();
        } catch (error) {
            logger.error({ msg: "Scheduler error", error });
        }
    }, 60 * 1000);
}

export async function checkReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 65 * 60 * 1000); // 5 min buffer

    const reminders = await prisma.reservation.findMany({
        where: {
            status: "CONFIRMED",
            reminderSent: false,
            startTime: {
                lte: windowEnd,
                gt: now, // Must be in future
            },
        },
        include: { reservationTables: true },
    });

    for (const res of reminders) {
        try {
            // Mark as sent FIRST to prevent race conditions in next interval
            await prisma.reservation.update({
                where: { id: res.id },
                data: { reminderSent: true },
            });

            await sendReservationReminder({
                to: res.clientEmail || "default@example.com",
                clientName: res.clientName,
                partySize: res.partySize,
                startTime: res.startTime,
                shortId: res.shortId,
                tableIds: res.reservationTables.map((rt) => rt.tableId),
            });
        } catch (error) {
            logger.error({ msg: "Failed to send reminder", reservationId: res.id, error });
        }
    }
}

export async function checkLateWarnings() {
    const now = new Date();
    const lateThreshold = new Date(now.getTime() - 15 * 60 * 1000);

    const lateReservations = await prisma.reservation.findMany({
        where: {
            status: "CONFIRMED",
            lateWarningSent: false,
            startTime: {
                lt: lateThreshold,
                gt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            },
        },
    });

    for (const res of lateReservations) {
        try {
            await prisma.reservation.update({
                where: { id: res.id },
                data: { lateWarningSent: true },
            });

            await sendLateWarning({
                to: res.clientEmail || "default@example.com",
                clientName: res.clientName,
                partySize: res.partySize,
                startTime: res.startTime,
                shortId: res.shortId,
                tableIds: [],
            });
        } catch (error) {
            logger.error({ msg: "Failed to send late warning", reservationId: res.id, error });
        }
    }
}

export async function checkThankYouEmails() {
    const now = new Date();
    const endWindow = new Date(now.getTime() - 30 * 60 * 1000);

    const endedReservations = await prisma.reservation.findMany({
        where: {
            status: { in: ["COMPLETED", "CHECKED_IN"] },
            thankYouSent: false,
            endTime: {
                lt: endWindow,
                gt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
            },
        },
    });

    for (const res of endedReservations) {
        try {
            await prisma.reservation.update({
                where: { id: res.id },
                data: { thankYouSent: true },
            });

            if (res.clientEmail) {
                await sendThankYouEmail({
                    to: res.clientEmail,
                    clientName: res.clientName,
                    shortId: res.shortId,
                });
            }
        } catch (error) {
            logger.error({ msg: "Failed to send thank you email", reservationId: res.id, error });
        }
    }
}
