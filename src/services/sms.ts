import { env } from "../config/env";
import { logger } from "../config/logger";

// Lazy-load Twilio to avoid errors if credentials are missing in dev
let twilioClient: any = null;

function getTwilioClient() {
  if (!twilioClient && env.twilioAccountSid && env.twilioAuthToken) {
    // Dynamic import to avoid loading Twilio if not configured
    const twilio = require("twilio");
    twilioClient = twilio(env.twilioAccountSid, env.twilioAuthToken);
  }
  return twilioClient;
}

export interface SendSmsParams {
  to: string; // Phone number in E.164 format (e.g., +15144859999)
  clientName: string;
  shortId: string;
  partySize: number;
  startTime: Date;
}

/**
 * Sends an SMS with a payment link to complete the deposit
 * Used for phone reservations where email might not be available
 */
export async function sendDepositSms(params: SendSmsParams) {
  const { to, clientName, shortId, partySize, startTime } = params;

  const client = getTwilioClient();
  if (!client) {
    logger.warn("Twilio not configured - SMS not sent");
    return;
  }

  const dateStr = startTime.toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Montreal",
  });

  const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const paymentLink = `${frontendBaseUrl}/reservations/manage/${shortId}`;

  const message = `Hi ${clientName}! Your reservation for ${partySize} guests on ${dateStr} requires a $50 deposit. Complete payment here: ${paymentLink} (Ref: ${shortId}). You have 60 minutes. Questions? Call (514) 485-9999`;

  try {
    const result = await client.messages.create({
      body: message,
      from: env.twilioPhoneNumber,
      to: to,
    });

    logger.info({ msg: "SMS sent", sid: result.sid, to, shortId });
  } catch (error: any) {
    logger.error({ msg: "Failed to send SMS", error: error.message, to, shortId });
    // Don't throw - SMS is best-effort, shouldn't block reservation
  }
}

/**
 * Sends a waitlist promotion SMS
 */
export async function sendWaitlistPromotionSms(params: SendSmsParams) {
  const { to, clientName, shortId, partySize, startTime } = params;

  const client = getTwilioClient();
  if (!client) {
    logger.warn("Twilio not configured - SMS not sent");
    return;
  }

  const dateStr = startTime.toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Montreal",
  });

  const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const paymentLink = `${frontendBaseUrl}/reservations/manage/${shortId}`;

  const message = `Great news ${clientName}! A table is now available for ${partySize} guests on ${dateStr}. Complete your $50 deposit to confirm: ${paymentLink} (Ref: ${shortId}). You have 60 minutes.`;

  try {
    const result = await client.messages.create({
      body: message,
      from: env.twilioPhoneNumber,
      to: to,
    });

    logger.info({ msg: "Waitlist promotion SMS sent", sid: result.sid, to, shortId });
  } catch (error: any) {
    logger.error({ msg: "Failed to send waitlist SMS", error: error.message, to, shortId });
  }
}
