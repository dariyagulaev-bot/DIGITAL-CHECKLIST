import Dexie, { type Table } from 'dexie';
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
  performers!: Table<Performer, string>;
  templates!: Table<Template, string>;
  template_tasks!: Table<TemplateTask, string>;
  completed_forms!: Table<CompletedForm, string>;
  completed_tasks!: Table<CompletedTask, string>;
  signatures!: Table<Signature, string>;
  audit_log!: Table<AuditEntry, string>;
  settings!: Table<Setting, string>;
  counters!: Table<Counter, string>;

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

    // v5: second performer is now a managed, selectable person. Add the
    // performers table and backfill performer2_id (null = not yet linked) on
    // existing forms. Historical name snapshots are preserved untouched.
    this.version(5)
      .stores({
        performers: 'id, sort_order',
      })
      .upgrade(async (tx) => {
        const forms = await tx.table('completed_forms').toArray();
        await Promise.all(
          forms
            .filter((f: CompletedForm) => f.performer2_id === undefined)
            .map((f: CompletedForm) => tx.table('completed_forms').update(f.id, { performer2_id: null }))
        );
      });

    // v6: automatic running בד״ח number. Add a per-unit serial counter table.
    // No backfill: existing forms keep their number as-is; new forms mint a
    // serial number on creation.
    this.version(6).stores({
      counters: 'id',
    });

    // v7: (a) equipment becomes a LIST of items; (b) forms gain a classification
    // (סיווג). Safe, non-destructive migration — no existing data is lost:
    //   • template tasks & completed-task snapshots keep their `equipment` text
    //     and gain an `equipment_items` list derived from it (split on commas /
    //     new lines). Both forms of the data are retained.
    //   • completed forms with no classification default to בלמ״ס (unclassified),
    //     the safe lowest level — never over-classifying a historical document.
    // No indexes change (these are data-only fields), so `stores({})` is enough.
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        const splitItems = (text: unknown): string[] =>
          typeof text === 'string'
            ? text
                .split(/[\n,]+/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

        const tmplTasks = await tx.table('template_tasks').toArray();
        await Promise.all(
          tmplTasks
            .filter((t: TemplateTask) => t.equipment_items === undefined)
            .map((t: TemplateTask) =>
              tx.table('template_tasks').update(t.id, { equipment_items: splitItems(t.equipment) })
            )
        );

        const compTasks = await tx.table('completed_tasks').toArray();
        await Promise.all(
          compTasks
            .filter((t: CompletedTask) => t.equipment_items_snapshot === undefined)
            .map((t: CompletedTask) =>
              tx
                .table('completed_tasks')
                .update(t.id, { equipment_items_snapshot: splitItems(t.equipment_snapshot) })
            )
        );

        const forms = await tx.table('completed_forms').toArray();
        await Promise.all(
          forms
            .filter((f: CompletedForm) => f.classification === undefined)
            .map((f: CompletedForm) =>
              tx.table('completed_forms').update(f.id, { classification: 'בלמ״ס' })
            )
        );
      });

    // v8: (a) classification now lives on the RANK (admin-set) and is inherited
    // by new forms; existing ranks get בלמ״ס as a safe default. (b) forms gain
    // an updated_at used for the drafts time-stamp — backfilled from created_at.
    // Data-only, so stores({}) is enough.
    this.version(8)
      .stores({})
      .upgrade(async (tx) => {
        const ranks = await tx.table('ranks').toArray();
        await Promise.all(
          ranks
            .filter((r: Rank) => r.classification === undefined)
            .map((r: Rank) => tx.table('ranks').update(r.id, { classification: 'בלמ״ס' }))
        );
        const forms = await tx.table('completed_forms').toArray();
        await Promise.all(
          forms
            .filter((f: CompletedForm) => f.updated_at === undefined)
            .map((f: CompletedForm) =>
              tx.table('completed_forms').update(f.id, { updated_at: f.created_at })
            )
        );
      });
  }
}

export const db = new ChecklistDB();
