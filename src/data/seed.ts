import { db } from './db';
import { newId, nowIso } from '@/services/ids';
import { hashPassword } from '@/services/auth';
import {
  RoleName,
  type Role,
  type System,
  type Unit,
  type Rank,
  type Template,
  type TemplateTask,
  type User,
} from '@/types';
import { SettingKeys } from '@/services/settings';
import { addMonths, todayStr } from '@/services/dates';

/**
 * Idempotent seed. Runs once on first launch to guarantee the roles exist,
 * a default admin can log in, and a demo template ("בדיקה יומית") is available.
 *
 * NOTE: the default admin password is an INITIAL setup credential only and
 * must be changed after first login. No approval passwords are hard-coded.
 */

const DEFAULT_ADMIN = { username: 'admin', password: 'admin123', full_name: 'מנהל המערכת' };
const DEMO_PERFORMER = { username: 'performer', password: '1234', full_name: 'ישראל ישראלי' };
const DEMO_APPROVER = { username: 'approver', password: '1234', full_name: 'דנה כהן' };
// Extra performer accounts so מבצע 2 can be chosen from real users (not a
// separate directory). New performer users appear automatically; disabled ones
// disappear from new forms.
const DEMO_PERFORMERS_EXTRA = [
  { username: 'performer2', password: '1234', full_name: 'דני כהן' },
  { username: 'performer3', password: '1234', full_name: 'יוסי לוי' },
];

async function ensureRoles(): Promise<Record<RoleName, string>> {
  const existing = await db.roles.toArray();
  const byName = new Map(existing.map((r) => [r.name, r.id]));
  const map: Partial<Record<RoleName, string>> = {};
  for (const name of [RoleName.PERFORMER, RoleName.APPROVER, RoleName.ADMIN]) {
    let id = byName.get(name);
    if (!id) {
      id = newId();
      const role: Role = { id, name };
      await db.roles.add(role);
    }
    map[name] = id;
  }
  return map as Record<RoleName, string>;
}

async function ensureUser(
  spec: { username: string; password: string; full_name: string },
  roleIds: string[]
): Promise<void> {
  const existing = await db.users.where('username').equals(spec.username).first();
  if (existing) return;
  const user: User = {
    id: newId(),
    username: spec.username,
    full_name: spec.full_name,
    password_hash: await hashPassword(spec.password),
    active: true,
    created_at: nowIso(),
  };
  await db.users.add(user);
  for (const roleId of roleIds) {
    await db.user_roles.add({ id: newId(), user_id: user.id, role_id: roleId });
  }
}

