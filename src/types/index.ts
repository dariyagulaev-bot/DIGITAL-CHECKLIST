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

export interface TableConfig {
  title: string;
  description?: string;
  required?: boolean;
  duration_label?: string; // e.g. "4 שעות" — display only, not auto-enforced
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

/** User-entered data for a table block during execution. */
export interface TableData {
  cells: Record<string, string>; // key `${row_id}|${col_id}` → raw value
  results?: MeasurementResult[];
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
