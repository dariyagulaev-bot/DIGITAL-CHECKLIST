import { describe, expect, it } from 'vitest';
import { computeDuration, evaluateTableFull, formatDuration } from './measurements';
import type { TableConfig } from '@/types';

const C_NUM = 'c_num';
const C_DT = 'c_dt';
const R_INIT = 'r_init';
const R_FIN = 'r_fin';

/** A table with a ±25 gap rule and a 6-hour (360 min) minimum duration. */
function cfg(minMinutes = 360): TableConfig {
  return {
    title: 'מדידה',
    columns: [
      { id: C_NUM, label: 'מספר', field_type: 'number' },
      { id: C_DT, label: 'תאריך ושעה', field_type: 'datetime' },
    ],
    rows: [
      { id: R_INIT, label: 'תחילת מדידה' },
      { id: R_FIN, label: 'סיום מדידה' },
    ],
    rules: [
      { id: 'g', type: 'delta', initial: { row_id: R_INIT, col_id: C_NUM }, final: { row_id: R_FIN, col_id: C_NUM }, allowed_difference: 25, fail_on_exceed: true },
    ],
    duration: { start: { row_id: R_INIT, col_id: C_DT }, end: { row_id: R_FIN, col_id: C_DT }, min_minutes: minMinutes },
  };
}
const cells = (startDt: string, endDt: string, initNum = '100', finNum = '90') => ({
  [`${R_INIT}|${C_DT}`]: startDt,
  [`${R_FIN}|${C_DT}`]: endDt,
  [`${R_INIT}|${C_NUM}`]: initNum,
  [`${R_FIN}|${C_NUM}`]: finNum,
});

describe('minimum measurement duration', () => {
  it('actual < minimum → FAIL; == minimum → PASS; > minimum → PASS', () => {
    // 5h59 < 6h → fail
    expect(computeDuration('2026-10-12T08:00', '2026-10-12T13:59', 360).passed).toBe(false);
    // exactly 6h → pass
    expect(computeDuration('2026-10-12T08:00', '2026-10-12T14:00', 360).passed).toBe(true);
    // 6h30 → pass
    expect(computeDuration('2026-10-12T08:00', '2026-10-12T14:30', 360).passed).toBe(true);
    // 8h, 10h → pass
    expect(computeDuration('2026-10-12T08:00', '2026-10-12T16:00', 360).passed).toBe(true);
    expect(computeDuration('2026-10-12T08:00', '2026-10-12T18:00', 360).passed).toBe(true);
  });

  it('crosses midnight correctly', () => {
    // 22:00 → 05:00 next day = 7h → pass
    const d = computeDuration('2026-10-12T22:00', '2026-10-13T05:00', 360);
    expect(d.actual_minutes).toBe(420);
    expect(d.passed).toBe(true);
  });

  it('supports measurements longer than 24 hours', () => {
    const d = computeDuration('2026-10-12T08:00', '2026-10-14T10:30', 360);
    expect(d.actual_minutes).toBe(2 * 1440 + 150); // 2 days 2h30
    expect(formatDuration(d.actual_minutes)).toBe('2 ימים ו-2 שעות ו-30 דקות');
    expect(d.passed).toBe(true);
  });

  it('flags end-before-start as invalid (fail)', () => {
    const d = computeDuration('2026-10-12T14:00', '2026-10-12T08:00', 360);
    expect(d.invalid).toBe(true);
    expect(d.passed).toBe(false);
  });

  it('missing endpoint → incomplete (null), never NaN', () => {
    expect(computeDuration('2026-10-12T08:00', '', 360).passed).toBeNull();
    expect(computeDuration('', '2026-10-12T14:00', 360).passed).toBeNull();
  });

  it('combined result: both conditions must pass', () => {
    const c = cfg(360);
    // 7h, gap -10 → PASS
    let f = evaluateTableFull(c, cells('2026-10-12T08:00', '2026-10-12T15:00', '100', '90'));
    expect(f.status).toBe('pass');
    // 5h, gap -10 → FAIL (time)
    f = evaluateTableFull(c, cells('2026-10-12T08:00', '2026-10-12T13:00', '100', '90'));
    expect(f.status).toBe('fail');
    expect(f.fail_reasons.join(' ')).toContain('משך המדידה');
    // 7h, gap -50 → FAIL (gap)
    f = evaluateTableFull(c, cells('2026-10-12T08:00', '2026-10-12T15:00', '100', '50'));
    expect(f.status).toBe('fail');
    expect(f.fail_reasons.join(' ')).toContain('הפער');
    // 5h, gap -50 → FAIL (both reasons)
    f = evaluateTableFull(c, cells('2026-10-12T08:00', '2026-10-12T13:00', '100', '50'));
    expect(f.status).toBe('fail');
    expect(f.fail_reasons.length).toBe(2);
  });

  it('missing value → incomplete, not pass/fail', () => {
    const c = cfg(360);
    const f = evaluateTableFull(c, {
      [`${R_INIT}|${C_DT}`]: '2026-10-12T08:00',
      [`${R_INIT}|${C_NUM}`]: '100',
      // end datetime + end number missing
    });
    expect(f.status).toBe('incomplete');
  });

  it('formatDuration reads naturally', () => {
    expect(formatDuration(360)).toBe('6 שעות');
    expect(formatDuration(390)).toBe('6 שעות ו-30 דקות');
    expect(formatDuration(120)).toBe('2 שעות');
    expect(formatDuration(45)).toBe('45 דקות');
    expect(formatDuration(null)).toBe('—');
  });
});

