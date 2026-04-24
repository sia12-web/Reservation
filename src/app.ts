import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import reservationsRouter from "./routes/reservations";
import layoutRouter from "./routes/layout";
import webhooksRouter from "./routes/webhooks";
import adminRouter from "./routes/admin";
import authRouter from "./routes/auth";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./config/logger";

const app = express();

// Trust proxy when behind reverse proxy (Render, Heroku, etc.)
// Set to true to trust all 'X-Forwarded-*' headers from Render's load balancer
app.set("trust proxy", 1);

// Global rate limiter as a safety net (applies to all routes except /health and /webhooks)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per 15 minutes per IP (generous but prevents obvious abuse)
    message: { error: "Too many requests from this IP, please try again later" },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
        // Skip rate limiting for health checks and webhooks (webhooks are validated by Stripe)
        return req.path === "/health" || req.path.startsWith("/webhooks");
    },
    handler: (req, res) => {
        // Log rate limit violations for security monitoring
        logger.warn({
            event: "rate_limit_exceeded",
            ip: req.ip,
            path: req.path,
            method: req.method,
            userAgent: req.get("user-agent"),
        }, "Global rate limit exceeded");
        res.status(429).json({ error: "Too many requests from this IP, please try again later" });
    },
});

app.use(helmet());
app.get("/favicon.ico", (_req, res) => res.status(204).end());
app.use(globalLimiter);
app.use(cors({
    origin: env.allowedOrigins,
    credentials: true,
}));
app.use(cookieParser());

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRouter);
app.use(express.json());

app.use("/api", layoutRouter);
app.use("/api", reservationsRouter);
app.use("/api/admin", authRouter);
app.use("/api/admin", adminRouter);
logger.info("Admin API routes mounted at /api/admin");

if (process.env.NODE_ENV === "production") {
    const path = require("path");
    const frontendPath = path.join(__dirname, "../frontend/dist");
    app.use(express.static(frontendPath));
    // Express 5 requires named wildcard parameter instead of just '*'
    app.get("*splat", (_req, res) => {
        res.sendFile(path.join(frontendPath, "index.html"));
    });
}

app.use(errorHandler);

export default app;
