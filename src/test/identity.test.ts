import { describe, it, expect } from 'vitest';
import {
  identityTypeLabel,
  isValidIsraeliId,
  validateIdentity,
  maskIdNumber,
} from '@/services/identity';

describe('identity helpers', () => {
  it('labels identity types', () => {
    expect(identityTypeLabel('personal')).toBe('מספר אישי');
    expect(identityTypeLabel('national')).toBe('תעודת זהות');
    expect(identityTypeLabel(undefined)).toBe('—');
  });

  it('validates Israeli ID check digit', () => {
    // Known-valid ת״ז samples (check digit correct).
    expect(isValidIsraeliId('000000018')).toBe(true);
    expect(isValidIsraeliId('123456782')).toBe(true);
    // Wrong check digit.
    expect(isValidIsraeliId('123456789')).toBe(false);
    // Non-digits.
    expect(isValidIsraeliId('12a456782')).toBe(false);
    // Zero-padding works for short numbers.
    expect(isValidIsraeliId('18')).toBe(true);
  });

  it('validateIdentity: national requires 9 digits + valid check digit', () => {
    expect(validateIdentity('national', '')).toMatch(/יש להזין/);
    expect(validateIdentity('national', '12345')).toMatch(/9 ספרות/);
    expect(validateIdentity('national', '123456789')).toMatch(/ספרת ביקורת/);
    expect(validateIdentity('national', '123456782')).toBeNull();
    expect(validateIdentity('national', '12345678a')).toMatch(/ספרות בלבד/);
  });

  it('validateIdentity: personal is 3–10 digits, no check digit', () => {
    expect(validateIdentity('personal', '12')).toMatch(/בין 3 ל-10/);
    expect(validateIdentity('personal', '123')).toBeNull();
    expect(validateIdentity('personal', '1234567890')).toBeNull();
    expect(validateIdentity('personal', '12345678901')).toMatch(/בין 3 ל-10/);
    expect(validateIdentity('personal', '12x')).toMatch(/ספרות בלבד/);
  });

  it('maskIdNumber keeps only the last 4 digits', () => {
    expect(maskIdNumber('123456782')).toBe('•••••6782');
    expect(maskIdNumber('1234')).toBe('••••');
    expect(maskIdNumber('12')).toBe('••');
    expect(maskIdNumber('')).toBe('');
    expect(maskIdNumber(undefined)).toBe('');
  });
});
