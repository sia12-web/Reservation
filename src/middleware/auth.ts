import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "./errorHandler";
import { logger } from "../config/logger";

export function adminAuth(req: Request, _res: Response, next: NextFunction) {
    const token = req.cookies?.admin_token;
    if (token) {
        try {
            const decoded = jwt.verify(token, env.jwtSecret) as { role: string };
            if (decoded.role === "ADMIN") {
                return next();
            }
        } catch {
            // Token invalid or expired
        }
    }

    logger.warn({ ip: req.ip, path: req.path }, "Admin auth failed: no valid token");
    throw new HttpError(401, "Invalid or missing admin session");
}
