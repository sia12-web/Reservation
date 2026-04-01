import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { env } from '../config/env';
import { isValidUniversityDomain } from '../utils/domainValidator';
import { generateVerificationToken, verifyEmailToken } from '../services/emailVerificationService';
import { sendVerificationEmail } from '../services/emailService';

// Helper to generate JWT
function generateToken(userId: string, emailVerified: boolean): string {
  const options = {
    expiresIn: env.JWT_EXPIRES_IN,
  };
  return jwt.sign({ userId, emailVerified }, env.JWT_SECRET, options as any);
}

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password, firstName, lastName } = req.body;

    // Validate university domain
    if (!isValidUniversityDomain(email)) {
      res.status(400).json({
        code: 'DOMAIN_NOT_ALLOWED',
        message: 'Email domain is not allowed. Please use a university email address.',
      });
      return;
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      // GENERIC RESPONSE TO PREVENT ENUMERATION
      // Log internally for monitoring but don't reveal to user
      console.log(`Registration attempt with existing email: ${email}`);
      res.status(201).json({
        user: null,
        requiresVerification: true,
        message: 'If your account exists, you will receive a verification email.',
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (emailVerified = false by default)
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Generate verification token
    const token = await generateVerificationToken(user.id);

    // Send verification email
    await sendVerificationEmail({
      to: user.email,
      token,
      username: user.username,
    });

    // Return response per OpenAPI contract
    res.status(201).json({
      user,
      requiresVerification: true,
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Failed to register user',
    });
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
        password: true,
      },
    });

    if (!user) {
      // TIMING-SAFE: Always perform bcrypt comparison to prevent timing attacks
      await bcrypt.compare(password, '$2a$10$dummy.hash.for.timing.attack');
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    // Check email verification - GENERIC RESPONSE
    if (!user.emailVerified) {
      // Log internally for debugging but don't reveal to user
      console.log(`Login attempt for unverified user: ${email}`);
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate token
    const accessToken = generateToken(user.id, user.emailVerified);

    res.json({
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Failed to login',
    });
  }
};

// POST /api/auth/verify-email
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Token is required',
      });
      return;
    }

    // Verify token
    const result = await verifyEmailToken(token);

    if (!result) {
      res.status(400).json({
        code: 'TOKEN_INVALID',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Update user emailVerified
    await prisma.user.update({
      where: { id: result.userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
      emailVerified: true,
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Failed to verify email',
    });
  }
};

// POST /api/auth/resend-verification
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Email is required',
      });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Generic response (prevents enumeration)
    // Even if user doesn't exist, return success

    if (user && !user.emailVerified) {
      // Generate new token (invalidates old one)
      const token = await generateVerificationToken(user.id);

      // Send verification email
      await sendVerificationEmail({
        to: user.email,
        token,
        username: user.username,
      });
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, a verification link has been sent.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Failed to resend verification email',
    });
  }
};
