export const passwordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  // Hyphen must be at the end to avoid being interpreted as range in regex
  specialChars: '!@#$%^&*_=+[]{}|;:,.<>?-',
};

export const passwordRequirementsMessage =
  'Password must be at least 12 characters long and contain uppercase, lowercase, number, and special character (!@#$%^&*_+-=[]{}|;:,.<>?)';

export function validatePassword(password: string): boolean {
  if (password.length < passwordPolicy.minLength) return false;

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = new RegExp(
    `[${passwordPolicy.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`
  ).test(password);

  return hasUppercase && hasLowercase && hasNumber && hasSpecial;
}
