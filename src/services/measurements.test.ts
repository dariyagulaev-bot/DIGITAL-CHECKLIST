import { describe, expect, it } from 'vitest';
import {
  parseNum,
  evaluateDeltaRule,
  tableFailStatus,
  allowedRange,
} from './measurements';
import type { MeasurementRule, TableConfig } from '@/types';

const rule = (allowed: number, failOnExceed = true): MeasurementRule => ({
  id: 'r1',
  type: 'delta',
  initial: { row_id: 'r_init', col_id: 'c_val' },
  final: { row_id: 'r_fin', col_id: 'c_val' },
  allowed_difference: allowed,
  fail_on_exceed: failOnExceed,
});
const cells = (initial: string, final: string) => ({
  'r_init|c_val': initial,
  'r_fin|c_val': final,
});

describe('±X measurement rule (delta)', () => {
  it('passes on and inside the allowed band; boundary values count as PASS', () => {
    const r = rule(25);
    expect(evaluateDeltaRule(r, cells('100', '90')).passed).toBe(true); // diff -10
    expect(evaluateDeltaRule(r, cells('100', '103')).passed).toBe(true); // diff +3
    expect(evaluateDeltaRule(r, cells('100', '75')).passed).toBe(true); // diff -25 (boundary)
    expect(evaluateDeltaRule(r, cells('100', '125')).passed).toBe(true); // diff +25 (boundary)
  });

  it('fails when the absolute difference exceeds the allowed gap', () => {
    const r = rule(25);
    expect(evaluateDeltaRule(r, cells('100', '50')).passed).toBe(false); // diff -50
    expect(evaluateDeltaRule(r, cells('100', '130')).passed).toBe(false); // diff +30
  });

  it('keeps the SIGNED difference (direction), not just magnitude', () => {
    expect(evaluateDeltaRule(rule(25), cells('100', '90')).difference).toBe(-10);
    expect(evaluateDeltaRule(rule(25), cells('100', '103')).difference).toBe(3);
    expect(evaluateDeltaRule(rule(25), cells('100', '50')).difference).toBe(-50);
  });

  it('handles 0, negatives and decimals numerically (never string concat)', () => {
    expect(evaluateDeltaRule(rule(25), cells('0', '0')).difference).toBe(0);
    expect(evaluateDeltaRule(rule(25), cells('0', '0')).passed).toBe(true);
    // -10 → -30 : diff -20 within ±25 → PASS
    expect(evaluateDeltaRule(rule(25), cells('-10', '-30')).passed).toBe(true);
    expect(evaluateDeltaRule(rule(25), cells('-10', '-30')).difference).toBe(-20);
    // decimals: 1.5 → 1.75 diff 0.25 within ±0.3
    const res = evaluateDeltaRule(rule(0.3), cells('1.5', '1.75'));
    expect(res.difference).toBeCloseTo(0.25, 10);
    expect(res.passed).toBe(true);
  });

  it('returns null (not NaN/undefined) when an input is missing or invalid', () => {
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
    expect(parseNum(undefined)).toBeNull();
    const missingFinal = evaluateDeltaRule(rule(25), { 'r_init|c_val': '100' });
    expect(missingFinal.passed).toBeNull();
    expect(missingFinal.difference).toBeNull();
    const missingInitial = evaluateDeltaRule(rule(25), { 'r_fin|c_val': '100' });
    expect(missingInitial.passed).toBeNull();
    const invalid = evaluateDeltaRule(rule(25), cells('abc', '100'));
    expect(invalid.passed).toBeNull();
  });

  it('computes the allowed display range around the initial value', () => {
    expect(allowedRange(100, 25)).toEqual({ min: 75, max: 125 });
    expect(allowedRange(null, 25)).toBeNull();
  });

  it('table fail-status: לא תקין on exceed, תקין once decided & passed, null while incomplete', () => {
    const cfg: TableConfig = {
      title: 't',
      columns: [{ id: 'c_val', label: 'ערך', field_type: 'number' }],
      rows: [{ id: 'r_init', label: 'התחלה' }, { id: 'r_fin', label: 'סיום' }],
      rules: [rule(25)],
    };
    // incomplete → null
    expect(tableFailStatus(cfg, [evaluateDeltaRule(rule(25), { 'r_init|c_val': '100' })])).toBeNull();
    // passing → true (תקין)
    expect(tableFailStatus(cfg, [evaluateDeltaRule(rule(25), cells('100', '90'))])).toBe(true);
    // exceeding → false (לא תקין)
    expect(tableFailStatus(cfg, [evaluateDeltaRule(rule(25), cells('100', '50'))])).toBe(false);
    // a rule without fail_on_exceed never forces a status
    const cfg2: TableConfig = { ...cfg, rules: [rule(25, false)] };
    expect(tableFailStatus(cfg2, [evaluateDeltaRule(rule(25, false), cells('100', '50'))])).toBeNull();
  });
});
