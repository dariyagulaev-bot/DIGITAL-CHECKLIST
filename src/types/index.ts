// ============================================================================
// Domain types & enums for the Digital Checklist system.
// These mirror the IndexedDB tables and are shared across services and UI.
// ============================================================================

/** System roles. A user may hold several roles. */
export enum RoleName {
  PERFORMER = 'PERFORMER', // מבצע בדיקות
  APPROVER = 'APPROVER', // מאשר בדיקות
  ADMIN = 'ADMIN', // מנהל מערכת
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

/** A frozen, self-contained copy of a check block's content for publishing. */
export interface PublishedCheckConfig {
  part_name: string;
  action: string;
  equipment: string;
  equipment_items: string[];
  image_data: string | null;
}

/**
 * A WORK STAGE of a בד״ח (e.g. "לפני הכנה" / "אחרי הכנה"). The display `name`
 * is admin-editable; the `id` is a STABLE technical key (stage_1, stage_2, …) so
 * renaming a stage never breaks existing data. A template may define 2+ stages,
 * or none at all (uses_stages = false → the classic flat בד״ח). The same check
 * can belong to several stages and each stage keeps its OWN separate result.
 */
export interface Stage {
  id: string; // stable key, e.g. "stage_1" — never the display name
  name: string; // admin display name, e.g. "לפני הכנה"
  active: boolean;
  sort_order: number;
}

/** Default two-stage split. The words are DEFAULTS only, fully editable. */
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
  /** Stages this block appears in (stage ids). Empty/undefined = not staged
   *  (shown once, in the general area). Ignored when the template has no stages. */
  stage_ids?: string[];
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
  image_data: string | null; // data URL (managed copy, not original path)
  sort_order: number;
}

/** Immutable snapshot of a single template task, stored on the form. */
export interface TaskSnapshot {
  part_name: string;
  action: string;
  equipment: string;
  equipment_items?: string[];
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
  | 'percent';

export interface TableColumn {
  id: string;
  label: string;
  field_type: FieldType;
  required?: boolean;
  unit?: string; // display unit for numeric/decimal/percent (free text)
  options?: string[]; // for select / multiselect
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
  /** Stages this block appears in. Empty/undefined = general (not staged). */
  stage_ids?: string[];
}

/** Frozen copy of a block stored on a form (non-check blocks). */
export interface BlockSnapshot {
  template_block_id: string;
  type: BlockType;
  sort_order: number;
  config: BlockConfig;
  /** The stage this materialized instance belongs to (null = general). */
  stage_id?: string | null;
  stage_name_snapshot?: string; // frozen stage display name
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
  /** Work-stage instance (null = general). Same table in two stages = two
   *  CompletedBlock rows, each keeping its own entered data. */
  stage_id?: string | null;
  stage_name_snapshot?: string; // frozen stage display name at creation
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

export interface CompletedTask {
  id: string;
  completed_form_id: string;
  part_name_snapshot: string;
  action_snapshot: string;
  equipment_snapshot: string; // legacy single-string fallback
  equipment_items_snapshot?: string[]; // frozen equipment list at execution time
  image_snapshot: string | null; // reference image (data URL)
  result: TaskResult; // ORIGINAL inspection result — never changed by a later repair
  comment: string; // fault detail (original description of the fault)
  fault_image: string | null; // data URL of fault photo (before)
  sort_order: number;
  /** Work-stage instance (null = general / un-staged). The same check in two
   *  stages produces two CompletedTask rows, each with its own result. */
  stage_id?: string | null;
  stage_name_snapshot?: string; // frozen stage display name at creation

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
