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

/** Immutable snapshot of the whole template at the moment the form started. */
export interface TemplateSnapshot {
  template_id: string;
  template_name: string;
  description: string;
  tasks: TaskSnapshot[];
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
}

/** A single, immutable event in a task's fault-handling lifecycle. */
export type FaultEventType =
  | 'discovered' // תקלה התגלתה (marked "לא תקין")
  | 'returned' // הוחזר לתיקון (approver returned this section)
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

/** Convenience view model: a user with resolved role names. */
export interface UserWithRoles extends User {
  roles: RoleName[];
}
