import { db } from '@/data/db';
import { nowIso, getDeviceId } from './ids';
import { logAudit } from './audit';
import type {
  User,
  Role,
  UserRole,
  System,
  Unit,
  Rank,
  Performer,
  Template,
  TemplateTask,
  CompletedForm,
  CompletedTask,
  Signature,
  AuditEntry,
  Setting,
  Counter,
  UserWithRoles,
} from '@/types';

/**
 * Backup / export-import service.
 *
 * The system syncs by file (USB / export-import), not a live server:
 *   • Device → Master:  exportFormsBundle()  →  mergeFormsBundle()   (append-only)
 *   • Master → Device:  exportConfigBundle() →  importConfigBundle() (upsert)
 *   • Admin backup:     exportFullBackup()   →  restoreFullBackup()  (replace)
 *
 * All images and signatures are embedded as data URLs, so a single file
 * carries everything needed.
 */

const FORMAT_VERSION = 1;

export interface FullBackup {
  type: 'checklist-full-backup';
  version: number;
  exported_at: string;
  device_id: string;
  data: {
    users: User[];
    roles: Role[];
    user_roles: UserRole[];
    systems: System[];
    units: Unit[];
    ranks: Rank[];
    performers: Performer[];
    templates: Template[];
    template_tasks: TemplateTask[];
    completed_forms: CompletedForm[];
    completed_tasks: CompletedTask[];
    signatures: Signature[];
    audit_log: AuditEntry[];
    settings: Setting[];
    counters: Counter[];
  };
}

export interface FormsBundle {
  type: 'checklist-forms-bundle';
  version: number;
  exported_at: string;
  device_id: string;
  forms: CompletedForm[];
  tasks: CompletedTask[];
  signatures: Signature[];
}

export interface ConfigBundle {
  type: 'checklist-config-bundle';
  version: number;
  exported_at: string;
  device_id: string;
  users: User[];
  roles: Role[];
  user_roles: UserRole[];
  systems: System[];
  units: Unit[];
  ranks: Rank[];
  performers: Performer[];
  templates: Template[];
  template_tasks: TemplateTask[];
  settings: Setting[];
}

async function collectAll() {
  const [
    users,
    roles,
    user_roles,
    systems,
    units,
    ranks,
    performers,
    templates,
    template_tasks,
    completed_forms,
    completed_tasks,
    signatures,
    audit_log,
    settings,
    counters,
  ] = await Promise.all([
    db.users.toArray(),
    db.roles.toArray(),
    db.user_roles.toArray(),
    db.systems.toArray(),
    db.units.toArray(),
    db.ranks.toArray(),
    db.performers.toArray(),
    db.templates.toArray(),
    db.template_tasks.toArray(),
    db.completed_forms.toArray(),
    db.completed_tasks.toArray(),
    db.signatures.toArray(),
    db.audit_log.toArray(),
    db.settings.toArray(),
    db.counters.toArray(),
  ]);
  return {
    users,
    roles,
    user_roles,
    systems,
    units,
    ranks,
    performers,
    templates,
    template_tasks,
    completed_forms,
    completed_tasks,
    signatures,
    audit_log,
    settings,
    counters,
  };
}

export async function exportFullBackup(): Promise<FullBackup> {
  return {
    type: 'checklist-full-backup',
    version: FORMAT_VERSION,
    exported_at: nowIso(),
    device_id: getDeviceId(),
    data: await collectAll(),
  };
}

export interface RestoreResult {
  usersRestored: number;
  formsRestored: number;
}

/** Replace ALL local data with the backup contents. Destructive. */
export async function restoreFullBackup(
  payload: FullBackup,
  admin: UserWithRoles
): Promise<RestoreResult> {
  if (payload.type !== 'checklist-full-backup') {
    throw new Error('קובץ הגיבוי אינו תקין');
  }
  const d = payload.data;
  await db.transaction(
    'rw',
    [
      db.users,
      db.roles,
      db.user_roles,
      db.systems,
      db.units,
      db.ranks,
      db.performers,
      db.templates,
      db.template_tasks,
      db.completed_forms,
      db.completed_tasks,
      db.signatures,
      db.audit_log,
      db.settings,
      db.counters,
    ],
    async () => {
      await Promise.all([
        db.users.clear(),
        db.roles.clear(),
        db.user_roles.clear(),
        db.systems.clear(),
        db.units.clear(),
        db.ranks.clear(),
        db.performers.clear(),
        db.templates.clear(),
        db.template_tasks.clear(),
        db.completed_forms.clear(),
        db.completed_tasks.clear(),
        db.signatures.clear(),
        db.audit_log.clear(),
        db.settings.clear(),
        db.counters.clear(),
      ]);
      await Promise.all([
        db.users.bulkAdd(d.users),
        db.roles.bulkAdd(d.roles),
        db.user_roles.bulkAdd(d.user_roles),
        db.systems.bulkAdd(d.systems),
        db.units.bulkAdd(d.units),
        db.ranks.bulkAdd(d.ranks),
        db.performers.bulkAdd(d.performers ?? []),
        db.templates.bulkAdd(d.templates),
        db.template_tasks.bulkAdd(d.template_tasks),
        db.completed_forms.bulkAdd(d.completed_forms),
        db.completed_tasks.bulkAdd(d.completed_tasks),
        db.signatures.bulkAdd(d.signatures),
        db.audit_log.bulkAdd(d.audit_log),
        db.settings.bulkAdd(d.settings),
        db.counters.bulkAdd(d.counters ?? []),
      ]);
    }
  );
  await logAudit({
    user_id: admin.id,
    user_name: admin.full_name,
    action: 'RESTORE_BACKUP',
    entity_type: 'system',
    entity_id: '-',
    new_value: payload.exported_at,
  });
  return { usersRestored: d.users.length, formsRestored: d.completed_forms.length };
}

