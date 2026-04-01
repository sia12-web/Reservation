import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
  emailVerified?: boolean;
}

export function requireVerification(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.emailVerified) {
    res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Email verification required. Please verify your email to access this resource.',
    });
    return;
  }

  next();
}
