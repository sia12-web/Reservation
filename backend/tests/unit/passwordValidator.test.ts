import { validatePassword, passwordRequirementsMessage } from '../../src/utils/passwordValidator';

describe('Password Validator', () => {
  describe('validatePassword', () => {
    it('should reject passwords shorter than 12 characters', () => {
      expect(validatePassword('Short1!')).toBe(false);
      expect(validatePassword('ShortPass1!')).toBe(false);
    });

    it('should reject passwords without uppercase', () => {
      expect(validatePassword('lowercase123!')).toBe(false);
      expect(validatePassword('nouppercase1!')).toBe(false);
    });

    it('should reject passwords without lowercase', () => {
      expect(validatePassword('UPPERCASE123!')).toBe(false);
      expect(validatePassword('NOLOWERCASE1!')).toBe(false);
    });

    it('should reject passwords without numbers', () => {
      expect(validatePassword('NoNumbers!')).toBe(false);
      expect(validatePassword('OnlySpecial!')).toBe(false);
    });

    it('should reject passwords without special characters', () => {
      expect(validatePassword('NoSpecial123')).toBe(false);
      expect(validatePassword('OnlyLetters123')).toBe(false);
    });

    it('should accept valid passwords', () => {
      expect(validatePassword('SecurePass123!')).toBe(true);
      expect(validatePassword('MyP@ssword12345')).toBe(true);
      expect(validatePassword('Complex!ty2026')).toBe(true);
    });

    it('should accept all required special characters', () => {
      const specialChars = '!@#$%^&*_=+[]{}|;:,.<>?-';
      specialChars.split('').forEach((char) => {
        expect(validatePassword(`TestPass123${char}`)).toBe(true);
      });
    });
  });

  describe('passwordRequirementsMessage', () => {
    it('should contain all requirements', () => {
      expect(passwordRequirementsMessage).toContain('12');
      expect(passwordRequirementsMessage).toContain('uppercase');
      expect(passwordRequirementsMessage).toContain('lowercase');
      expect(passwordRequirementsMessage).toContain('number');
      expect(passwordRequirementsMessage).toContain('special');
    });
  });
});
