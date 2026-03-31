import { env } from '../config/env';

export function isValidUniversityDomain(email: string): boolean {
  const emailDomain = email.split('@')[1]?.toLowerCase();

  if (!emailDomain) {
    return false;
  }

  return env.UNIVERSITY_DOMAINS.some((allowedDomain) => {
    if (allowedDomain.startsWith('.')) {
      // Match domain or subdomain
      return emailDomain === allowedDomain.slice(1) || emailDomain.endsWith(allowedDomain);
    }
    return emailDomain === allowedDomain;
  });
}
