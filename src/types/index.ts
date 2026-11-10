// ============================================================================
// Domain types & enums for the Digital Checklist system.
// These mirror the IndexedDB tables and are shared across services and UI.
// ============================================================================

/** System roles. A user may hold several roles. */
export enum RoleName {
  PERFORMER = 'PERFORMER', // מבצע בדיקות
  APPROVER = 'APPROVER', // מאשר בדיקות
  ADMIN = 'ADMIN', // מנהל מערכת
  CERTIFIER = 'CERTIFIER', // מסמיך — may certify others (scoped per system+rank)
}

/** Identity document kind for a user (protected / admin-only field). */
export type IdentityType = 'personal' | 'national'; // מספר אישי / תעודת זהות

/**
 * Explicit authorization for a CERTIFIER to certify in a specific (system, rank).
 * Holding the CERTIFIER role is NOT enough on its own — an authorization row per
 * (system, rank) is required. Being ADMIN/APPROVER never grants this implicitly.
 */
export interface CertifierAuthorization {
  id: string;
  user_id: string;
  system_id: string;
  rank_id: string;
  created_at: string;
}

/** Lifecycle status of a completed form (בד״ח). */
export enum FormStatus {
  DRAFT = 'DRAFT', // טיוטה
  IN_PROGRESS = 'IN_PROGRESS', // בביצוע
  PENDING_APPROVAL = 'PENDING_APPROVAL', // ממתין לאישור
  APPROVED = 'APPROVED', // מאושר (נעול)
  REJECTED = 'REJECTED', // נדחה / דורש תיקון
  IN_TREATMENT = 'IN_TREATMENT', // הועבר לטיפול דרג מטפל (למשל דרג ד׳)
}

/** Per-task result. */
export enum TaskResult {
  UNSET = 'UNSET', // לא סומן
  OK = 'OK', // תקין
  FAULT = 'FAULT', // לא תקין
}

/** Who signed. */
export enum SignerType {
  PERFORMER = 'PERFORMER', // מבצע 1
  PERFORMER2 = 'PERFORMER2', // מבצע 2
  APPROVER = 'APPROVER',
  REPAIR_PERFORMER = 'REPAIR_PERFORMER', // מבצע תיקון 1 (דרג מטפל)
  REPAIR_PERFORMER2 = 'REPAIR_PERFORMER2', // מבצע תיקון 2 (דרג מטפל)
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  password_hash: string;
  active: boolean;
  created_at: string; // ISO
  // ---- Protected identity (ת״ז / מספר אישי) — admin-managed, PRIVATE ----
  // NEVER used as a username/login/display name, and never shown across the app
  // (dashboards, forms, approver screens, history, PDF/Excel, signatures, search).
  // Used only by the certification mechanism and certificate issuance.
  id_type?: IdentityType;
  id_number?: string;
}

export interface Role {
  id: string;
  name: RoleName;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
}

/**
 * Dynamic inspection hierarchy (all admin-managed, none hard-coded):
 *   System type (סוג מערכת) → Unit (יחידה) → Rank (דרג) → Template/בד״ח → items.
 */

