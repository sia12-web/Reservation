import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
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

app.use(helmet());
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
