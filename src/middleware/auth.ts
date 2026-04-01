import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "./errorHandler";

export function adminAuth(req: Request, _res: Response, next: NextFunction) {
    // 1. Try JWT from cookies
    const token = req.cookies?.admin_token;
    if (token) {
        try {
            const decoded = jwt.verify(token, env.jwtSecret) as { role: string };
            if (decoded.role === "ADMIN") {
                return next();
            }
        } catch (err) {
            // Token invalid or expired, fall through to PIN check
        }
    }

    // 2. Fallback to PIN header
    const pin = req.headers["x-admin-pin"];

    if (pin !== env.adminPin) {
        console.warn("Admin auth failed: No valid token and PIN mismatch");
        throw new HttpError(401, "Invalid or missing admin session");
    }

    next();
}