describe('timer-mode minimum duration (Start/Stop device clock)', () => {
  /** Timer-mode table: no datetime cells; duration comes from Start/Stop stamps. */
  function tcfg(minMinutes = 360): TableConfig {
    return {
      title: 'מדידה',
      columns: [{ id: C_NUM, label: 'מספר', field_type: 'number' }],
      rows: [
        { id: R_INIT, label: 'תחילת מדידה' },
        { id: R_FIN, label: 'סיום מדידה' },
      ],
      rules: [
        { id: 'g', type: 'delta', initial: { row_id: R_INIT, col_id: C_NUM }, final: { row_id: R_FIN, col_id: C_NUM }, allowed_difference: 25, fail_on_exceed: true },
      ],
      duration: { mode: 'timer', min_minutes: minMinutes },
    };
  }
  const nums = (initNum = '100', finNum = '90') => ({ [`${R_INIT}|${C_NUM}`]: initNum, [`${R_FIN}|${C_NUM}`]: finNum });

  it('no Start → duration incomplete (table incomplete, never NaN)', () => {
    const f = evaluateTableFull(tcfg(360), nums(), {});
    expect(f.duration_result?.passed).toBeNull();
    expect(f.status).toBe('incomplete');
  });

  it('Started but not Stopped → incomplete', () => {
    const f = evaluateTableFull(tcfg(360), nums(), { started_at: '2026-10-12T08:00', ended_at: null });
    expect(f.status).toBe('incomplete');
  });

  it('Stop before minimum elapsed → FAIL; enough elapsed + gap ok → PASS', () => {
    // 5h elapsed < 6h → fail (time)
    let f = evaluateTableFull(tcfg(360), nums('100', '90'), { started_at: '2026-10-12T08:00', ended_at: '2026-10-12T13:00' });
    expect(f.status).toBe('fail');
    expect(f.fail_reasons.join(' ')).toContain('משך המדידה');
    // 7h elapsed, gap -10 → pass
    f = evaluateTableFull(tcfg(360), nums('100', '90'), { started_at: '2026-10-12T08:00', ended_at: '2026-10-12T15:00' });
    expect(f.status).toBe('pass');
    expect(f.duration_result?.actual_minutes).toBe(420);
  });

  it('enforces the minimum even when the gap passes', () => {
    // enough gap but only 1h elapsed → still fails on time
    const f = evaluateTableFull(tcfg(360), nums('100', '100'), { started_at: '2026-10-12T08:00', ended_at: '2026-10-12T09:00' });
    expect(f.status).toBe('fail');
  });
});
