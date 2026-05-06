import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";

export class HttpError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ZodError) {
    logger.warn({ err: err.message }, "Validation error");
    const details = process.env.NODE_ENV === "production"
      ? err.issues.map((i) => ({ path: i.path, message: i.message }))
      : err.issues;
    res.status(400).json({ error: "Validation error", details });
    return;
  }

  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, "Server error");
    }
    res.status(err.statusCode).json({ error: err.message, details: [] });
    return;
  }

  // Unexpected errors — log full details server-side, send generic message to client
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
}
