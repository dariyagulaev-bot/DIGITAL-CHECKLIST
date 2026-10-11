/**
 * Pure, offline date helpers for certification validity. Dates are handled as
 * local 'YYYY-MM-DD' strings and computed by CALENDAR MONTHS (never a fixed day
 * count), so different month lengths are handled correctly. No timezone math,
 * no network — everything derives from the device's local date.
 */

/** Today as a local 'YYYY-MM-DD' string. */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse 'YYYY-MM-DD' (or a full ISO string) to {y,m,d}. Returns null if invalid. */
function parts(iso: string | undefined | null): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

const daysInMonth = (y: number, m: number): number => new Date(y, m, 0).getDate(); // m is 1-based

/**
 * Add (or subtract) whole months to an ISO date, clamping the day to the last
 * valid day of the target month (e.g. Jan 31 + 1mo → Feb 28/29).
 */
export function addMonths(iso: string, months: number): string {
  const p = parts(iso);
  if (!p) return iso;
  const total = (p.y * 12 + (p.m - 1)) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1; // 1-based
  const d = Math.min(p.d, daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Compare two ISO dates. <0 if a<b, 0 equal, >0 if a>b. */
export function cmpDate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Whole months + remaining days from `from` to `to` (to ≥ from). Used for the
 * "נותרו X חודשים ו-Y ימים" label. If `to` ≤ `from`, returns zeros.
 */
export function diffMonthsDays(from: string, to: string): { months: number; days: number } {
  const a = parts(from);
  const b = parts(to);
  if (!a || !b) return { months: 0, days: 0 };
  if (cmpDate(from, to) >= 0) return { months: 0, days: 0 };
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  let dayDiff = b.d - a.d;
  if (dayDiff < 0) {
    months -= 1;
    // days from `a.d` to end of a's month, plus b.d
    const prevMonth = b.m - 1 === 0 ? 12 : b.m - 1;
    const prevYear = b.m - 1 === 0 ? b.y - 1 : b.y;
    dayDiff = daysInMonth(prevYear, prevMonth) - a.d + b.d;
  }
  if (months < 0) months = 0;
  return { months, days: dayDiff };
}

/** Human "נותרו X חודשים ו-Y ימים" (Hebrew). */
export function remainingLabel(from: string, to: string): string {
  const { months, days } = diffMonthsDays(from, to);
  const mPart = months > 0 ? `${months} ${months === 1 ? 'חודש' : 'חודשים'}` : '';
  const dPart = days > 0 ? `${days} ${days === 1 ? 'יום' : 'ימים'}` : '';
  if (mPart && dPart) return `${mPart} ו-${dPart}`;
  return mPart || dPart || 'פחות מיום';
}

/** DD.MM.YYYY from an ISO date (display). */
export function dots(iso: string | undefined | null): string {
  const p = parts(iso);
  if (!p) return '—';
  return `${String(p.d).padStart(2, '0')}.${String(p.m).padStart(2, '0')}.${p.y}`;
}
