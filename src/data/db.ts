import Dexie, { type Table } from 'dexie';
import type {
  User,
  Role,
  UserRole,
  Template,
  TemplateTask,
  CompletedForm,
  CompletedTask,
  Signature,
  AuditEntry,
  Setting,
} from '@/types';

/**
 * Local, offline-first database (IndexedDB via Dexie).
 * Each device holds its own copy; completed forms carry a global UUID + device_id
 * so they can be merged into a master repository on connect (append-only sync).
 */
export class ChecklistDB extends Dexie {
  users!: Table<User, string>;
  roles!: Table<Role, string>;
  user_roles!: Table<UserRole, string>;
  templates!: Table<Template, string>;
  template_tasks!: Table<TemplateTask, string>;
  completed_forms!: Table<CompletedForm, string>;
  completed_tasks!: Table<CompletedTask, string>;
  signatures!: Table<Signature, string>;
  audit_log!: Table<AuditEntry, string>;
  settings!: Table<Setting, string>;

  constructor(name = 'digital_checklist') {
    super(name);
    this.version(1).stores({
      // Only indexed fields are listed; full objects are still stored.
      // Note: booleans (active) are not valid IndexedDB keys, so they are
      // filtered in JS rather than indexed.
      users: 'id, &username',
      roles: 'id, &name',
      user_roles: 'id, user_id, role_id, [user_id+role_id]',
      templates: 'id, name',
      template_tasks: 'id, template_id, sort_order',
      completed_forms:
        'id, device_id, template_id, performer_user_id, approver_user_id, status, date, created_at',
      completed_tasks: 'id, completed_form_id, result, sort_order',
      signatures: 'id, completed_form_id, signer_user_id, signer_type',
      audit_log: 'id, user_id, entity_type, entity_id, timestamp',
      settings: 'key',
    });
  }
}

export const db = new ChecklistDB();