/** System TYPE (סוג מערכת), e.g. "מערכת A". `system_id` on other rows references this. */
export interface System {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** A specific unit/system (יחידה), e.g. "A-03", belonging to a system type. */
export interface Unit {
  id: string;
  system_id: string; // owning system type
  name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Inspection rank/tier (דרג), e.g. "דרג א׳". Global, reorderable list. */
export interface Rank {
  id: string;
  name: string;
  /** Security classification set by the admin — inherited by every בד״ח of this
   *  rank at creation time (frozen onto the form; later edits don't change history). */
  classification?: Classification;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * A person who can be selected as the second performer (מבצע 2).
 * Admin-managed and stored in the DB (never hard-coded), so admins can add
 * real people and disable demo/placeholder ones. Disabling only hides a
 * performer from NEW forms — historical forms keep their name snapshot.
 */
export interface Performer {
  id: string;
  full_name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * ADMIN-defined calibration REQUIREMENT for ONE required-equipment item
 * (ציוד הדורש כיול). At template-build time the admin only declares WHETHER the
 * equipment type needs calibration — never a specific serial number or expiry,
 * because the physical item is not known until the בד״ח is performed. Stored
 * POSITIONALLY ALIGNED with `equipment_items` (entry i describes item i; a null
 * entry means item i does not require calibration). The equipment NAME is never
 * duplicated here — it already lives in equipment_items.
 */
export interface EquipmentCalibration {
  requires_calibration: boolean;
}

/**
 * PERFORMER-entered calibration DATA for one required-equipment item, captured at
 * execution time (the physical item actually used). Frozen onto the completed
 * בד״ח, POSITIONALLY ALIGNED with `equipment_items_snapshot`. Records who entered
 * it and when, so the document shows exactly which item was used — never a value
 * pre-defined by the admin.
 */
export interface CalibrationEntry {
  serial_number: string; // מספר סידורי — entered by the performer
  calibration_expiry: string; // תוקף כיול — ISO date (YYYY-MM-DD)
  entered_by_id: string;
  entered_by_name: string;
  entered_at: string; // ISO with seconds
}

/** Validity of a calibration relative to a reference (inspection) date. */
export type CalibrationState = 'valid' | 'expired' | 'unknown';

/** Admin policy for equipment whose calibration expired, as of the בד״ח date. */
export type CalibrationPolicy = 'warn' | 'block';

/** A frozen, self-contained copy of a check block's content for publishing. */
export interface PublishedCheckConfig {
  part_name: string;
  action: string;
  equipment: string;
  equipment_items: string[];
  /** Per-item calibration, aligned by index with equipment_items (null = none). */
  equipment_calibration?: (EquipmentCalibration | null)[];
  image_data: string | null;
}

/**
 * A בד״ח PHASE option (e.g. "לפני הכנה" / "אחרי הכנה"). This is a SINGLE-SELECT
 * classification of the whole בד״ח — the performer picks exactly one at the top
 * and fills ONE normal table once; it is NOT a structural split into several
 * tables. The display `name` is admin-editable; the `id` is a STABLE technical
 * key (stage_1, stage_2, …) so renaming never breaks existing/archived data.
 * A template may define 2+ options, or none (uses_stages = false → no phase).
 */
export interface Stage {
  id: string; // stable key, e.g. "stage_1" — never the display name
  name: string; // admin display name, e.g. "לפני הכנה"
  active: boolean;
  sort_order: number;
}

/** Default two options. The words are DEFAULTS only, fully editable. */
export function defaultStages(): Stage[] {
  return [
    { id: 'stage_1', name: 'לפני', active: true, sort_order: 0 },
    { id: 'stage_2', name: 'אחרי', active: true, sort_order: 1 },
  ];
}

/** One block inside a published template version (self-contained, no DB refs). */
export interface PublishedBlock {
  type: BlockType;
  sort_order: number;
  config: PublishedCheckConfig | BlockConfig;
}

/** One entry in a template's version history. */
export interface VersionEntry {
  version: string; // e.g. "1.0", "1.1", "2.0"
  published_at: string;
  published_by_id: string;
  published_by_name: string;
  change_summary?: string;
}

/** The currently-published content of a template (used for NEW forms). */
export interface PublishedContent {
  version: string;
  published_at: string;
  published_by_id: string;
  published_by_name: string;
  change_summary?: string;
  blocks: PublishedBlock[];
  /** Work stages frozen into this version (empty/undefined = flat בד״ח). */
  stages?: Stage[];
  uses_stages?: boolean; // whether this version splits the בד״ח into stages
}

/** A checklist/בד״ח template, associated with a system type + rank. */
export interface Template {
  id: string;
  system_id: string; // owning system type (סוג מערכת)
  rank_id: string | null; // inspection rank (דרג)
  name: string;
  description: string;
  active: boolean;
  version: number; // bumped on structural edits, snapshotted onto forms
  created_at: string;
  updated_at: string;
  // ---- Draft / Publish (all optional for backward compatibility) ----
  // Legacy templates have no `published` snapshot and are treated as already
  // published (ever_published defaults to true via migration). A template built
  // in the new editor is a DRAFT until first published.
  published?: PublishedContent; // frozen content NEW forms are built from
  ever_published?: boolean; // has it ever been published?
  has_unpublished_changes?: boolean; // draft edits since the last publish
  version_history?: VersionEntry[];
  // ---- Work stages (לפני / אחרי …) — all optional, additive ----
  /** Whether this בד״ח is split into work stages. Off/undefined = flat. */
  uses_stages?: boolean;
  /** Draft stage list (admin-editable names, stable ids). */
  stages?: Stage[];
}

/**
 * Security classification (סיווג) of a בד״ח. Fixed, ordered list — lowest to
 * highest. Stored as data on the form and frozen into the historical snapshot.
 */
export type Classification = 'בלמ״ס' | 'שמור' | 'סודי' | 'סודי ביותר';
export const CLASSIFICATIONS: Classification[] = ['בלמ״ס', 'שמור', 'סודי', 'סודי ביותר'];
export const DEFAULT_CLASSIFICATION: Classification = 'בלמ״ס';

export interface TemplateTask {
  id: string;
  template_id: string;
  part_name: string; // שם החלק
  action: string; // הפעולה
  equipment: string; // ציוד — legacy single string (kept as a joined fallback)
  /** Required equipment as an ordered list of items. Source of truth going
   *  forward; `equipment` mirrors it (joined) for backward compatibility. */
  equipment_items?: string[];
  /** Per-item calibration, aligned by index with equipment_items (null = none). */
  equipment_calibration?: (EquipmentCalibration | null)[];
  image_data: string | null; // data URL (managed copy, not original path)
  sort_order: number;
}

/** Immutable snapshot of a single template task, stored on the form. */
export interface TaskSnapshot {
  part_name: string;
  action: string;
  equipment: string;
  equipment_items?: string[];
  equipment_calibration?: (EquipmentCalibration | null)[];
  image_data: string | null;
  sort_order: number;
}

/**
 * ----------------------------------------------------------------------------
 * Dynamic Checklist Builder — a בד״ח template is an ordered list of BLOCKS.
 * ----------------------------------------------------------------------------
 * The block layer is ADDITIVE and fully backward-compatible: a 'check' block
 * points to a classic `template_tasks` row (so the whole inspection / fault /
 * treatment pipeline is untouched), while the new block types carry their own
 * config. New block types can be added without rewriting the template engine.
 */
export type BlockType =
  | 'check' // סעיף בדיקה רגיל (תקין/לא תקין) — points to a template_tasks row
  | 'section' // כותרת / Section
  | 'text' // טקסט / הוראה
  | 'table' // טבלת נתונים / מדידה
  | 'fields' // קבוצת שדות מותאמים (תת־מערכת: מספר סידורי, דגם, מק״ט …)
  | 'image' // תמונה
  | 'equipment' // ציוד נדרש (standalone)
  | 'divider'; // מפריד

/** Input field types available for table cells. */
export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'decimal'
  | 'time'
  | 'date'
  | 'datetime' // full date+time (stored ISO) — used for duration start/end
  | 'bool'
  | 'select'
  | 'multiselect'
  | 'percent'
  | 'calc' // auto-computed (difference / duration) — read-only for the performer
  | 'result'; // per-row pass/fail verdict — auto-computed, read-only

/** A calculated column: its value per row is derived from two other columns. */
export interface ColumnCalc {
  kind: 'difference' | 'duration'; // difference = to − from; duration = to − from (time)
  from: string; // source column id (initial / start)
  to: string; // source column id (final / end)
}

/** Per-table visual style (admin "🎨 עיצוב טבלה"); all optional → VERO defaults. */
export interface TableStyle {
  head_bg?: string;
  head_text?: string;
  row_bg?: string;
  alt_row_bg?: string;
  text?: string;
  border?: string;
  border_width?: number; // px
  font_size?: number; // px
  bold_head?: boolean;
  align?: 'right' | 'center' | 'left';
  row_height?: number; // px
  pass_color?: string;
  fail_color?: string;
}

export interface TableColumn {
  id: string;
  label: string;
  field_type: FieldType;
  required?: boolean;
  unit?: string; // display unit for numeric/decimal/percent (free text)
  options?: string[]; // for select / multiselect
  width?: number; // admin-set column width (px); omitted = auto
  icon?: string; // optional header icon (local icon library name)
  align?: 'right' | 'center' | 'left'; // cell text alignment
  calc?: ColumnCalc; // field_type 'calc': how the value is derived
  allowed_difference?: number; // 'calc' difference column: ±X threshold per row
  min_minutes?: number; // 'calc' duration column: minimum minutes per row
}

export interface TableRow {
  id: string;
  label: string;
}

/** A reference to a single table cell (row × column). */
export interface CellRef {
  row_id: string;
  col_id: string;
}

/**
 * A measurement rule. Only '±X' (delta) is implemented now, but the shape is
 * generic so future rule types (min/max/range/percent-change/formula) can be
 * added without rebuilding the mechanism.
 */
export interface MeasurementRule {
  id: string;
  type: 'delta'; // ±X — |final − initial| ≤ allowed_difference
  label?: string;
  initial: CellRef; // "שדה התחלתי"
  final: CellRef; // "שדה סופי"
  allowed_difference: number; // the ±X value (absolute, ≥ 0)
  fail_on_exceed?: boolean; // exceeding the gap marks the table "לא תקין"
}

/**
 * Minimum-duration rule. The measurement itself must last at least `min_minutes`
 * (a MINIMUM, never a maximum). Actual duration = end − start, computed from the
 * full datetime cells (so midnight-crossing and multi-day measurements work).
 * The start/end cell refs are stable even if the admin renames the rows/columns.
 */
export interface DurationRule {
  /**
   * How the measurement duration is captured:
   *  - 'timer' (default): the performer presses "התחל דגימה" / "סיום דגימה" and
   *    the device clock is stamped at each press (started_at / ended_at on the
   *    table data). The admin only sets the minimum — no fields to pick.
   *  - 'fields' (legacy): duration = (end datetime cell) − (start datetime cell).
   */
  mode?: 'timer' | 'fields';
  start?: CellRef; // legacy 'fields' mode: cell holding the start datetime
  end?: CellRef; // legacy 'fields' mode: cell holding the end datetime
  use_default?: boolean; // take min_minutes from the system+rank default
  min_minutes?: number; // explicit minimum (when not using the default)
}

export interface TableConfig {
  title: string;
  description?: string;
  required?: boolean;
  /** @deprecated free-text label; replaced by the enforced `duration` rule. */
  duration_label?: string;
  duration?: DurationRule; // enforced minimum-duration rule
  /**
   * 'fields' (default for tables built in the simplified editor): the admin
   * defines a flat list of measurement FIELDS. Internally each field is a column
   * on a single hidden row, so the whole evaluation/snapshot engine is reused;
   * the performer sees a clean vertical list of labeled inputs (label [value]
   * unit). Undefined / 'grid' = the legacy row×column spreadsheet layout.
   */
  layout?: 'fields' | 'grid';
  columns: TableColumn[];
  rows: TableRow[];
  rules?: MeasurementRule[];
  show_in_execution?: boolean; // default true
  show_in_pdf?: boolean; // default true
  /**
   * Grid sub-system mode: rows are sub-systems and columns may include
   * 'calc' (difference/duration) and 'result' columns, each row evaluated
   * independently. Any 'grid' table with a calc/result column renders as the
   * professional sub-system grid.
   */
  style?: TableStyle; // per-table visual design (admin editable; optional)
  row_header_label?: string; // sub-system grid: the first (name) column header, default "תת מערכת"
}

/**
 * An admin-defined custom field (for a תת־מערכת / identifier group). The TYPE is
 * chosen from a small set so the admin can add fields (serial number, model,
 * מק״ט, location, note …) WITHOUT any code change. The `id` is stable; the
 * `label` is the display name the performer sees.
 */
export interface CustomField {
  id: string;
  label: string;
  field_type: 'short_text' | 'long_text' | 'number' | 'decimal' | 'date' | 'time' | 'bool' | 'select';
  required?: boolean;
  options?: string[]; // for 'select'
  unit?: string; // optional display unit for numeric fields
}

/** A named group of custom fields — the heart of a תת־מערכת identifier block. */
export interface FieldsConfig {
  title?: string; // group name, e.g. "תת־מערכת: משאבה A"
  description?: string;
  fields: CustomField[];
}

export interface CheckRefConfig {
  task_id: string; // points to a template_tasks row (classic check content)
}
export interface SectionConfig {
  title: string;
  collapsible?: boolean;
}
export interface TextConfig {
  text: string;
}
export interface ImageConfig {
  image_data: string | null;
  title?: string;
  description?: string;
  show_in_execution?: boolean;
  show_in_pdf?: boolean;
}
export interface EquipmentConfig {
  title?: string;
  items: string[];
}
export type DividerConfig = Record<string, never>;

export type BlockConfig =
  | CheckRefConfig
  | SectionConfig
  | TextConfig
  | TableConfig
  | FieldsConfig
  | ImageConfig
  | EquipmentConfig
  | DividerConfig;

export interface TemplateBlock {
  id: string;
  template_id: string;
  type: BlockType;
  sort_order: number;
  config: BlockConfig;
  created_at: string;
  updated_at: string;
}

/** Frozen copy of a block stored on a form (non-check blocks). */
export interface BlockSnapshot {
  template_block_id: string;
  type: BlockType;
  sort_order: number;
  config: BlockConfig;
}

/** Computed outcome of a measurement rule at execution time. */
export interface MeasurementResult {
  rule_id: string;
  initial: number | null;
  final: number | null;
  difference: number | null; // SIGNED: final − initial (keeps direction)
  allowed: number;
  passed: boolean | null; // null = not enough data to decide yet
}

/** Computed outcome of the minimum-duration rule. */
export interface DurationResult {
  start: string | null; // ISO datetime
  end: string | null; // ISO datetime
  actual_minutes: number | null;
  min_minutes: number | null;
  invalid: boolean; // end ≤ start (chronological error)
  passed: boolean | null; // null when incomplete
}

/** Overall measurement-table outcome (duration + ±X gap combined). */
export type TableStatus = 'pass' | 'fail' | 'incomplete';

/** User-entered data for a table block during execution. */
export interface TableData {
  cells: Record<string, string>; // key `${row_id}|${col_id}` → raw value
  started_at?: string | null; // timer mode: device clock at "התחל דגימה"
  ended_at?: string | null; // timer mode: device clock at "סיום דגימה"
  results?: MeasurementResult[]; // ±X gap results
  duration_result?: DurationResult;
  status?: TableStatus; // combined pass/fail/incomplete
  fail_reasons?: string[]; // precise reasons when the table fails
}

/**
 * Execution-time storage for a NON-check block on a form (section/text/table/
 * image/equipment/divider). Check blocks continue to use `completed_tasks`.
 */
export interface CompletedBlock {
  id: string;
  completed_form_id: string;
  template_block_id: string;
  type: BlockType;
  sort_order: number;
  config_snapshot: BlockConfig; // frozen config at creation
  data?: TableData; // user input (tables); other types are display-only
}

/** Immutable snapshot of the whole template at the moment the form started. */
export interface TemplateSnapshot {
  template_id: string;
  template_name: string;
  description: string;
  tasks: TaskSnapshot[];
  blocks?: BlockSnapshot[]; // full ordered block snapshot (incl. non-check)
  snapshot_at: string;
  /** Frozen work stages (admin names at creation). Undefined = flat בד״ח. */
  stages?: Stage[];
  uses_stages?: boolean;
}

export interface CompletedForm {
  id: string; // UUID (unique across all devices)
  device_id: string; // originating device
  template_id: string;
  template_snapshot: TemplateSnapshot; // frozen template content
  // Frozen hierarchy context at creation time (so later admin edits never
  // change historical documents):
  system_id: string | null; // system TYPE (סוג מערכת)
  system_name_snapshot: string;
  unit_id: string | null; // specific unit (יחידה)
  unit_name_snapshot: string;
  rank_id: string | null; // inspection rank (דרג)
  rank_name_snapshot: string;
  template_name_snapshot: string; // inspection type / בד״ח name
  template_version_snapshot: number;
  name: string;
  number: string;
  classification?: Classification; // סיווג — chosen by the performer, frozen on the form
  // ---- בד״ח phase (שלב הבד״ח) — single-select classification, admin-defined ----
  // The performer picks ONE option at the top; the whole בד״ח is filled once.
  phase_id?: string | null; // chosen option id (stable), null until selected
  phase_name_snapshot?: string; // the option's display name, frozen at selection
  // ---- Tracking faults active for this unit AT creation (frozen; PDF/history) ----
  tracking_faults_snapshot?: TrackingFaultSnapshot[];

