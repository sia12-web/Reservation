import nodemailer from "nodemailer";
import { env } from "./env";

const auth = env.smtpUser && env.smtpPass ? {
    user: env.smtpUser,
    pass: env.smtpPass,
} : undefined;

// Allow explicit SMTP_SECURE override, otherwise default based on port (465 = true, 587 = false)
const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === "true"
    : env.smtpPort === 465;

export const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure,
    auth,
});
