export interface SendVerificationEmailParams {
  to: string;
  token: string;
  username: string;
}

export async function sendVerificationEmail({
  to,
  token,
  username,
}: SendVerificationEmailParams): Promise<{ success: boolean }> {
  // Mock implementation for Phase 2
  // In production, integrate with SendGrid/Resend/etc.

  const verificationUrl = `http://localhost:5000/api/auth/verify-email?token=${token}`;

  console.log('=== MOCK EMAIL SERVICE ===');
  console.log(`To: ${to}`);
  console.log(`Subject: Verify your ClassmateFinder account`);
  console.log(`
Hi ${username}!

Please verify your email by clicking the link below:
${verificationUrl}

This link expires in 24 hours.

If you didn't create this account, please ignore this email.
  `);
  console.log('========================');

  return { success: true };
}
