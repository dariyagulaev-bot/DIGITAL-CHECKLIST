import type {
  CellRef,
  DurationResult,
  MeasurementResult,
  MeasurementRule,
  TableConfig,
  TableData,
  TableStatus,
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

// ---------------------------------------------------------------------------
// Minimum measurement duration
// ---------------------------------------------------------------------------

/** Parse a datetime value (ISO 'YYYY-MM-DDTHH:MM' or full ISO) to epoch ms. */
export function parseDateTime(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** Human duration: "6 שעות", "6 שעות ו-30 דקות", "45 דקות", "2 ימים ו-3 שעות". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  const neg = minutes < 0 ? '-' : '';
  let m = Math.abs(Math.round(minutes));
  const days = Math.floor(m / 1440);
  m -= days * 1440;
  const hours = Math.floor(m / 60);
  const mins = m - hours * 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? 'יום' : 'ימים'}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? 'שעה' : 'שעות'}`);
  if (mins) parts.push(`${mins} ${mins === 1 ? 'דקה' : 'דקות'}`);
  if (parts.length === 0) return `${neg}0 דקות`;
  return neg + parts.join(' ו-');
}

/**
 * Compute the actual measurement duration (end − start) in minutes and judge it
 * against a MINIMUM. The minimum is a floor, never a ceiling:
 *   actual ≥ min → PASS ;  actual < min → FAIL.
 * A missing endpoint yields passed=null (incomplete). end earlier than start is
 * flagged invalid (chronologically impossible).
 */
export function computeDuration(
  startRaw: string | null | undefined,
  endRaw: string | null | undefined,
  minMinutes: number | null
): DurationResult {
  const startMs = parseDateTime(startRaw);
  const endMs = parseDateTime(endRaw);
  const start = startRaw?.trim() ? startRaw : null;
  const end = endRaw?.trim() ? endRaw : null;
  const min = minMinutes !== null && Number.isFinite(minMinutes) ? minMinutes : null;
  if (startMs === null || endMs === null) {
    return { start, end, actual_minutes: null, min_minutes: min, invalid: false, passed: null };
  }
  const actual = Math.round((endMs - startMs) / 60000);
  if (endMs < startMs) {
    return { start, end, actual_minutes: actual, min_minutes: min, invalid: true, passed: false };
  }
  const passed = min === null ? null : actual >= min;
  return { start, end, actual_minutes: actual, min_minutes: min, invalid: false, passed };
}

export interface TableEvaluation {
  results: MeasurementResult[];
  duration_result?: DurationResult;
  status?: TableStatus; // undefined when the table has no pass/fail criteria
  fail_reasons: string[];
}

/** Which cells are required (table-level or column-level). */
function requiredCellKeys(config: TableConfig): string[] {
  const keys: string[] = [];
  for (const c of config.columns) {
    if (config.required || c.required) {
      for (const r of config.rows) keys.push(`${r.id}|${c.id}`);
    }
  }
  return keys;
}

/**
 * Full evaluation of a measurement table: the ±X gap rules AND the minimum
 * duration, combined into one PASS/FAIL/INCOMPLETE with precise fail reasons.
 * A measurement PASSES only when every criterion passes; it is INCOMPLETE while
 * any required value (or a criterion input) is missing. The result is always
 * derived from the data — it can never be manually overridden.
 */
export function evaluateTableFull(
  config: TableConfig,
  cells: Record<string, string>,
  timer?: { started_at?: string | null; ended_at?: string | null }
): TableEvaluation {
  const results = evaluateTable(config, cells);
  const reasons: string[] = [];
  let anyFail = false;
  let anyIncomplete = false;

  let duration_result: DurationResult | undefined;
  if (config.duration) {
    // Legacy 'fields' mode reads two datetime cells; the default 'timer' mode
    // reads the Start/Stop device-clock stamps carried on the table data.
    const isFields = config.duration.mode === 'fields' || (!!config.duration.start && !!config.duration.end);
    const startRaw = isFields && config.duration.start ? cells[cellKey(config.duration.start)] : timer?.started_at ?? null;
    const endRaw = isFields && config.duration.end ? cells[cellKey(config.duration.end)] : timer?.ended_at ?? null;
    duration_result = computeDuration(startRaw, endRaw, config.duration.min_minutes ?? null);
    if (duration_result.invalid) {
      anyFail = true;
      reasons.push('זמן הסיום מוקדם מזמן ההתחלה.');
    } else if (duration_result.passed === null) {
      anyIncomplete = true;
    } else if (duration_result.passed === false) {
      anyFail = true;
      reasons.push(`משך המדידה בפועל (${formatDuration(duration_result.actual_minutes)}) קצר מהמינימום הנדרש (${formatDuration(duration_result.min_minutes)}).`);
    }
  }

  for (const rule of config.rules ?? []) {
    const res = results.find((x) => x.rule_id === rule.id);
    if (!res) continue;
    if (res.passed === null) anyIncomplete = true;
    else if (res.passed === false) {
      anyFail = true;
      reasons.push(`הפער בפועל (${res.difference}) חורג מהפער המותר (±${rule.allowed_difference}).`);
    }
  }

  // Missing required values keep the table incomplete (not a final success).
  for (const k of requiredCellKeys(config)) {
    if (!(cells[k] ?? '').trim()) {
      anyIncomplete = true;
      break;
    }
  }

  const hasCriteria = !!config.duration || (config.rules?.length ?? 0) > 0;
  let status: TableStatus | undefined;
  if (!hasCriteria) status = undefined;
  else if (anyFail) status = 'fail';
  else if (anyIncomplete) status = 'incomplete';
  else status = 'pass';

  return { results, duration_result, status, fail_reasons: [...new Set(reasons)] };
}

/** Recompute and attach results onto table data (immutably). */
export function withResults(config: TableConfig, data: TableData): TableData {
  const full = evaluateTableFull(config, data.cells ?? {}, { started_at: data.started_at, ended_at: data.ended_at });
  return {
    ...data,
    results: full.results,
    duration_result: full.duration_result,
    status: full.status,
    fail_reasons: full.fail_reasons,
  };
}