  performer_user_id: string; // performer 1 (the logged-in user)
  performer_name: string; // performer 1 full-name snapshot
  performer2_id: string | null; // performer 2 reference (Performer.id), null until chosen
  performer2_name: string; // performer 2 full-name snapshot (required to submit)
  approver_user_id: string | null;
  approver_name: string | null;
  date: string; // inspection date (ISO date) — set automatically at creation
  status: FormStatus;
  created_at: string;
  updated_at?: string; // last save/edit time (used for the drafts list time-stamp)
  completed_at: string | null; // submitted for approval
  approved_at: string | null;
  // Return-for-fix (approver → performer) trail. Kept as history even after
  // the form is fixed and re-submitted.
  rejection_note?: string; // the approver's note to the performer
  rejected_by_name?: string;
  rejected_at?: string;

  // ---- Transfer to a treatment rank (העברה לדרג מטפל) ----
  // When the approver routes faulty sections to a higher treating rank (the UI
  // exposes only "דרג ד׳", but the mechanism is generic), the treating rank and
  // the dedicated repair performers are kept at form level. The ORIGINAL
  // inspection rank (rank_id / rank_name_snapshot) and the original performers
  // are NEVER overwritten — the treatment is additive history.
  treatment_rank_id?: string | null; // the treating rank (e.g. rank ד)
  treatment_rank_name?: string; // snapshot of the treating rank name
  transferred_by_id?: string; // approver who transferred
  transferred_by_name?: string;
  transferred_at?: string; // ISO with seconds
  transfer_note?: string; // approver's general note on the transfer
  // Repair performers (מבצע תיקון 1/2) — distinct from performers 1/2.
  treatment_performer1_id?: string | null;
  treatment_performer1_name?: string;
  treatment_performer2_id?: string | null;
  treatment_performer2_name?: string;
}

/**
 * Severity of a fault (חומרת אי־תקינות), graded by the APPROVER after the
 * performer reports "לא תקין". 'severe' is a disabling fault (תקלה משביתה).
 */
export type FaultSeverity = 'light' | 'medium' | 'severe';

/** Human labels + ordering for fault severities (highest last). */
export const FAULT_SEVERITIES: FaultSeverity[] = ['light', 'medium', 'severe'];
export function faultSeverityLabel(s: FaultSeverity | undefined): string {
  return s === 'light' ? 'קלה' : s === 'medium' ? 'בינונית' : s === 'severe' ? 'חמורה – משביתה' : '—';
}
/** True when the fault is a disabling one (משביתה). */
export function isDisablingSeverity(s: FaultSeverity | undefined): boolean {
  return s === 'severe';
}

/** A single, immutable event in a task's fault-handling lifecycle. */
export type FaultEventType =
  | 'discovered' // תקלה התגלתה (marked "לא תקין")
  | 'returned' // הוחזר לתיקון (approver returned this section)
  | 'transferred' // הועבר לדרג מטפל (approver transferred this section, e.g. דרג ד׳)
  | 'repair_reported' // דווח על ביצוע תיקון (performer documented the treatment)
  | 'resubmitted' // נשלח מחדש לאישור
  | 'verified'; // אומת ואושר (approver's final approval)

export interface FaultEvent {
  type: FaultEventType;
  at: string; // ISO timestamp WITH seconds — never overwritten
  by_id: string;
  by_name: string;
  note?: string; // approver note / short context
}

/**
 * ----------------------------------------------------------------------------
 * TRACKING FAULTS (תקלה במעקב) — a SEPARATE layer on top of the normal fault /
 * repair pipeline. A tracking fault is created ONLY by an explicit, authorized
 * "הגדר כתקלה במעקב" action; it is tied FIRST to the unit (מספר מערכת), so it
 * keeps surfacing on that unit's future בד״חים (across ranks) until an
 * authorized approver closes it — even after the fault itself is repaired and
 * the repair approved. Default for every unit: NO tracking faults.
 * ----------------------------------------------------------------------------
 */
export type TrackingStatus = 'active' | 'closed';
/** The repair state of the underlying fault, kept in sync on the tracking rec. */
export type TrackingRepairStatus = 'not_repaired' | 'repaired' | 'repair_approved';

export type TrackingEventKind =
  | 'opened' // the underlying fault was discovered
  | 'defined' // explicitly set as a tracking fault
  | 'repair_reported' // a repair was documented
  | 'repair_approved' // the repair was approved
  | 'rechecked' // re-examined on a later בד״ח
  | 'kept' // approver decided to keep tracking
  | 'note' // free note
  | 'closed'; // approver closed the tracking

export interface TrackingEvent {
  id: string;
  at: string; // ISO timestamp WITH seconds — never overwritten/removed
  kind: TrackingEventKind;
  actor_id: string;
  actor_name: string;
  actor_role?: string;
  note?: string;
}

export interface TrackingFault {
  id: string;
  device_id: string; // originating device (sync)
  // ---- Association: the unit (מספר מערכת) comes FIRST ----
  system_id: string | null;
  system_name: string;
  unit_id: string | null; // מספר מערכת — the primary key the tracking follows
  unit_name: string;
  // ---- Origin (snapshot of where it was discovered) ----
  source_form_id: string;
  source_form_number: string;
  source_rank_id: string | null;
  source_rank_name: string; // the rank it was discovered in (e.g. דרג א׳)
  source_task_id?: string; // the original check item, when it came from one
  // ---- Content ----
  description: string;
  notes?: string;
  images?: string[]; // data URLs
  reported_by_id?: string;
  reported_by_name?: string;
  defined_by_id: string; // who set it as a tracking fault
  defined_by_name: string;
  opened_at: string; // tracking open time
  // ---- State: three independent dimensions ----
  repair_status: TrackingRepairStatus; // fault repaired? approved?
  tracking_status: TrackingStatus; // active / closed — NEVER auto-closed by a repair
  // ---- Closure (authorized approver only) ----
  closed_by_id?: string;
  closed_by_name?: string;
  closed_by_role?: string;
  closed_at?: string;
  close_note?: string;
  close_signature?: string | null;
  // ---- Immutable history ----
  events: TrackingEvent[];
  created_at: string;
  updated_at: string; // bumped on every change (sync/version)
}

/** Frozen summary of the tracking faults that were ACTIVE when a בד״ח started.
 * Stored on the form so a historical PDF always shows the state AT execution. */
export interface TrackingFaultSnapshot {
  id: string;
  description: string;
  source_form_number: string;
  source_rank_name: string;
  opened_at: string;
  repair_status: TrackingRepairStatus;
}

export interface CompletedTask {
  id: string;
  completed_form_id: string;
  part_name_snapshot: string;
  action_snapshot: string;
  equipment_snapshot: string; // legacy single-string fallback
  equipment_items_snapshot?: string[]; // frozen equipment list at execution time
  /** Frozen ADMIN requirement per item (requires_calibration), aligned by index
   *  with equipment_items_snapshot. Immutable — a later template edit never
   *  changes this historical בד״ח. */
  equipment_calibration_snapshot?: (EquipmentCalibration | null)[];
  /** PERFORMER-entered calibration data (serial + expiry + who/when) for each
   *  required-calibration item, captured at execution time and aligned by index
   *  with equipment_items_snapshot. This is the physical item actually used —
   *  never a value pre-defined by the admin. */
  equipment_calibration_entries?: (CalibrationEntry | null)[];
  image_snapshot: string | null; // reference image (data URL)
  result: TaskResult; // ORIGINAL inspection result — never changed by a later repair
  comment: string; // fault detail (original description of the fault)
  fault_image: string | null; // data URL of fault photo (before)
  sort_order: number;

