/**
 * Offline Hebrew (Jewish) calendar conversion — NO network, no libraries.
 * Implements the standard arithmetic Hebrew calendar (Dershowitz–Reingold,
 * "Calendrical Calculations"). Produces e.g. "כ״ט בְּחֶשְׁוָן תשפ״ז" → here
 * rendered plainly as "כ״ט בחשוון תשפ״ז".
 */

const HEBREW_EPOCH = -1373427; // R.D. of 1 Tishrei, year 1

function isGregLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Rata Die (fixed day number) from a Gregorian date. */
function gregorianToFixed(year: number, month: number, day: number): number {
  return (
    365 * (year - 1) +
    Math.floor((year - 1) / 4) -
    Math.floor((year - 1) / 100) +
    Math.floor((year - 1) / 400) +
    Math.floor((367 * month - 362) / 12) +
    (month <= 2 ? 0 : isGregLeap(year) ? -1 : -2) +
    day
  );
}

export function hebrewLeapYear(year: number): boolean {
  return (7 * year + 1) % 19 < 7;
}

function lastMonthOfHebrewYear(year: number): number {
  return hebrewLeapYear(year) ? 13 : 12;
}

/** Days from the Hebrew epoch to the molad-based new year of `year`. */
function hebrewCalendarElapsedDays(year: number): number {
  const monthsElapsed = Math.floor((235 * year - 234) / 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  let day = 29 * monthsElapsed + Math.floor(partsElapsed / 25920);
  if ((3 * (day + 1)) % 7 < 3) day += 1; // postponement
  return day;
}

function hebrewYearLengthCorrection(year: number): number {
  const ny0 = hebrewCalendarElapsedDays(year - 1);
  const ny1 = hebrewCalendarElapsedDays(year);
  const ny2 = hebrewCalendarElapsedDays(year + 1);
  if (ny2 - ny1 === 356) return 2;
  if (ny1 - ny0 === 382) return 1;
  return 0;
}

/** R.D. of 1 Tishrei (Rosh Hashanah) of the given Hebrew year. */
function hebrewNewYear(year: number): number {
  return HEBREW_EPOCH + hebrewCalendarElapsedDays(year) + hebrewYearLengthCorrection(year);
}

export function daysInHebrewYear(year: number): number {
  return hebrewNewYear(year + 1) - hebrewNewYear(year);
}

function longHeshvan(year: number): boolean {
  return daysInHebrewYear(year) % 10 === 5;
}
function shortKislev(year: number): boolean {
  return daysInHebrewYear(year) % 10 === 3;
}

/** Length of a Hebrew month (month numbering: Nisan=1 … Tishrei=7 … Adar II=13). */
export function lastDayOfHebrewMonth(year: number, month: number): number {
  if ([2, 4, 6, 10, 13].includes(month)) return 29; // Iyar, Tammuz, Elul, Tevet, Adar II
  if (month === 12 && !hebrewLeapYear(year)) return 29; // Adar (common year)
  if (month === 8 && !longHeshvan(year)) return 29; // Heshvan
  if (month === 9 && shortKislev(year)) return 29; // Kislev
  return 30;
}

/** R.D. from a Hebrew date. */
function hebrewToFixed(year: number, month: number, day: number): number {
  let f = hebrewNewYear(year) + day - 1;
  if (month < 7) {
    const last = lastMonthOfHebrewYear(year);
    for (let m = 7; m <= last; m++) f += lastDayOfHebrewMonth(year, m);
    for (let m = 1; m < month; m++) f += lastDayOfHebrewMonth(year, m);
  } else {
    for (let m = 7; m < month; m++) f += lastDayOfHebrewMonth(year, m);
  }
  return f;
}

export interface HebrewDate {
  year: number;
  month: number; // 1=Nisan … 7=Tishrei … 13=Adar II
  day: number;
}

function fixedToHebrew(fixed: number): HebrewDate {
  let year = Math.floor((fixed - HEBREW_EPOCH) / 366);
  while (hebrewNewYear(year + 1) <= fixed) year++;
  let month = fixed < hebrewToFixed(year, 1, 1) ? 7 : 1;
  while (fixed > hebrewToFixed(year, month, lastDayOfHebrewMonth(year, month))) month++;
  const day = fixed - hebrewToFixed(year, month, 1) + 1;
  return { year, month, day };
}

/** Convert a Gregorian YYYY-MM-DD (or Date) to a Hebrew date. */
export function gregorianToHebrew(input: string | Date): HebrewDate {
  const d = typeof input === 'string' ? parseIsoDate(input) : input;
  return fixedToHebrew(gregorianToFixed(d.getFullYear(), d.getMonth() + 1, d.getDate()));
}

function parseIsoDate(iso: string): Date {
  // Parse YYYY-MM-DD as a LOCAL date (avoid UTC shifting the day).
  const [y, m, d] = iso.slice(0, 10).split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

// --- Names + gematria -------------------------------------------------------

const MONTH_NAMES: Record<number, string> = {
  1: 'ניסן',
  2: 'אייר',
  3: 'סיוון',
  4: 'תמוז',
  5: 'אב',
  6: 'אלול',
  7: 'תשרי',
  8: 'חשוון',
  9: 'כסלו',
  10: 'טבת',
  11: 'שבט',
  13: 'אדר ב׳',
};

export function hebrewMonthName(year: number, month: number): string {
  if (month === 12) return hebrewLeapYear(year) ? 'אדר א׳' : 'אדר';
  return MONTH_NAMES[month] ?? '';
}

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

/** Hebrew-numeral letters for n (1..999), no punctuation. */
function gematriaLetters(n: number): string {
  let out = '';
  let h = Math.floor(n / 100);
  n %= 100;
  while (h >= 4) {
    out += 'ת';
    h -= 4;
  }
  out += HUNDREDS[h];
  if (n === 15) out += 'טו';
  else if (n === 16) out += 'טז';
  else {
    out += TENS[Math.floor(n / 10)];
    out += ONES[n % 10];
  }
  return out;
}

/** Add geresh (׳) / gershayim (״) punctuation to a gematria string. */
function punctuateGematria(letters: string): string {
  if (letters.length === 0) return letters;
  if (letters.length === 1) return letters + '׳';
  return letters.slice(0, -1) + '״' + letters.slice(-1);
}

export function hebrewDayGematria(day: number): string {
  return punctuateGematria(gematriaLetters(day));
}

/** Year without the thousands (5787 → "תשפ״ז"). */
export function hebrewYearGematria(year: number): string {
  return punctuateGematria(gematriaLetters(year % 1000));
}

/** Full Hebrew date string, e.g. "כ״ט בחשוון תשפ״ז". */
export function formatHebrewDate(input: string | Date): string {
  const h = gregorianToHebrew(input);
  return `${hebrewDayGematria(h.day)} ב${hebrewMonthName(h.year, h.month)} ${hebrewYearGematria(h.year)}`;
}
