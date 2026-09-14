import Dexie, { type Table } from 'dexie';
import type {
  User,
  Role,
  UserRole,
  System,
  Unit,
  Rank,
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
  systems!: Table<System, string>;
  units!: Table<Unit, string>;
  ranks!: Table<Rank, string>;
  templates!: Table<Template, string>;
  template_tasks!: Table<TemplateTask, string>;
  completed_forms!: Table<CompletedForm, string>;
  completed_tasks!: Table<CompletedTask, string>;
  signatures!: Table<Signature, string>;
  audit_log!: Table<AuditEntry, string>;
  settings!: Table<Setting, string>;

  constructor(name = 'digital_checklist') {
    super(name);
    // Only indexed fields are listed; full objects are still stored.
    // Booleans (active) are not valid IndexedDB keys, so they are filtered in JS.
    this.version(1).stores({
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

    // v2: multi-system support. Add the systems table and index templates by
    // system; backfill a default system for any pre-existing templates.
    this.version(2)
      .stores({
        systems: 'id, name',
        templates: 'id, name, system_id',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        const defaultId = crypto.randomUUID();
        const templates = await tx.table('templates').toArray();
        if (templates.length) {
          await tx.table('systems').put({
            id: defaultId,
            name: 'מערכת ראשית',
            active: true,
            created_at: now,
            updated_at: now,
          });
          await Promise.all(
            templates
              .filter((t: Template) => !t.system_id)
              .map((t: Template) => tx.table('templates').update(t.id, { system_id: defaultId }))
          );
        }
      });

    // v3: dynamic hierarchy — add units + ranks; templates gain rank_id + version.
    this.version(3)
      .stores({
        systems: 'id, name, sort_order',
        units: 'id, system_id, sort_order',
        ranks: 'id, sort_order',
        templates: 'id, name, system_id, rank_id',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        const rankId = crypto.randomUUID();
        await tx.table('ranks').put({
          id: rankId,
          name: 'דרג א׳',
          active: true,
          sort_order: 0,
          created_at: now,
          updated_at: now,
        });
        const templates = await tx.table('templates').toArray();
        await Promise.all(
          templates.map((t: Template) =>
            tx.table('templates').update(t.id, {
              rank_id: t.rank_id ?? rankId,
              version: t.version ?? 1,
            })
          )
        );
        // Give existing system types a stable display order.
        const systems = await tx.table('systems').toArray();
        await Promise.all(
          systems.map((s: System, i: number) =>
            tx.table('systems').update(s.id, { sort_order: s.sort_order ?? i })
          )
        );
      });

    // v4: every inspection now records two performers. Backfill an empty
    // second-performer name on existing forms (not indexed — data only).
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        const forms = await tx.table('completed_forms').toArray();
        await Promise.all(
          forms
            .filter((f: CompletedForm) => f.performer2_name === undefined)
            .map((f: CompletedForm) => tx.table('completed_forms').update(f.id, { performer2_name: '' }))
        );
      });
  }
}

export const db = new ChecklistDB();
