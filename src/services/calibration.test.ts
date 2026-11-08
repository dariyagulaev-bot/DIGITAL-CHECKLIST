import { describe, it, expect } from 'vitest';
import { calibrationState, calibratedItems, taskHasExpiredCalibration } from './calibration';
import type { EquipmentCalibration } from '@/types';

describe('calibrationState', () => {
  it('is valid when expiry is after the inspection date', () => {
    expect(calibrationState('2027-03-15', '2026-11-08')).toBe('valid');
  });
  it('is valid on the expiry day itself (inclusive)', () => {
    expect(calibrationState('2026-11-08', '2026-11-08')).toBe('valid');
  });
  it('is expired when expiry is before the inspection date', () => {
    expect(calibrationState('2026-11-07', '2026-11-08')).toBe('expired');
  });
  it('is unknown without an expiry', () => {
    expect(calibrationState(undefined, '2026-11-08')).toBe('unknown');
    expect(calibrationState('', '2026-11-08')).toBe('unknown');
  });
  it('tolerates full ISO datetimes (compares the date part only)', () => {
    expect(calibrationState('2026-11-08T23:59:00.000Z', '2026-11-08')).toBe('valid');
  });
});

describe('calibratedItems', () => {
  const items = ['מברג', 'מד לחץ', 'מד מתח'];
  const cal: (EquipmentCalibration | null)[] = [
    null,
    { requires_calibration: true, serial_number: '45821', calibration_expiry: '2027-03-15' },
    { requires_calibration: true, serial_number: '77124', calibration_expiry: '2026-01-01' },
  ];
  it('returns only the items that require calibration, with their names', () => {
    const out = calibratedItems(items, cal);
    expect(out.map((o) => o.name)).toEqual(['מד לחץ', 'מד מתח']);
    expect(out[0].cal.serial_number).toBe('45821');
  });
  it('returns nothing when there is no calibration array', () => {
    expect(calibratedItems(items, undefined)).toEqual([]);
  });
});

describe('taskHasExpiredCalibration', () => {
  const task = {
    equipment_items_snapshot: ['מד לחץ', 'מד מתח'],
    equipment_calibration_snapshot: [
      { requires_calibration: true, serial_number: '45821', calibration_expiry: '2027-03-15' },
      { requires_calibration: true, serial_number: '77124', calibration_expiry: '2026-06-01' },
    ] as (EquipmentCalibration | null)[],
  };
  it('detects an expired item as of the inspection date', () => {
    expect(taskHasExpiredCalibration(task, '2026-11-08')).toBe(true); // 2026-06-01 expired
  });
  it('is false when every calibration is still valid', () => {
    expect(taskHasExpiredCalibration(task, '2026-05-01')).toBe(false);
  });
  it('is false when there is no calibrated equipment', () => {
    expect(taskHasExpiredCalibration({ equipment_items_snapshot: ['מברג'], equipment_calibration_snapshot: [null] }, '2026-11-08')).toBe(false);
  });
});
