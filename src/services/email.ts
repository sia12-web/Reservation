import { transporter } from "../config/mail";
import { env } from "../config/env";
import { sendTelegramMessage, formatReservationNotification } from "../config/telegram";
import pino from "pino";

const logger = pino();

export interface ReservationEmailParams {
    to: string;
    clientName: string;
    clientPhone?: string;
    partySize: number;
    startTime: Date;
    shortId: string;
    tableIds: string[];
    customerNotes?: string;
    cancellationReason?: string;
    isOverflow?: boolean;
}

export async function sendReservationConfirmation(params: ReservationEmailParams) {
    const { to, clientName, clientPhone, partySize, startTime, shortId, tableIds, customerNotes } = params;

    const dateStr = startTime.toLocaleString("en-CA", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Montreal",
    });

    // Use a user-friendly link (assuming frontend is at port 5173 locally or configured via env)
    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const manageLink = `${frontendBaseUrl}/reservations/manage/${shortId}`;

    const isOverflow = tableIds.includes("T15");
    const statusText = isOverflow 
        ? "We have received your request!" 
        : "Your reservation at <strong>Diba Restaurant</strong> is confirmed.";
    
    const messageBody = isOverflow
        ? "We will send you a final reservation confirmation shortly because the restaurant for that date is full. We are working to accommodate your party!"
        : "We are delighted to confirm your reservation. Our team is already preparing to welcome you for an exceptional dining experience!";

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h1 style="color: #1e293b; margin-bottom: 8px; text-align: center;">${isOverflow ? "Request Received" : "Thank You!"}</h1>
        <p style="color: #475569; font-size: 18px; text-align: center; margin-bottom: 24px;">${statusText}</p>
        
        <p style="color: #475569; font-size: 16px;">Hi <strong>${clientName}</strong>,</p>
        <p style="color: #475569; font-size: 16px;">${messageBody}</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
            <ul style="list-style: none; padding: 0; margin: 0; color: #334155; font-size: 15px;">
                <li style="margin-bottom: 12px;"><strong>📅 Date:</strong> ${dateStr}</li>
                <li style="margin-bottom: 12px;"><strong>👥 Party Size:</strong> ${partySize} guests</li>
                <li style="margin-bottom: 12px;"><strong>🆔 Confirmation:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${shortId}</span></li>
                ${tableIds.filter(id => id !== 'T15').length > 0 ? `<li style="margin-bottom: 12px;"><strong>🍽️ Tables:</strong> ${tableIds.filter(id => id !== 'T15').join(", ")}</li>` : ""}
                ${isOverflow ? `<li style="margin-bottom: 12px; color: #b45309;"><strong>⚠️ Status:</strong> Awaiting Final Table Assignment</li>` : ""}
            </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${manageLink}" style="background-color: #0f172a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Manage Reservation</a>
        </div>

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />

        <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 24px; margin-top: 24px;">
            <p style="color: #475569; font-size: 14px; margin-bottom: 8px;"><strong>Need to speak with us?</strong></p>
            <p style="color: #475569; font-size: 14px; margin-bottom: 16px;">For questions or changes, please call us at <strong>(514) 485-9999</strong>.</p>
        </div>

        <div style="text-align: center;">
            <p style="color: #475569; font-size: 14px; margin-bottom: 16px;">How was your experience booking with us?</p>
            <a href="${env.reviewLink}" style="color: #2563eb; font-weight: bold; text-decoration: underline; font-size: 14px;">Leave us a Google Review</a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">Your feedback helps us provide the best service.</p>
        </div>
    </div>
  `;

    try {
        const info = await transporter.sendMail({
            from: env.mailFrom,
            to: env.mailFrom, // For now, send to self/admin so it appears in MailHog reliably
            cc: to, // Optional: CC the client so we see intent
            subject: `Reservation Confirmed - ${shortId}`,
            html,
        });

        logger.info({ msg: "Email sent", messageId: info.messageId, to });
    } catch (error) {
        logger.error({ msg: "Failed to send email", error, to });
    }

    // Send Telegram notification to the owner/staff group
    if (env.telegramChatId) {
        const telegramMsg = formatReservationNotification({
            type: "NEW",
            clientName,
            clientPhone: clientPhone || "N/A",
            partySize,
            startTime,
            shortId,
            tableIds,
            customerNotes,
        });
        sendTelegramMessage({ chatId: env.telegramChatId, text: telegramMsg }).catch((err) =>
            logger.error({ msg: "Telegram notification failed", error: err })
        );
    }
}

export async function sendReservationReminder(params: ReservationEmailParams) {
    const { to, clientName, partySize, startTime, shortId, tableIds: _tableIds } = params;

    const dateStr = new Date(startTime).toLocaleString("en-CA", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Montreal",
    });

    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const manageLink = `${frontendBaseUrl}/reservations/manage/${shortId}`;

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h1 style="color: #0f172a; margin-bottom: 24px; text-align: center;">⏰ Upcoming Reservation</h1>
        <p style="color: #475569; font-size: 16px;">Hi <strong>${clientName}</strong>,</p>
        <p style="color: #475569; font-size: 16px;">Just a friendly reminder that your reservation is in <strong>1 hour</strong>.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <ul style="list-style: none; padding: 0; margin: 0; color: #334155; font-size: 15px;">
                <li style="margin-bottom: 12px;"><strong>📅 When:</strong> ${dateStr}</li>
                <li style="margin-bottom: 12px;"><strong>👥 Party:</strong> ${partySize} guests</li>
                <li style="margin-bottom: 12px;"><strong>🆔 Code:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; rounded: 4px;">${shortId}</span></li>
            </ul>
        </div>

        <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
            <p style="color: #475569; font-size: 14px;">For changing the date of your reservation, please call us at <strong>(514) 485-9999</strong>.</p>
            <a href="${manageLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-top: 16px;">Details & Directions</a>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: env.mailFrom,
            to: env.mailFrom,
            cc: to,
            subject: `Reservation Reminder - ${shortId}`,
            html,
        });
        logger.info({ msg: "Reminder email sent", shortId, to });
    } catch (error) {
        logger.error({ msg: "Failed to send reminder email", error, shortId });
    }
}

export async function sendLateWarning(params: ReservationEmailParams) {
    const { to, clientName, shortId, startTime } = params;

    const dateStr = new Date(startTime).toLocaleString("en-CA", {
        timeStyle: "short",
        timeZone: "America/Montreal",
    });

    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const manageLink = `${frontendBaseUrl}/reservations/manage/${shortId}`;

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 12px; background-color: #fffafa;">
        <h1 style="color: #991b1b; margin-bottom: 24px; text-align: center;">Running Late?</h1>
        <p style="color: #475569; font-size: 16px;">Hi <strong>${clientName}</strong>,</p>
        <p style="color: #475569; font-size: 16px;">We noticed you haven't arrived for your <strong>${dateStr}</strong> reservation yet (15 minutes ago).</p>
        <p style="color: #475569; font-size: 16px;">Please arrive soon or call us, otherwise we may need to release your table.</p>
        
        <div style="text-align: center; margin-top: 32px;">
            <p style="color: #475569; font-size: 14px; margin-bottom: 16px;">For changing the date of your reservation, please call us at <strong>(514) 485-9999</strong>.</p>
            <a href="tel:+15144859999" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Call Restaurant Now</a>
            <div style="margin-top: 12px;">
                <a href="${manageLink}" style="color: #64748b; text-decoration: underline;">Manage Booking</a>
            </div>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: env.mailFrom,
            to: env.mailFrom,
            cc: to,
            subject: `Urgent: Reservation Status - ${shortId}`,
            html,
        });
        logger.info({ msg: "Late warning email sent", shortId, to });
    } catch (error) {
        logger.error({ msg: "Failed to send late warning email", error, shortId });
    }

    // Send URGENT Telegram notification for late arrivals
    if (env.telegramChatId) {
        const telegramMsg = formatReservationNotification({
            type: "LATE",
            clientName,
            clientPhone: (params as any).clientPhone || "N/A",
            partySize: (params as any).partySize || 0,
            startTime,
            shortId,
            tableIds: (params as any).tableIds || [],
        });
        sendTelegramMessage({ chatId: env.telegramChatId, text: telegramMsg }).catch((err) =>
            logger.error({ msg: "Telegram late warning failed", error: err })
        );
    }
}

export async function sendThankYouEmail(params: { to: string; clientName: string; shortId: string }) {
    const { to, clientName, shortId } = params;

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h1 style="color: #1e293b; margin-bottom: 24px; text-align: center;">Thank You for Visiting!</h1>
        <p style="color: #475569; font-size: 16px;">Hi <strong>${clientName}</strong>,</p>
        <p style="color: #475569; font-size: 16px;">It was a pleasure having you at <strong>Diba Restaurant</strong> today. We hope you enjoyed your meal and our service!</p>
        <p style="color: #475569; font-size: 16px;">If you have a moment, we would greatly appreciate it if you could share your experience by leaving us a review. Your feedback helps us grow and continue providing the best experience for our guests.</p>
        
        <div style="text-align: center; margin-top: 32px; padding: 24px; background-color: #f8fafc; border-radius: 12px;">
            <p style="margin-bottom: 20px; color: #334155; font-weight: bold;">How did we do?</p>
            <a href="${env.reviewLink}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Leave a Review</a>
        </div>

        <p style="margin-top: 32px; text-align: center; color: #94a3b8; font-size: 14px;">We look forward to seeing you again soon!</p>
        <p style="text-align: center; color: #94a3b8; font-size: 12px;">Reservation ID: ${shortId}</p>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: env.mailFrom,
            to: env.mailFrom,
            cc: to,
            subject: `Thank you for dining with us! - ${clientName}`,
            html,
        });
        logger.info({ msg: "Thank you email sent", shortId, to });
    } catch (error) {
        logger.error({ msg: "Failed to send thank you email", error, shortId });
    }
}

export async function sendDepositRequestEmail(params: ReservationEmailParams) {
    const { to, clientName, partySize, startTime, shortId, tableIds } = params;

    const dateStr = startTime.toLocaleString("en-CA", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Montreal",
    });

    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const manageLink = `${frontendBaseUrl}/reservations/manage/${shortId}`;

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h1 style="color: #1e293b; margin-bottom: 24px; text-align: center;">Deposit Required</h1>
        <p style="color: #475569; font-size: 16px;">Hi <strong>${clientName}</strong>,</p>
        <p style="color: #475569; font-size: 16px;">Thank you for your reservation request for <strong>${partySize} guests</strong> on <strong>${dateStr}</strong>.</p>
        <p style="color: #475569; font-size: 16px;">For parties larger than 10, we require a <strong>$50 security deposit</strong> to confirm the booking. This deposit will be credited toward your final bill.</p>
        
        <div style="background-color: #fffbeb; padding: 24px; border: 1px solid #fef3c7; border-radius: 12px; margin: 24px 0; text-align: center;">
            <p style="color: #92400e; margin: 0 0 16px 0; font-weight: bold; font-size: 18px;">Your reservation is currently on HOLD.</p>
            <p style="color: #92400e; margin: 0 0 24px 0; font-size: 15px; line-height: 1.5;">To confirm your booking and release the hold, please complete the security deposit payment using the secure link below.</p>
            <a href="${manageLink}" style="background-color: #92400e; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; shadow: 0 4px 6px rgba(0,0,0,0.1);">Complete Payment via Stripe</a>
        </div>

        <p style="color: #475569; font-size: 14px;">Confirmation Code: <strong>${shortId}</strong></p>
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="color: #475569; font-size: 14px; margin-bottom: 8px;"><strong>Need to change your date?</strong></p>
            <p style="color: #475569; font-size: 14px; margin-bottom: 16px;">For changing the date of your reservation, please call us at <strong>(514) 485-9999</strong>.</p>
            <p style="color: #94a3b8; font-size: 12px;">If you have other questions, please reply to this email.</p>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: env.mailFrom,
            to: env.mailFrom,
            cc: to,
            subject: `Action Required: Deposit for Reservation ${shortId}`,
            html,
        });
        logger.info({ msg: "Deposit request email sent", shortId, to });
    } catch (error) {
        logger.error({ msg: "Failed to send deposit request email", error, shortId });
    }

    // Send Telegram notification for pending deposit (Large Party)
    if (env.telegramChatId) {
        const telegramMsg = formatReservationNotification({
            type: "DEPOSIT_REQUIRED",
            clientName,
            clientPhone: params.clientPhone || "N/A",
            partySize,
            startTime,
            shortId,
            tableIds,
        });
        sendTelegramMessage({ chatId: env.telegramChatId, text: telegramMsg }).catch((err) =>
            logger.error({ msg: "Telegram deposit notification failed", error: err })
        );
    }
}

export async function sendMockStripeReceipt(params: { to: string; amount: number; shortId: string; paymentId: string }) {
    const { to, amount, shortId, paymentId } = params;
    const amountStr = (amount / 100).toFixed(2);
    const dateStr = new Date().toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' });

    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 40px auto; padding: 40px; border-radius: 8px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
        <div style="margin-bottom: 32px; border-bottom: 2px solid #6366f1; padding-bottom: 16px;">
            <div style="font-weight: 800; color: #6366f1; font-size: 24px; letter-spacing: -0.5px;">STRIPE <span style="color: #94a3b8; font-weight: 400; font-size: 14px; margin-left: 8px;">(SIMULATED)</span></div>
        </div>
        
        <h2 style="color: #1a1f36; font-size: 24px; margin-bottom: 16px; font-weight: 700;">Receipt from Diba Restaurant</h2>
        <p style="color: #4f566b; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">Receipt #${paymentId.slice(-8).toUpperCase()}</p>
        
        <div style="margin-bottom: 32px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; color: #4f566b;">
                <span>Amount paid</span>
                <span style="font-weight: 600; color: #1a1f36;">$${amountStr} CAD</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; color: #4f566b;">
                <span>Date paid</span>
                <span>${dateStr}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #4f566b;">
                <span>Payment method</span>
                <span>Visa - 4242</span>
            </div>
        </div>
        
        <div style="background-color: #f7fafc; padding: 24px; border-radius: 8px; margin-bottom: 32px;">
            <p style="margin: 0 0 8px 0; color: #1a1f36; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Summary</p>
            <p style="margin: 0; color: #4f566b; font-size: 15px;">Security Deposit for Reservation <strong>#${shortId}</strong></p>
        </div>
        
        <p style="color: #a3acb9; font-size: 14px; text-align: center; margin-top: 40px;">
            This is a <strong>simulated</strong> Stripe receipt for demonstration purposes.<br/>
            Diba Restaurant | 123 Gourmet St, Montreal
        </p>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: '"Stripe (Simulated)" <stripe@diba-restaurant.com>',
            to: env.mailFrom,
            cc: to,
            subject: `Fwd: Your receipt from Diba Restaurant ($${amountStr} CAD)`,
            html,
        });
    } catch (error) {
        logger.error({ msg: "Mock Stripe Email error", error });
    }
}

export async function sendMockStripeRefund(params: { to: string; amount: number; shortId: string; paymentId: string }) {
    const { to, amount, shortId, paymentId } = params;
    const amountStr = (amount / 100).toFixed(2);
    
    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 40px auto; padding: 40px; border-radius: 8px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
        <div style="margin-bottom: 32px; border-bottom: 2px solid #ef4444; padding-bottom: 16px;">
            <div style="font-weight: 800; color: #ef4444; font-size: 24px; letter-spacing: -0.5px;">STRIPE <span style="color: #94a3b8; font-weight: 400; font-size: 14px; margin-left: 8px;">(SIMULATED)</span></div>
        </div>
        
        <h2 style="color: #1a1f36; font-size: 24px; margin-bottom: 16px; font-weight: 700;">Refund from Diba Restaurant</h2>
        <p style="color: #4f566b; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">The original charge of $${amountStr} (ID: ${paymentId.slice(-8).toUpperCase()}) has been refunded.</p>
        
        <div style="margin-bottom: 32px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; color: #4f566b;">
                <span>Refund amount</span>
                <span style="font-weight: 600; color: #1a1f36;">$${amountStr} CAD</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; color: #4f566b;">
                <span>Original charge</span>
                <span>$${amountStr} CAD</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #4f566b;">
                <span>Refund reason</span>
                <span>Requested by customer</span>
            </div>
        </div>
        
        <div style="background-color: #fff5f5; padding: 24px; border-radius: 8px; margin-bottom: 32px; border: 1px solid #fee2e2;">
            <p style="margin: 0; color: #991b1b; font-size: 15px;">A refund has been issued for your reservation <strong>#${shortId}</strong>. It should appear on your statement within a few business days (timing depends on your bank).</p>
        </div>
        
        <p style="color: #a3acb9; font-size: 14px; text-align: center; margin-top: 40px;">
            This is a <strong>simulated</strong> Stripe refund notification for demonstration purposes.<br/>
            Diba Restaurant | 123 Gourmet St, Montreal
        </p>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: '"Stripe (Simulated)" <stripe@diba-restaurant.com>',
            to: env.mailFrom,
            cc: to,
            subject: `Fwd: Refund from Diba Restaurant ($${amountStr} CAD)`,
            html,
        });
    } catch (error) {
        logger.error({ msg: "Mock Stripe Refund Email error", error });
    }
}

export async function sendCancellationEmail(params: ReservationEmailParams) {
    const { to, clientName, shortId, tableIds, cancellationReason } = params;
    const isOverflow = tableIds.includes("T15");

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 12px; background-color: #ffffff;">
        <h1 style="color: #991b1b; margin-bottom: 24px; text-align: center;">${isOverflow ? "Waitlist Update" : "Reservation Cancelled"}</h1>
        
        <p style="color: #475569; font-size: 16px;">Hi <strong>${clientName}</strong>,</p>
        
        ${isOverflow ? `
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">We are writing to let you know that we were unfortunately unable to find a table for your party as the restaurant is completely at capacity for your selected date.</p>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;"><strong>We have automatically processed a full refund</strong> of your security deposit (if applicable). It should appear on your statement within a few business days (timing depends on your bank).</p>
        ` : `
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">Your reservation <strong>#${shortId}</strong> has been cancelled.</p>
            ${cancellationReason ? `<p style="color: #475569; font-size: 16px;"><strong>Reason:</strong> ${cancellationReason}</p>` : ""}
        `}
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: center; border: 1px solid #e2e8f0;">
            <p style="color: #475569; font-size: 14px; margin: 0;">We hope to have the chance to welcome you another time!</p>
        </div>

        <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 24px; margin-top: 24px;">
            <p style="color: #475569; font-size: 14px; margin-bottom: 16px;">If you have any questions, please call us at <strong>(514) 485-9999</strong>.</p>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: env.mailFrom,
            to: env.mailFrom,
            cc: to,
            subject: `${isOverflow ? "Waitlist Status Update" : "Reservation Cancelled"} - ${shortId}`,
            html,
        });
        logger.info({ msg: "Cancellation email sent", shortId, to });
    } catch (error) {
        logger.error({ msg: "Failed to send cancellation email", error, shortId });
    }
}
