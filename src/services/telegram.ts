import { env } from "../config/env";

const TELEGRAM_API_URL = `https://api.telegram.org/bot${env.telegramBotToken}`;

interface SendMessageOptions {
    text: string;
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";
    disableNotification?: boolean;
}

/**
 * Send a message to the configured Telegram chat/group
 */
export async function sendTelegramMessage(options: SendMessageOptions): Promise<boolean> {
    if (!env.telegramBotToken || !env.telegramChatId) {
        console.warn("[Telegram] Bot token or chat ID not configured, skipping notification");
        return false;
    }

    try {
        const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: env.telegramChatId,
                text: options.text,
                parse_mode: options.parseMode ?? "HTML",
                disable_notification: options.disableNotification ?? false,
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("[Telegram] Failed to send message:", errorData);
            return false;
        }

        console.log("[Telegram] Message sent successfully");
        return true;
    } catch (error) {
        console.error("[Telegram] Error sending message:", error);
        return false;
    }
}

/**
 * Format and send a new reservation notification
 */
export async function notifyNewReservation(reservation: {
    shortId: string;
    clientName: string;
    clientPhone: string;
    partySize: number;
    startTime: Date;
    status: string;
    customerNotes?: string | null;
    tableIds?: string[];
}): Promise<void> {
    const date = reservation.startTime.toLocaleDateString("en-CA", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "America/Toronto",
    });

    const time = reservation.startTime.toLocaleTimeString("en-CA", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Toronto",
    });

    const tables = reservation.tableIds?.length
        ? `Tables: ${reservation.tableIds.join(", ")}`
        : "Tables: Auto-assigned";

    const notes = reservation.customerNotes
        ? `\n📝 <i>${reservation.customerNotes}</i>`
        : "";

    const message = `
🍽️ <b>New Reservation</b>

📋 <b>Code:</b> ${reservation.shortId}
👤 <b>Name:</b> ${reservation.clientName}
📞 <b>Phone:</b> ${reservation.clientPhone}
👥 <b>Party:</b> ${reservation.partySize} guests
📅 <b>Date:</b> ${date}
⏰ <b>Time:</b> ${time}
🪑 ${tables}${notes}

<b>Status:</b> ${reservation.status}
  `.trim();

    await sendTelegramMessage({ text: message });
}

/**
 * Notify when a reservation is cancelled
 */
export async function notifyCancelledReservation(reservation: {
    shortId: string;
    clientName: string;
    partySize: number;
    startTime: Date;
    cancellationReason?: string | null;
}): Promise<void> {
    const date = reservation.startTime.toLocaleDateString("en-CA", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "America/Toronto",
    });

    const time = reservation.startTime.toLocaleTimeString("en-CA", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Toronto",
    });

    const reason = reservation.cancellationReason
        ? `\n📝 <i>Reason: ${reservation.cancellationReason}</i>`
        : "";

    const message = `
❌ <b>Reservation Cancelled</b>

📋 <b>Code:</b> ${reservation.shortId}
👤 <b>Name:</b> ${reservation.clientName}
👥 <b>Party:</b> ${reservation.partySize} guests
📅 ${date} at ${time}${reason}
  `.trim();

    await sendTelegramMessage({ text: message });
}
