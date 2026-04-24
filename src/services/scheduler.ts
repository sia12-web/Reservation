
import { prisma } from "../config/prisma";
import { sendThankYouEmail } from "./email";
import pino from "pino";

const logger = pino();

export function startScheduler() {
    logger.info("Starting reservation notification scheduler...");

    // Run every minute
    setInterval(async () => {
        try {
            await checkThankYouEmails();
        } catch (error) {
            logger.error({ msg: "Scheduler error", error });
        }
    }, 60 * 1000);
}

export async function checkThankYouEmails() {
    const now = new Date();
    const endWindow = new Date(now.getTime() - 30 * 60 * 1000);

    const endedReservations = await prisma.reservation.findMany({
        where: {
            status: "COMPLETED",
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
