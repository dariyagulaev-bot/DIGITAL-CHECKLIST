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
  PERFORMER = 'PERFORMER',
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

export interface TemplateTask {
  id: string;
  template_id: string;
  part_name: string; // שם החלק
  action: string; // הפעולה
  equipment: string; // ציוד
  image_data: string | null; // data URL (managed copy, not original path)
  sort_order: number;
}

/** Immutable snapshot of a single template task, stored on the form. */
export interface TaskSnapshot {
  part_name: string;
  action: string;
  equipment: string;
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
  performer_user_id: string; // performer 1 (the logged-in user)
  performer_name: string; // performer 1 full-name snapshot
  performer2_name: string; // performer 2 full-name snapshot (required to submit)
  approver_user_id: string | null;
  approver_name: string | null;
  date: string; // inspection date (ISO date)
  status: FormStatus;
  created_at: string;
  completed_at: string | null; // submitted for approval
  approved_at: string | null;
}

export interface CompletedTask {
  id: string;
  completed_form_id: string;
  part_name_snapshot: string;
  action_snapshot: string;
  equipment_snapshot: string;
  image_snapshot: string | null; // reference image (data URL)
  result: TaskResult;
  comment: string; // fault detail
  fault_image: string | null; // data URL of fault photo
  sort_order: number;
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

/** Convenience view model: a user with resolved role names. */
export interface UserWithRoles extends User {
  roles: RoleName[];
}