async function ensureSystem(name: string, sortOrder: number): Promise<string> {
  const existing = await db.systems.where('name').equals(name).first();
  if (existing) return existing.id;
  const sys: System = {
    id: newId(),
    name,
    active: true,
    sort_order: sortOrder,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.systems.add(sys);
  return sys.id;
}

async function ensureRank(name: string, sortOrder: number): Promise<string> {
  // `name` is not an index on the ranks table — filter in JS.
  const existing = (await db.ranks.toArray()).find((r) => r.name === name);
  if (existing) return existing.id;
  const rank: Rank = {
    id: newId(),
    name,
    active: true,
    sort_order: sortOrder,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.ranks.add(rank);
  return rank.id;
}

async function ensureUnits(systemId: string, names: string[]): Promise<void> {
  const existing = await db.units.where('system_id').equals(systemId).count();
  if (existing > 0) return;
  for (let i = 0; i < names.length; i++) {
    const unit: Unit = {
      id: newId(),
      system_id: systemId,
      name: names[i],
      active: true,
      sort_order: i,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await db.units.add(unit);
  }
}

async function ensureTemplate(
  name: string,
  description: string,
  systemId: string,
  rankId: string,
  tasks: Array<Omit<TemplateTask, 'id' | 'template_id'>>
): Promise<void> {
  const existing = await db.templates.where('name').equals(name).first();
  if (existing) return;
  const template: Template = {
    id: newId(),
    system_id: systemId,
    rank_id: rankId,
    name,
    description,
    active: true,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.templates.add(template);
  for (const t of tasks) {
    // Equipment is a list; derive items from the demo text so seeded data uses
    // the same structured form as admin-entered equipment.
    const equipment_items = (t.equipment || '')
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    await db.template_tasks.add({ id: newId(), template_id: template.id, ...t, equipment_items });
  }
}

/** Seed a certification only if one does not already exist for (user, system). */
async function ensureCert(userId: string | undefined, systemId: string, maxRankId: string): Promise<void> {
  if (!userId) return;
  const existing = await db.user_system_ranks
    .where('[user_id+system_id]')
    .equals([userId, systemId])
    .first();
  if (existing) return;
  await db.user_system_ranks.add({
    id: newId(),
    user_id: userId,
    system_id: systemId,
    max_rank_id: maxRankId,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
}

async function ensureSettings(): Promise<void> {
  const mode = await db.settings.get(SettingKeys.APPROVAL_MODE);
  if (!mode) await db.settings.put({ key: SettingKeys.APPROVAL_MODE, value: 'personal_accounts' });
  const org = await db.settings.get(SettingKeys.ORG_NAME);
  if (!org) await db.settings.put({ key: SettingKeys.ORG_NAME, value: 'מערכת בד״ח דיגיטלית' });
  const autolog = await db.settings.get(SettingKeys.ADMIN_AUTOLOGOUT_MIN);
  if (!autolog) await db.settings.put({ key: SettingKeys.ADMIN_AUTOLOGOUT_MIN, value: '10' });
}

/** Run the seed. Safe to call on every startup. */
export async function runSeed(): Promise<void> {
  const roles = await ensureRoles();
  await ensureUser(DEFAULT_ADMIN, [roles[RoleName.ADMIN]]);
  await ensureUser(DEMO_PERFORMER, [roles[RoleName.PERFORMER]]);
  await ensureUser(DEMO_APPROVER, [roles[RoleName.APPROVER]]);
  for (const spec of DEMO_PERFORMERS_EXTRA) {
    await ensureUser(spec, [roles[RoleName.PERFORMER]]);
  }

  // A small but complete demo hierarchy so every wizard step has something to
  // choose from: two system types, two ranks, units per system, templates
  // associated to system + rank. All of it is admin-editable afterwards.
  const sysA = await ensureSystem('מערכת א׳', 0);
  const sysB = await ensureSystem('מערכת ב׳', 1);
  const rankA = await ensureRank('דרג א׳', 0);
  const rankB = await ensureRank('דרג ב׳', 1);
  await ensureUnits(sysA, ['A-01', 'A-02', 'A-03']);
  await ensureUnits(sysB, ['B-01', 'B-02']);

  await ensureTemplate('בדיקה יומית', 'בדיקה יומית לדוגמה — נוצרה אוטומטית', sysA, rankA, [
    { part_name: 'מנוע', action: 'בדיקת מפלס שמן', equipment: 'כפפות', image_data: null, sort_order: 0 },
    { part_name: 'מערכת חשמל', action: 'בדיקת חיבורים', equipment: 'פנס', image_data: null, sort_order: 1 },
    { part_name: 'אזור עבודה', action: 'בדיקה ויזואלית', equipment: 'ללא', image_data: null, sort_order: 2 },
  ]);
  await ensureTemplate('בדיקה תקופתית', 'בדיקה מקיפה בדרג ב׳', sysA, rankB, [
    { part_name: 'מסנני אוויר', action: 'החלפה וניקוי', equipment: 'ערכת סינון', image_data: null, sort_order: 0 },
    { part_name: 'מערכת קירור', action: 'בדיקת מפלס נוזל', equipment: 'משפך', image_data: null, sort_order: 1 },
  ]);
  await ensureTemplate('בדיקת מוכנות', 'בדיקת מוכנות למערכת ב׳', sysB, rankA, [
    { part_name: 'לוח בקרה', action: 'בדיקת נוריות', equipment: 'ללא', image_data: null, sort_order: 0 },
    { part_name: 'חיבורי תקשורת', action: 'בדיקת ממשקים', equipment: 'כבל בדיקה', image_data: null, sort_order: 1 },
  ]);

  // Demo certifications (הסמכות) — show the hierarchy in action:
  //  • ישראל ישראלי + דני כהן: full access (מערכת א׳ עד דרג ב׳, מערכת ב׳ עד דרג א׳)
  //  • יוסי לוי: מערכת א׳ עד דרג א׳ בלבד, ללא הסמכה למערכת ב׳
  const perf1 = (await db.users.where('username').equals('performer').first())?.id;
  const perf2 = (await db.users.where('username').equals('performer2').first())?.id;
  const perf3 = (await db.users.where('username').equals('performer3').first())?.id;
  await ensureCert(perf1, sysA, rankB);
  await ensureCert(perf1, sysB, rankA);
  await ensureCert(perf2, sysA, rankB);
  await ensureCert(perf2, sysB, rankA);
  await ensureCert(perf3, sysA, rankA);

  // Demo validity: make ישראל ישראלי's מערכת ב׳ certification expire ~2 months
  // out so the renewal popup + home warning are demonstrable out of the box.
  // (Only applied once, and never overrides an admin-set date.)
  if (perf1) {
    const row = await db.user_system_ranks.where('[user_id+system_id]').equals([perf1, sysB]).first();
    if (row && row.expires_at === undefined) {
      const issued = addMonths(todayStr(), -10); // issued 10 months ago
      await db.user_system_ranks.update(row.id, {
        issued_at: issued,
        validity_months: 12,
        expires_at: addMonths(issued, 12), // → ~2 months from today
        updated_at: nowIso(),
      });
    }
  }

  await ensureSettings();
}
