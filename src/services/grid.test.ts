import { describe, it, expect } from 'vitest';
import { parseTimeOfDay, cellDurationMinutes, evaluateGrid } from './measurements';
import type { TableConfig } from '@/types';

const cfg: TableConfig = {
  title: 'תת־מערכות',
  layout: 'grid',
  columns: [
    { id: 'name', label: 'תת מערכת', field_type: 'short_text' },
    { id: 'init', label: 'מספר התחלה', field_type: 'number' },
    { id: 'fin', label: 'מספר סיום', field_type: 'number' },
    { id: 'diff', label: 'פער', field_type: 'calc', calc: { kind: 'difference', from: 'init', to: 'fin' }, allowed_difference: 25 },
    { id: 'st', label: 'שעת התחלה', field_type: 'time' },
    { id: 'en', label: 'שעת סיום', field_type: 'time' },
    { id: 'dur', label: 'משך', field_type: 'calc', calc: { kind: 'duration', from: 'st', to: 'en' }, min_minutes: 180 },
    { id: 'res', label: 'תוצאה', field_type: 'result' },
  ],
  rows: [
    { id: 'r1', label: '' },
    { id: 'r2', label: '' },
    { id: 'r3', label: '' },
    { id: 'r4', label: '' },
  ],
};

const cells: Record<string, string> = {
  // r1 — passes both
  'r1|init': '1000', 'r1|fin': '1018', 'r1|st': '08:00', 'r1|en': '11:20',
  // r2 — gap too big (31 > 25)
  'r2|init': '1000', 'r2|fin': '1031', 'r2|st': '08:00', 'r2|en': '11:20',
  // r3 — duration too short (160 < 180)
  'r3|init': '1000', 'r3|fin': '1010', 'r3|st': '08:00', 'r3|en': '10:40',
  // r4 — empty → pending
};

describe('sub-system grid engine', () => {
  it('parses time-of-day', () => {
    expect(parseTimeOfDay('08:00')).toBe(480);
    expect(parseTimeOfDay('11:20')).toBe(680);
    expect(parseTimeOfDay('bad')).toBeNull();
  });

  it('computes time duration, including across midnight', () => {
    expect(cellDurationMinutes('08:00', '11:20', 'time')).toBe(200);
    expect(cellDurationMinutes('23:00', '01:00', 'time')).toBe(120);
    expect(cellDurationMinutes('08:00', '', 'time')).toBeNull();
  });

  it('evaluates each sub-system row independently', () => {
    const res = evaluateGrid(cfg, cells);
    const by = Object.fromEntries(res.map((r) => [r.row_id, r]));
    // r1 passes
    expect(by.r1.calc.diff).toBe(18);
    expect(by.r1.calc.dur).toBe(200);
    expect(by.r1.pass).toBe(true);
    expect(by.r1.reasons).toHaveLength(0);
    // r2 fails on gap
    expect(by.r2.calc.diff).toBe(31);
    expect(by.r2.pass).toBe(false);
    expect(by.r2.reasons.join(' ')).toMatch(/פער/);
    // r3 fails on duration
    expect(by.r3.calc.dur).toBe(160);
    expect(by.r3.pass).toBe(false);
    expect(by.r3.reasons.join(' ')).toMatch(/זמן/);
    // r4 empty → pending
    expect(by.r4.pass).toBeNull();
  });

  it('is incomplete (pending) when a thresholded calc is missing data', () => {
    const partial = { 'r1|init': '1000', 'r1|st': '08:00' }; // no final / end
    const [r1] = evaluateGrid(cfg, partial);
    expect(r1.pass).toBeNull();
  });
});
