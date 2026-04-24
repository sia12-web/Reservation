import { transporter } from "../config/mail";
import { env } from "../config/env";
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
    status?: string;
}

export async function sendReservationConfirmation(params: ReservationEmailParams) {
    const { to, clientName, partySize, startTime, shortId, tableIds, status } = params;

    const dateStr = startTime.toLocaleString("en-CA", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Montreal",
    });

    // Use a user-friendly link (assuming frontend is at port 5173 locally or configured via env)
    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const manageLink = `${frontendBaseUrl}/reservations/manage/${shortId}`;

    const isOverflow = tableIds.includes("T15");
    const isWaitlist = status === "WAITLIST" || isOverflow;
    const statusText = isWaitlist 
        ? "We have received your request!" 
        : "Your reservation at <strong>Diba Restaurant</strong> is confirmed.";
    
    const messageBody = isWaitlist
        ? "We will send you a final reservation confirmation shortly because the restaurant for that date is full. We are working to accommodate your party!"
        : "We are delighted to confirm your reservation. Our team is already preparing to welcome you for an exceptional dining experience!";

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h1 style="color: #1e293b; margin-bottom: 8px; text-align: center;">${isWaitlist ? "Request Received" : "Thank You!"}</h1>
        <p style="color: #475569; font-size: 18px; text-align: center; margin-bottom: 24px;">${statusText}</p>
        
        <p style="color: #475569; font-size: 16px;">Hi <strong>${clientName}</strong>,</p>
        <p style="color: #475569; font-size: 16px;">${messageBody}</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
            <ul style="list-style: none; padding: 0; margin: 0; color: #334155; font-size: 15px;">
                <li style="margin-bottom: 12px;"><strong>📅 Date:</strong> ${dateStr}</li>
                <li style="margin-bottom: 12px;"><strong>👥 Party Size:</strong> ${partySize} guests</li>
                <li style="margin-bottom: 12px;"><strong>🆔 Confirmation:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${shortId}</span></li>
                ${tableIds.filter(id => id !== 'T15').length > 0 ? `<li style="margin-bottom: 12px;"><strong>🍽️ Tables:</strong> ${tableIds.filter(id => id !== 'T15').join(", ")}</li>` : ""}
                ${isWaitlist ? `<li style="margin-bottom: 12px; color: #b45309;"><strong>⚠️ Status:</strong> Awaiting Final Table Assignment</li>` : ""}
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


    </div>
  `;

    try {
        const info = await transporter.sendMail({
            from: env.mailFrom,
            to: env.mailFrom, // For now, send to self/admin so it appears in MailHog reliably
            cc: to, // Optional: CC the client so we see intent
            subject: isWaitlist ? `Waiting List Request - ${shortId}` : `Reservation Confirmed - ${shortId}`,
            html,
        });

        logger.info({ msg: "Email sent", messageId: info.messageId, to });
    } catch (error) {
        logger.error({ msg: "Failed to send email", error, to });
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
    const { to, clientName, partySize, startTime, shortId } = params;

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