  // ---- Fault severity (חומרת אי־תקינות) — set by the APPROVER only ----
  // The performer never sets severity. 'severe' = disabling (משביתה). Every
  // change is audited (old → new). Absent = the approver has not graded it yet.
  fault_severity?: FaultSeverity;
  severity_set_by_id?: string;
  severity_set_by_name?: string;
  severity_set_at?: string;

  // ---- Fault-handling lifecycle (all optional; only set for faulty items) ----
  // Discovery — who found the fault and exactly when (kept forever).
  fault_reported_by_id?: string;
  fault_reported_by_name?: string;
  fault_reported_at?: string;
  // Return-for-fix — this specific section was returned by the approver.
  returned_for_fix?: boolean;
  return_note?: string; // approver's reason for THIS section
  returned_by_name?: string;
  returned_at?: string;
  // Repair report — the performer's documentation of the treatment.
  repair_reported?: boolean;
  repair_done?: boolean; // כן / לא
  repair_description?: string; // מה בוצע בתיקון
  repair_image?: string | null; // תמונה לאחר תיקון (after)
  repaired_by_id?: string;
  repaired_by_name?: string;
  repaired_at?: string;
  // Verification — stamped when the approver gives final approval.
  verified?: boolean;
  verified_by_name?: string;
  verified_at?: string;
  // Transfer-to-treatment-rank path (parallel to return-for-fix). When set, the
  // section was routed to a higher treating rank; its treatment is documented by
  // the repair performers (reusing the repair_* fields above) and verified by the
  // approver at final approval, exactly like the return-for-fix path.
  transferred_for_treatment?: boolean;
  transfer_section_note?: string; // approver's note for THIS section
  // Ordered event log powering the compact treatment timeline.
  fault_events?: FaultEvent[];
}

export interface Signature {
  id: string;
  completed_form_id: string;
  signer_user_id: string;
  signer_type: SignerType;
  signer_name: string;
  signer_role: string; // free text: role / id number
  signature_data: string; // PNG data URL captured from canvas
  signed_at: string;
}

export interface AuditEntry {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  timestamp: string;
}

export interface Setting {
  key: string;
  value: string;
}

/**
 * Monotonic serial counter, one row per physical unit (or system when a form
 * has no unit). Used to mint the running בד״ח number. Never decreases, so a
 * number is never reused even if a form is deleted.
 */
export interface Counter {
  id: string; // counter key (unit id, else system id, else 'GLOBAL')
  value: number; // last serial issued
}

/**
 * A user's certification for a SYSTEM TYPE, expressed as the HIGHEST rank they
 * may inspect there (ranks are hierarchical: a max rank covers every rank below
 * it). No row for a (user, system) pair means "ללא הסמכה" — not certified at all
 * for that system. Admin-managed, stored locally, audited on every change.
 * Changing a certification affects only NEW work — historical forms keep the
 * snapshot taken at execution time.
 */
export interface UserSystemRank {
  id: string;
  user_id: string;
  system_id: string; // system TYPE (סוג מערכת)
  max_rank_id: string; // highest certified rank for this system
  // ---- Validity (תוקף הסמכה) — all optional for backward compatibility ----
  // A legacy cert with no `expires_at` is treated as valid indefinitely until
  // an admin sets a validity period. Expiry is DATE-based (issued + months),
  // never a fixed day count, so different month lengths are handled correctly.
  issued_at?: string; // תאריך הסמכה / רענון אחרון (ISO date, YYYY-MM-DD)
  validity_months?: number; // משך תוקף בחודשים (admin-set; no hard-coded year)
  expires_at?: string; // computed = issued_at + validity_months (ISO date)
  created_at: string;
  updated_at: string;
}

/** Validity status of a certification, derived from dates at runtime. */
export type CertStatus = 'valid' | 'needs_renewal' | 'expired' | 'none';

/** Convenience view model: a user with resolved role names. */
export interface UserWithRoles extends User {
  roles: RoleName[];
}

// ---------------------------------------------------------------------------
// Certification exams (מבחני הסמכה).
// ---------------------------------------------------------------------------

/** Pass score is fixed system-wide: 80 / 100. */
export const EXAM_PASS_SCORE = 80;

export type ExamQuestionType =
  | 'single' // בחירה יחידה (אמריקאית)
  | 'multi' // בחירה מרובה
  | 'open' // שאלה פתוחה (בדיקה ידנית)
  | 'image_match'; // זיהוי ציוד בתמונה

export interface ExamOption {
  id: string;
  text: string;
  image?: string | null; // optional data URL on an answer
}

/** A hotspot on an equipment image. Coordinates are RELATIVE (0..1) to the
 * image's own width/height, so markers stay put on any screen size. */
export interface ExamMarker {
  id: string;
  x: number; // 0..1 of image width
  y: number; // 0..1 of image height
  component_name: string; // the correct component for this point
}

export interface ExamQuestionConfig {
  image?: string | null; // equipment image (data URL) — attached to any type
  // single / multi
  options?: ExamOption[];
  correct_option_ids?: string[];
  multi_partial?: boolean; // multi: allow partial credit (default false = all-or-nothing)
  // open
  sample_answer?: string;
  rubric?: string;
  // image_match
  markers?: ExamMarker[];
  distractors?: string[]; // extra component names not on the image
  image_partial?: boolean; // image_match: partial credit by correct matches (default true)
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  sort_order: number;
  type: ExamQuestionType;
  text: string;
  points: number; // weight toward the 0..100 normalized score
  config: ExamQuestionConfig;
  created_at: string;
  updated_at: string;
}

/** Frozen copy of a question on a published version / an attempt snapshot. */
export interface ExamQuestionSnapshot {
  id: string; // original question id (stable for answer mapping)
  sort_order: number;
  type: ExamQuestionType;
  text: string;
  points: number;
  config: ExamQuestionConfig;
}

export interface ExamPublished {
  version: string;
  published_at: string;
  questions: ExamQuestionSnapshot[];
}

/** 'initial' = first-time certification exam; 'renewal' = periodic renewal exam
 * matched to a certification by system + rank. */
export type ExamType = 'initial' | 'renewal';

export interface Exam {
  id: string;
  title: string;
  description?: string;
  exam_type?: ExamType; // default 'initial'
  system_id?: string | null;
  rank_id?: string | null;
  version: string; // '1.0', '1.1', '2.0'
  ever_published?: boolean;
  has_unpublished_changes?: boolean;
  version_history?: VersionEntry[];
  published?: ExamPublished | null;
  created_at: string;
  updated_at: string;
}

export type ExamAttemptStatus = 'in_progress' | 'pending_review' | 'graded';

/** A single answer within an attempt (shape depends on the question type). */
export interface ExamAnswer {
  question_id: string;
  selected_option_ids?: string[]; // single (1) / multi (n)
  text?: string; // open
  matches?: Record<string, string>; // image_match: marker id → chosen component name
  auto_awarded?: number | null; // computed for single/multi/image_match
  manual_awarded?: number | null; // graded by admin for open questions
  manual_note?: string | null;
  needs_manual?: boolean; // open question awaiting manual grading
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  exam_version: string;
  exam_title: string;
  exam_snapshot: ExamQuestionSnapshot[]; // frozen at start — exam edits never change it
  // Renewal context (only when the attempt is a certification renewal):
  purpose?: 'initial' | 'renewal';
  cert_id?: string | null; // the user_system_rank being renewed
  cert_system_id?: string | null;
  cert_rank_id?: string | null;
  user_id: string;
  user_name: string;
  device_id: string;
  status: ExamAttemptStatus;
  answers: ExamAnswer[];
  score: number | null; // 0..100, null until fully graded
  passed: boolean | null; // null until graded; score ≥ 80
  started_at: string;
  updated_at: string;
  submitted_at?: string | null;
  graded_at?: string | null;
  graded_by_id?: string | null;
  graded_by_name?: string | null;
}

// ---- Certification renewal (חידוש הסמכה) ----------------------------------

export type RenewalStatus = 'pending_approval' | 'approved' | 'rejected';

/**
 * A certification renewal record. Created automatically when a user PASSES a
 * renewal exam (≥80). Passing never renews the certification on its own — it
 * sits in 'pending_approval' until an authorized approver approves it (with
 * their signature), only then is the certification's expiry extended. One
 * record per exam attempt (the attempt id is the idempotency key).
 */
export interface CertRenewal {
  id: string;
  user_id: string;
  user_name: string;
  system_id: string;
  system_name?: string;
  rank_id: string | null;
  rank_name?: string;
  cert_id: string; // user_system_rank id
  exam_id: string;
  exam_version: string;
  attempt_id: string; // one renewal per attempt
  score: number;
  passed: boolean;
  status: RenewalStatus;
  prev_expires_at?: string | null; // current validity before renewal
  new_expires_at?: string | null; // set on approval
  started_at: string;
  submitted_at: string;
  approved_by_id?: string | null;
  approved_by_name?: string | null;
  approved_by_role?: string | null;
  approver_signature?: string | null; // data URL — reuses the signature mechanism
  approved_at?: string | null;
  reject_reason?: string | null;
  device_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Grants a user the right to approve certification renewals, optionally scoped
 * to a system and/or rank (null = any). Being an admin does NOT by itself grant
 * approval authority — it must be assigned here.
 */
export interface RenewalApprover {
  id: string;
  user_id: string;
  user_name?: string;
  system_id?: string | null; // null = any system
  rank_id?: string | null; // null = any rank
  created_at: string;
}

// ---------------------------------------------------------------------------
// Central station & two-way sync (VERO Central).
// ---------------------------------------------------------------------------

/** This install's role. 'tablet' = execution station; 'central' = master station. */
export type VeroRole = 'tablet' | 'central';

/** A device's authorization state at the central station. */
export type DeviceStatus = 'authorized' | 'pending' | 'disabled';

/**
 * A registered device (tablet or the central station itself). The central
 * station is the authority for this registry; each tablet keeps a cached copy
 * of its own record. `ordinal` gives the device a non-overlapping numbering
 * band so בד״ח serials never collide between devices (serial base =
 * (ordinal-1) * block_size).
 */
export interface Device {
  id: string; // stable device UUID (getDeviceId)
  code: string; // human code, e.g. 'VERO-TAB-001'
  friendly_name: string; // e.g. 'טאבלט מחלקה א׳'
  status: DeviceStatus;
  ordinal: number; // numbering band (0 = central / unassigned)
  block_size: number; // serials reserved per device per counter (e.g. 1000)
  last_sync_at?: string | null;
  last_dir?: 'in' | 'out' | null;
  received_forms?: number; // cumulative: forms received from this device (central)
  sent_updates?: number; // cumulative: config updates sent to this device (central)
  is_self?: boolean; // true on the device's own record
  created_at: string;
  updated_at: string;
}

/** Per-peer sync watermark + last result (incremental, resumable sync). */
export interface SyncState {
  key: string; // peer device id (or 'self')
  last_received_at?: string | null; // newest effective mtime applied FROM this peer
  last_sent_at?: string | null; // watermark last sent TO this peer
  last_import_checksum?: string | null; // short-circuit exact duplicate imports
  last_summary?: string | null;
  updated_at: string;
}

/** A sync entry in the sync history (central + tablet). */
export interface SyncLogEntry {
  id: string;
  at: string;
  direction: 'in' | 'out'; // in = received, out = sent/exported
  peer_device: string | null;
  peer_code?: string | null;
  kind: string; // 'device-to-central' | 'central-to-device'
  counts: Record<string, number>; // {forms, templates, certs, users, devices, skipped}
  ok: boolean;
  message?: string | null;
}

/** Summary returned after applying a package (drives the UI message). */
export interface SyncSummary {
  direction: 'in' | 'out';
  forms: number;
  templates: number;
  certs: number;
  users: number;
  devices: number;
  skipped: number;
  at: string;
  message: string;
}
