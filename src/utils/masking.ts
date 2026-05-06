/**
 * Utility to mask PII (Personally Identifiable Information) in objects
 * recursively. Replaces email and phone numbers with masked versions.
 */

export function maskPII(obj: any): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => maskPII(item));
    }

    const maskedObj: any = { ...obj };

    for (const key in maskedObj) {
        const val = maskedObj[key];

        if (typeof val === 'string') {
            if (key.toLowerCase().includes('email')) {
                maskedObj[key] = maskEmail(val);
            } else if (key.toLowerCase().includes('phone')) {
                maskedObj[key] = maskPhone(val);
            }
        } else if (typeof val === 'object' && val !== null) {
            maskedObj[key] = maskPII(val);
        }
    }

    return maskedObj;
}

function maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [user, domain] = email.split('@');
    if (user.length <= 2) return `***@${domain}`;
    return `${user.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
    if (!phone) return phone;
    // Keep last 4 digits, mask the rest
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return '****';
    return `***-***-${cleaned.slice(-4)}`;
}