/** Export completed forms (optionally a subset) with their tasks & signatures. */
export async function exportFormsBundle(formIds?: string[]): Promise<FormsBundle> {
  const allForms = await db.completed_forms.toArray();
  const forms = formIds ? allForms.filter((f) => formIds.includes(f.id)) : allForms;
  const ids = new Set(forms.map((f) => f.id));
  const [allTasks, allSigs] = await Promise.all([
    db.completed_tasks.toArray(),
    db.signatures.toArray(),
  ]);
  return {
    type: 'checklist-forms-bundle',
    version: FORMAT_VERSION,
    exported_at: nowIso(),
    device_id: getDeviceId(),
    forms,
    tasks: allTasks.filter((t) => ids.has(t.completed_form_id)),
    signatures: allSigs.filter((s) => ids.has(s.completed_form_id)),
  };
}

export interface MergeResult {
  added: number;
  skipped: number;
}

/** Append-only merge of a forms bundle into the master. Existing ids are kept. */
export async function mergeFormsBundle(payload: FormsBundle): Promise<MergeResult> {
  if (payload.type !== 'checklist-forms-bundle') {
    throw new Error('קובץ העברת בד״חים אינו תקין');
  }
  const existing = await db.completed_forms.toArray();
  const existingIds = new Set(existing.map((f) => f.id));
  const newForms = payload.forms.filter((f) => !existingIds.has(f.id));
  const newIds = new Set(newForms.map((f) => f.id));
  const newTasks = payload.tasks.filter((t) => newIds.has(t.completed_form_id));
  const newSigs = payload.signatures.filter((s) => newIds.has(s.completed_form_id));

  await db.transaction(
    'rw',
    [db.completed_forms, db.completed_tasks, db.signatures],
    async () => {
      if (newForms.length) await db.completed_forms.bulkAdd(newForms);
      if (newTasks.length) await db.completed_tasks.bulkAdd(newTasks);
      if (newSigs.length) await db.signatures.bulkAdd(newSigs);
    }
  );
  return { added: newForms.length, skipped: payload.forms.length - newForms.length };
}

/** Export configuration (users, templates, settings) for pushing to devices. */
export async function exportConfigBundle(): Promise<ConfigBundle> {
  const all = await collectAll();
  return {
    type: 'checklist-config-bundle',
    version: FORMAT_VERSION,
    exported_at: nowIso(),
    device_id: getDeviceId(),
    users: all.users,
    roles: all.roles,
    user_roles: all.user_roles,
    systems: all.systems,
    units: all.units,
    ranks: all.ranks,
    performers: all.performers,
    templates: all.templates,
    template_tasks: all.template_tasks,
    settings: all.settings,
  };
}

/** Upsert configuration from another device (templates/users/settings). */
export async function importConfigBundle(payload: ConfigBundle): Promise<void> {
  if (payload.type !== 'checklist-config-bundle') {
    throw new Error('קובץ ההגדרות אינו תקין');
  }
  await db.transaction(
    'rw',
    [db.users, db.roles, db.user_roles, db.systems, db.units, db.ranks, db.performers, db.templates, db.template_tasks, db.settings],
    async () => {
      await db.roles.bulkPut(payload.roles);
      await db.users.bulkPut(payload.users);
      await db.user_roles.bulkPut(payload.user_roles);
      await db.systems.bulkPut(payload.systems);
      await db.units.bulkPut(payload.units);
      await db.ranks.bulkPut(payload.ranks);
      await db.performers.bulkPut(payload.performers ?? []);
      await db.templates.bulkPut(payload.templates);
      await db.template_tasks.bulkPut(payload.template_tasks);
      await db.settings.bulkPut(payload.settings);
    }
  );
}

// -------------------------------------------------------------------------
// Browser helpers: download an object as JSON, and read a File as JSON.
// -------------------------------------------------------------------------

export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readJsonFile<T = unknown>(file: File): Promise<T> {
  const text = await file.text();
  return JSON.parse(text) as T;
}

export function timestampedName(prefix: string): string {
  const ts = nowIso().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}_${ts}.json`;
}
