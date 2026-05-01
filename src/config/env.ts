import dotenv from "dotenv";

dotenv.config({ override: true });

const nodeEnv = process.env.NODE_ENV ?? "development";

function requireInProduction(value: string | undefined, name: string): string {
  if (nodeEnv === "production" && (!value || value.trim().length === 0)) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value ?? "";
}

export const env = {
  nodeEnv,
  databaseUrl: requireInProduction(process.env.DATABASE_URL, "DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  stripeSecretKey: requireInProduction(process.env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY"),
  stripeWebhookSecret: requireInProduction(
    process.env.STRIPE_WEBHOOK_SECRET,
    "STRIPE_WEBHOOK_SECRET"
  ),
  businessHoursStart: Number(process.env.BUSINESS_HOURS_START ?? "17"),
  businessHoursEnd: Number(process.env.BUSINESS_HOURS_END ?? "22"),
  smtpHost: process.env.SMTP_HOST ?? "localhost",
  smtpPort: Number(process.env.SMTP_PORT ?? "1025"),
  mailFrom: process.env.MAIL_FROM ?? "no-reply@reservation.com",
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  adminPin: requireInProduction(process.env.ADMIN_PIN, "ADMIN_PIN"),
  brevoApiKey: process.env.BREVO_API_KEY,
  brevoListId: Number(process.env.BREVO_LIST_ID ?? "2"),
  depositThreshold: Number(process.env.DEPOSIT_THRESHOLD ?? "10"),
  maxBookingDays: Number(process.env.MAX_BOOKING_DAYS ?? "60"),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(",").map(o => o.trim()),
  jwtSecret: requireInProduction(process.env.JWT_SECRET, "JWT_SECRET"),
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  reviewLink: process.env.REVIEW_LINK ?? "https://www.bing.com/search?pglt=299&q=diba+restaurant&cvid=514257cdd16e4f66834fa475b9171628&gs_lcrp=EgRlZGdlKgYIAhBFGDsyCQgAEEUYPBj5BzIGCAEQRRg5MgYIAhBFGDsyBggDEEUYOzIGCAQQRRg7MgYIBRBFGEEyBggGEEUYPNIBCDI0MDRqMGoxqAIIsAIB&form=EX0050&pc=U531&filters=local_ypid:\"YN6CE6D9BA91131947\"&shtp=GetUrl&shid=ffd7fbc4-7ebe-41f3-9918-01e3b52b0511&shtk=RGliYSBSZXN0YXVyYW50&shdk=V2VsY29tZSB0byBEaWJhIFJlc3RhdXJhbnQsIHdoZXJlIHRoZSB2aWJyYW50IGFuZCByaWNoIGZsYXZvcnMgb2YgUGVyc2lhbiBjdWlzaW5lIGNvbWUgdG8gbGlmZS4gTG9jYXRlZCBpbiB0aGUg4oCm&shhk=5ueLirCqD7Q%2B%2BBtabe4gBHZws1mh7XlQX46LfMtt%2Bm8%3D",
};
