import { describe, it, expect } from 'vitest';
import {
  gregorianToHebrew,
  formatHebrewDate,
  hebrewDayGematria,
  hebrewYearGematria,
  hebrewMonthName,
  hebrewLeapYear,
} from '@/services/hebrewDate';

describe('Hebrew calendar conversion (offline)', () => {
  it('known anchor: 1 Tishrei 5785 = 3 Oct 2024 (Rosh Hashanah)', () => {
    const h = gregorianToHebrew('2024-10-03');
    expect(h).toEqual({ year: 5785, month: 7, day: 1 });
  });

  it('known anchor: 1 Tishrei 5787 = 12 Sep 2026', () => {
    const h = gregorianToHebrew('2026-09-12');
    expect(h).toEqual({ year: 5787, month: 7, day: 1 });
  });

  it('known anchor: 23 Tevet 5760 = 1 Jan 2000', () => {
    const h = gregorianToHebrew('2000-01-01');
    expect(h).toEqual({ year: 5760, month: 10, day: 23 });
  });

  it('leap-year detection matches the 19-year cycle', () => {
    expect(hebrewLeapYear(5784)).toBe(true); // 5784 is a leap year
    expect(hebrewLeapYear(5785)).toBe(false);
    expect(hebrewLeapYear(5787)).toBe(true);
  });

  it('month name handles Adar in common vs leap years', () => {
    expect(hebrewMonthName(5785, 12)).toBe('אדר'); // common year
    expect(hebrewMonthName(5784, 12)).toBe('אדר א׳'); // leap year
    expect(hebrewMonthName(5784, 13)).toBe('אדר ב׳');
  });

  it('gematria for days and years', () => {
    expect(hebrewDayGematria(29)).toBe('כ״ט');
    expect(hebrewDayGematria(15)).toBe('ט״ו'); // special 15
    expect(hebrewDayGematria(16)).toBe('ט״ז'); // special 16
    expect(hebrewDayGematria(1)).toBe('א׳');
    expect(hebrewYearGematria(5787)).toBe('תשפ״ז');
    expect(hebrewYearGematria(5785)).toBe('תשפ״ה');
  });

  it('formats a full Hebrew date string', () => {
    // 10 Nov 2026 → verify it produces a sane "<day> ב<month> <year>" string.
    const s = formatHebrewDate('2026-11-10');
    expect(s).toMatch(/^[֐-׿״׳]+ ב[֐-׿׳ ]+ [֐-׿״׳]+$/);
    // Specifically it falls in Kislev/Heshvan 5787.
    const h = gregorianToHebrew('2026-11-10');
    expect(h.year).toBe(5787);
  });
});
