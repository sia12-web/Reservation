import { env } from "./env";

const TELEGRAM_API = "https://api.telegram.org/bot";

interface TelegramMessage {
    chatId: string;
    text: string;
    parseMode?: "HTML" | "Markdown";
}

export async function sendTelegramMessage(params: TelegramMessage): Promise<boolean> {
    const { chatId, text, parseMode = "HTML" } = params;

    if (!env.telegramBotToken || !chatId) {
        console.log("[Telegram] Bot token or chat ID not configured, skipping notification");
        return false;
    }

    try {
        const response = await fetch(`${TELEGRAM_API}${env.telegramBotToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: parseMode,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("[Telegram] Failed to send message:", error);
            return false;
        }

        console.log("[Telegram] Message sent successfully");
        return true;
    } catch (error) {
        console.error("[Telegram] Error sending message:", error);
        return false;
    }
}

export function formatReservationNotification(params: {
    type: "NEW" | "REMINDER" | "LATE" | "CANCELLED" | "DEPOSIT_REQUIRED";
    clientName: string;
    clientPhone: string;
    partySize: number;
    startTime: Date;
    shortId: string;
    tableIds: string[];
    customerNotes?: string;
}): string {
    const { type, clientName, clientPhone, partySize, startTime, shortId, tableIds, customerNotes } = params;

    const dateStr = startTime.toLocaleString("en-CA", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Montreal",
    });

    const emoji = {
        NEW: "🎉",
        REMINDER: "⏰",
        LATE: "🚨",
        CANCELLED: "❌",
        DEPOSIT_REQUIRED: "💳",
    }[type];

    const title = {
        NEW: "New Reservation",
        REMINDER: "Upcoming Reservation",
        LATE: "LATE ARRIVAL",
        CANCELLED: "Reservation Cancelled",
        DEPOSIT_REQUIRED: "Deposit Required",
    }[type];

    let message = `${emoji} <b>${title}</b>\n\n`;
    message += `👤 <b>Name:</b> ${clientName}\n`;
    message += `📞 <b>Phone:</b> ${clientPhone}\n`;
    message += `👥 <b>Party:</b> ${partySize} guests\n`;
    message += `📅 <b>Date:</b> ${dateStr}\n`;
    message += `🍽️ <b>Tables:</b> ${tableIds.join(", ")}\n`;
    message += `🆔 <b>Code:</b> <code>${shortId}</code>\n`;

    if (customerNotes) {
        message += `\n📝 <b>Notes:</b> ${customerNotes}`;
    }

    if (type === "DEPOSIT_REQUIRED") {
        message += `\n\n⚠️ <i>Contact guest to collect $50 deposit</i>`;
    }

    if (type === "LATE") {
        message += `\n\n⚠️ <i>15 minutes past reservation time. Consider releasing table.</i>`;
    }

    return message;
}
