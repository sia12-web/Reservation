import { isValidUniversityDomain } from '../../src/utils/domainValidator';

describe('Domain Validator', () => {
  it('should accept .edu domains', () => {
    expect(isValidUniversityDomain('user@harvard.edu')).toBe(true);
    expect(isValidUniversityDomain('test@stanford.edu')).toBe(true);
    expect(isValidUniversityDomain('student@mit.edu')).toBe(true);
  });

  it('should accept Canadian university domains', () => {
    expect(isValidUniversityDomain('user@ualberta.ca')).toBe(true);
    expect(isValidUniversityDomain('user@ubc.ca')).toBe(true);
    expect(isValidUniversityDomain('user@utoronto.ca')).toBe(true);
    expect(isValidUniversityDomain('user@mcgill.ca')).toBe(true);
    expect(isValidUniversityDomain('user@uwaterloo.ca')).toBe(true);
  });

  it('should reject non-university domains', () => {
    expect(isValidUniversityDomain('user@gmail.com')).toBe(false);
    expect(isValidUniversityDomain('user@yahoo.com')).toBe(false);
    expect(isValidUniversityDomain('user@outlook.com')).toBe(false);
    expect(isValidUniversityDomain('user@hotmail.com')).toBe(false);
  });

  it('should reject invalid emails', () => {
    expect(isValidUniversityDomain('invalid-email')).toBe(false);
    expect(isValidUniversityDomain('')).toBe(false);
    expect(isValidUniversityDomain('no-at-sign.com')).toBe(false);
  });

  it('should handle case insensitivity', () => {
    expect(isValidUniversityDomain('user@HARVARD.EDU')).toBe(true);
    expect(isValidUniversityDomain('user@UAlberta.CA')).toBe(true);
  });
});
