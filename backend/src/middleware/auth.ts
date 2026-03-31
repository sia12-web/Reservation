import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  userId?: string;
  emailVerified?: boolean;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      code: 'INVALID_CREDENTIALS',
      message: 'Authentication required',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof (decoded as any).userId === 'string' &&
      typeof (decoded as any).emailVerified === 'boolean'
    ) {
      req.userId = (decoded as any).userId;
      req.emailVerified = (decoded as any).emailVerified;
      next();
    } else {
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid token payload',
      });
    }
  } catch (error) {
    res.status(401).json({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid or expired token',
    });
  }
}
