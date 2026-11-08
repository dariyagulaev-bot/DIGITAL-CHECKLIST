import { describe, it, expect } from 'vitest';
import {
  calibrationState,
  taskCalibrationViews,
  taskHasExpiredCalibration,
  taskMissingCalibrationEntry,
} from './calibration';
import type { CalibrationEntry, EquipmentCalibration } from '@/types';

describe('calibrationState', () => {
  it('is valid when expiry is on/after the inspection date (inclusive)', () => {
    expect(calibrationState('2027-03-15', '2026-11-08')).toBe('valid');
    expect(calibrationState('2026-11-08', '2026-11-08')).toBe('valid');
  });
  it('is expired when expiry is before the inspection date', () => {
    expect(calibrationState('2026-11-07', '2026-11-08')).toBe('expired');
  });
  it('is unknown without an expiry', () => {
    expect(calibrationState(undefined, '2026-11-08')).toBe('unknown');
    expect(calibrationState('', '2026-11-08')).toBe('unknown');
  });
});

// Admin requirement per item (snapshot) + performer entry (entries).
const items = ['מברג', 'מד לחץ', 'מד מתח'];
const req: (EquipmentCalibration | null)[] = [null, { requires_calibration: true }, { requires_calibration: true }];
const entries: (CalibrationEntry | null)[] = [
  null,
  { serial_number: '45821', calibration_expiry: '2027-03-15', entered_by_id: 'u', entered_by_name: 'מבצע', entered_at: 'x' },
  { serial_number: '77124', calibration_expiry: '2026-01-01', entered_by_id: 'u', entered_by_name: 'מבצע', entered_at: 'x' },
];
const task = {
  equipment_items_snapshot: items,
  equipment_calibration_snapshot: req,
  equipment_calibration_entries: entries,
};

describe('taskCalibrationViews', () => {
  it('merges admin requirement with the performer entry per item', () => {
    const v = taskCalibrationViews(task, '2026-11-08');
    expect(v[0].required).toBe(false); // מברג
    expect(v[1].required).toBe(true);
    expect(v[1].serial).toBe('45821');
    expect(v[1].state).toBe('valid'); // 2027-03-15 >= 2026-11-08
    expect(v[2].state).toBe('expired'); // 2026-01-01 < 2026-11-08
  });
});

describe('taskHasExpiredCalibration', () => {
  it('detects a required item whose entered calibration expired', () => {
    expect(taskHasExpiredCalibration(task, '2026-11-08')).toBe(true);
  });
  it('is false when every entered calibration is still valid', () => {
    expect(taskHasExpiredCalibration(task, '2025-12-01')).toBe(false);
  });
});

describe('taskMissingCalibrationEntry', () => {
  it('lists required items missing a serial or expiry', () => {
    const partial = {
      equipment_items_snapshot: items,
      equipment_calibration_snapshot: req,
      equipment_calibration_entries: [null, null, entries[2]] as (CalibrationEntry | null)[],
    };
    expect(taskMissingCalibrationEntry(partial)).toEqual(['מד לחץ']);
  });
  it('is empty when every required item has serial + expiry', () => {
    expect(taskMissingCalibrationEntry(task)).toEqual([]);
  });
  it('ignores items that do not require calibration', () => {
    const t = { equipment_items_snapshot: ['מברג'], equipment_calibration_snapshot: [null], equipment_calibration_entries: [null] };
    expect(taskMissingCalibrationEntry(t)).toEqual([]);
  });
});
