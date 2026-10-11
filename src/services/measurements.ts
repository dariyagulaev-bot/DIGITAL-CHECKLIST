import type {
  CellRef,
  MeasurementResult,
  MeasurementRule,
  TableConfig,
  TableData,
} from '@/types';

/**
 * Pure measurement math for the Dynamic Checklist Builder. No DB, no UI — so it
 * is trivially unit-testable. The only rule implemented today is '±X' (delta):
 *
 *   difference = final − initial            (SIGNED — keeps the direction)
 *   passed     = |difference| ≤ allowed     (boundary values count as PASS)
 *
 * Numbers are parsed numerically (never string-concatenated). Missing or
 * invalid input yields a null result — never NaN / Infinity / undefined.
 */

export const cellKey = (ref: CellRef): string => `${ref.row_id}|${ref.col_id}`;

/** Parse a raw cell value to a finite number, or null when absent/invalid. */
export function parseNum(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  // Allow a leading +, decimals and a leading minus; reject anything else.
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Evaluate a single ±X rule against the given cell values. */
export function evaluateDeltaRule(
  rule: MeasurementRule,
  cells: Record<string, string>
): MeasurementResult {
  const initial = parseNum(cells[cellKey(rule.initial)]);
  const final = parseNum(cells[cellKey(rule.final)]);
  const allowed = Number.isFinite(rule.allowed_difference)
    ? Math.abs(rule.allowed_difference)
    : 0;
  if (initial === null || final === null) {
    return { rule_id: rule.id, initial, final, difference: null, allowed, passed: null };
  }
  const difference = final - initial; // signed, numeric
  const passed = Math.abs(difference) <= allowed;
  return { rule_id: rule.id, initial, final, difference, allowed, passed };
}

/** Evaluate every rule on a table and return the computed results. */
export function evaluateTable(config: TableConfig, cells: Record<string, string>): MeasurementResult[] {
  return (config.rules ?? []).map((r) => evaluateDeltaRule(r, cells));
}

/**
 * A table is "לא תקין" when at least one rule with `fail_on_exceed` has enough
 * data AND failed. Rules that are still incomplete (passed === null) do not fail
 * the table. Returns null when no decisive rule applies (nothing to judge yet).
 */
export function tableFailStatus(
  config: TableConfig,
  results: MeasurementResult[]
): boolean | null {
  const enforcing = (config.rules ?? []).filter((r) => r.fail_on_exceed);
  if (enforcing.length === 0) return null;
  let anyDecided = false;
  for (const rule of enforcing) {
    const res = results.find((r) => r.rule_id === rule.id);
    if (!res || res.passed === null) continue;
    anyDecided = true;
    if (res.passed === false) return false; // לא תקין
  }
  return anyDecided ? true : null; // תקין once every enforcing rule decided & passed
}

/** The allowed range [initial − allowed, initial + allowed] for display. */
export function allowedRange(
  initial: number | null,
  allowed: number
): { min: number; max: number } | null {
  if (initial === null || !Number.isFinite(allowed)) return null;
  const a = Math.abs(allowed);
  return { min: initial - a, max: initial + a };
}

/** Recompute and attach results onto table data (immutably). */
export function withResults(config: TableConfig, data: TableData): TableData {
  return { ...data, results: evaluateTable(config, data.cells ?? {}) };
}
