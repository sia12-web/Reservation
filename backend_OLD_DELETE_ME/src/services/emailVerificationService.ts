import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';

export async function generateVerificationToken(userId: string): Promise<string> {
  // Generate UUID v4 token (122 bits entropy)
  const token = uuidv4();

  // Hash token with bcrypt (10 rounds)
  const tokenHash = await bcrypt.hash(token, 10);

  // Set expiry to 24 hours from now
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  // Delete any existing tokens for this user (enforce @@unique([userId]))
  await prisma.emailVerificationToken.deleteMany({
    where: { userId },
  });

  // Store hashed token
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return token; // Return plaintext token for email
}

export async function verifyEmailToken(token: string): Promise<{ userId: string } | null> {
  // Find all non-expired tokens (we need to check hash)
  const validTokens = await prisma.emailVerificationToken.findMany({
    where: {
      expiresAt: { gte: new Date() },
    },
  });

  // Check each token hash
  for (const record of validTokens) {
    const isValid = await bcrypt.compare(token, record.tokenHash);

    if (isValid) {
      // Delete the used token (one-time use)
      await prisma.emailVerificationToken.delete({
        where: { id: record.id },
      });

      return { userId: record.userId };
    }
  }

  return null;
}

export async function cleanupExpiredTokens(): Promise<void> {
  await prisma.emailVerificationToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}
