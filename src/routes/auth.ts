import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../middleware/errorHandler";
import { adminAuth } from "../middleware/auth";
import rateLimit from "express-rate-limit";

const router = Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10, // 10 attempts per 15 mins
    message: { error: "Too many login attempts, please try again after 15 minutes" },
});

router.post(
    "/login",
    loginLimiter,
    asyncHandler(async (req, res) => {
        const { pin } = req.body;

        if (pin !== env.adminPin) {
            throw new HttpError(401, "Invalid admin PIN");
        }

        const token = jwt.sign({ role: "ADMIN" }, env.jwtSecret, {
            expiresIn: "24h",
        });

        res.cookie("admin_token", token, {
            httpOnly: true,
            secure: env.nodeEnv === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });

        res.json({ message: "Login successful" });
    })
);

router.get(
    "/me",
    adminAuth,
    (_req, res) => {
        res.json({ authenticated: true });
    }
);

router.post(
    "/logout",
    (_req, res) => {
        res.clearCookie("admin_token");
        res.json({ message: "Logged out successfully" });
    }
);

export default router;
