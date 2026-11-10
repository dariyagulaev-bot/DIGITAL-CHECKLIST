import type { IdentityType } from '@/types';

/**
 * Pure helpers for the PROTECTED user identity (ת״ז / מספר אישי).
 * No DB, no UI — trivially testable. The identity is private: it is never a
 * username/login/display, never shown across the app, and never written in full
 * to ordinary logs (use `maskIdNumber` for audit references).
 */

export function identityTypeLabel(t: IdentityType | undefined): string {
  return t === 'national' ? 'תעודת זהות' : t === 'personal' ? 'מספר אישי' : '—';
}

/** Standard Israeli ID (ת״ז) check-digit validation (1–9 digits, zero-padded). */
export function isValidIsraeliId(id: string): boolean {
  const s = id.trim();
  if (!/^\d{1,9}$/.test(s)) return false;
  const padded = s.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(padded[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * Basic validation by identity type:
 *   • 'national' (ת״ז) — digits only + Israeli check digit.
 *   • 'personal' (מספר אישי) — digits only, 3–10 chars.
 * Returns a human error message, or null when valid.
 */
export function validateIdentity(type: IdentityType, rawNumber: string): string | null {
  const num = (rawNumber ?? '').trim();
  if (!num) return 'יש להזין מספר זיהוי.';
  if (!/^\d+$/.test(num)) return 'מספר הזיהוי יכול להכיל ספרות בלבד.';
  if (type === 'national') {
    if (num.length !== 9) return 'תעודת זהות חייבת להכיל 9 ספרות.';
    if (!isValidIsraeliId(num)) return 'תעודת זהות אינה תקינה (ספרת ביקורת).';
    return null;
  }
  // personal
  if (num.length < 3 || num.length > 10) return 'מספר אישי חייב להכיל בין 3 ל-10 ספרות.';
  return null;
}

/** Mask an identity number for audit references — keeps only the last 4 digits. */
export function maskIdNumber(num: string | undefined | null): string {
  const s = (num ?? '').trim();
  if (!s) return '';
  if (s.length <= 4) return '•'.repeat(s.length);
  return '•'.repeat(s.length - 4) + s.slice(-4);
}
