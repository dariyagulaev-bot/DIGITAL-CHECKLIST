import type { Agorot, DateKey, MonthKey } from '../data/types';

export const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const HEB_MONTHS_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 1234567 agorot -> "12,346" (whole shekels). */
export function shekels(a: Agorot): string {
  return nf0.format(Math.round(a / 100));
}

/** Exact amount with agorot when there are any: 1250 -> "12.5". */
export function shekelsExact(a: Agorot): string {
  return nf2.format(a / 100);
}

export function toAgorot(input: string | number): Agorot {
  const n = typeof input === 'number' ? input : parseFloat(String(input).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function monthKey(d: Date): MonthKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function dateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): DateKey {
  return dateKey(new Date());
}

export function currentMonth(): MonthKey {
  return monthKey(new Date());
}

export function parseMonth(m: MonthKey): { y: number; m: number } {
  const [y, mm] = m.split('-').map(Number);
  return { y, m: mm };
}

export function addMonths(m: MonthKey, delta: number): MonthKey {
  const { y, m: mm } = parseMonth(m);
  return monthKey(new Date(y, mm - 1 + delta, 1));
}

export function daysInMonth(m: MonthKey): number {
  const { y, m: mm } = parseMonth(m);
  return new Date(y, mm, 0).getDate();
}

export function monthLabel(m: MonthKey): string {
  const { y, m: mm } = parseMonth(m);
  return `${HEB_MONTHS[mm - 1]} ${y}`;
}

export function monthShort(m: MonthKey): string {
  return HEB_MONTHS_SHORT[parseMonth(m).m - 1];
}

export function monthOfDate(d: DateKey): MonthKey {
  return d.slice(0, 7);
}

export function dayLabel(d: DateKey): string {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(y, m - 1, day);
  const today = todayKey();
  const yesterday = dateKey(new Date(Date.now() - 864e5));
  const base = `${day} ב${HEB_MONTHS[m - 1]}`;
  if (d === today) return `היום, ${base}`;
  if (d === yesterday) return `אתמול, ${base}`;
  return `יום ${HEB_DAYS[dt.getDay()]}, ${base}`;
}

export function shortDate(d: DateKey): string {
  const [, m, day] = d.split('-');
  return `${day}.${m}`;
}

export function compareMonths(a: MonthKey, b: MonthKey) {
  return a < b ? -1 : a > b ? 1 : 0;
}
