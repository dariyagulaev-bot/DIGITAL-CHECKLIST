import { db } from '@/data/db';
import { newId, nowIso, getDeviceId } from './ids';
import { getSetting, setSetting } from './settings';
import { logAudit } from './audit';
import type {
  AuditEntry,
  CompletedBlock,
  CompletedForm,
  CompletedTask,
  Device,
  Performer,
  Rank,
  Role,
  Setting,
  Signature,
  SyncLogEntry,
  SyncState,
  SyncSummary,
  System,
  Template,
  TemplateBlock,
  TemplateTask,
  Unit,
  User,
  UserRole,
  UserSystemRank,
  VeroRole,
  Exam,
  ExamQuestion,
  ExamAttempt,
  CertRenewal,
  RenewalApprover,
} from '@/types';

/**
 * VERO Central — two-way, incremental, idempotent sync between tablets and a
 * central station. Transport-agnostic: Phase 1 ships the package (USB/file)
 * transport; a LAN service can plug into the same build/apply core later.
 *
 * Source-of-authority (never a silent cross-device overwrite):
 *   • Central OWNS config — users, roles, certifications, systems/units/ranks,
 *     templates + versions, settings, the device registry, numbering bands.
 *     Flows central → tablet (upsert, newer-wins, central authoritative).
 *   • The tablet that performed a בד״ח OWNS it — forms, measurements, faults,
 *     repairs, signatures, approvals, status history, audit. Flows tablet →
 *     central (merge, the owning device's newer version wins).
 *
 * Incremental + idempotent: each side keeps a per-peer watermark (newest
 * effective-mtime it has applied). A package carries only records changed since
 * that watermark; applying is an upsert keyed by id where a strictly-newer
 * updated/effective time wins, so re-importing a file, or reconnecting after a
 * mid-transfer disconnect, never duplicates or regresses data.
 */

const PKG_VERSION = 1;
const DEFAULT_BLOCK_SIZE = 1000;
const ROLE_KEY = 'vero_role';

// ---- role -----------------------------------------------------------------

export async function getRole(): Promise<VeroRole> {
  const v = await getSetting(ROLE_KEY);
  return v === 'central' ? 'central' : 'tablet';
}
export async function setRole(role: VeroRole): Promise<void> {
  await setSetting(ROLE_KEY, role);
}

// ---- this device & registry ----------------------------------------------

/** Ensure this install has a local Device row; returns it. */
export async function getThisDevice(): Promise<Device> {
  const id = getDeviceId();
  let row = await db.devices.get(id);
  if (!row) {
    const role = await getRole();
    const now = nowIso();
    row = {
      id,
      code: role === 'central' ? 'VERO-CENTRAL' : 'VERO-TAB-NEW',
      friendly_name: role === 'central' ? 'תחנה מרכזית' : 'טאבלט חדש',
      status: role === 'central' ? 'authorized' : 'pending',
      ordinal: role === 'central' ? 0 : 0,
      block_size: DEFAULT_BLOCK_SIZE,
      is_self: true,
      created_at: now,
      updated_at: now,
    };
    await db.devices.add(row);
  }
  return row;
}

export async function listDevices(): Promise<Device[]> {
  const rows = await db.devices.toArray();
  return rows.sort((a, b) => (a.ordinal || 999) - (b.ordinal || 999) || a.code.localeCompare(b.code));
}

/** Next free ordinal for numbering-band assignment (central). */
async function nextOrdinal(): Promise<number> {
  const rows = await db.devices.toArray();
  const used = rows.map((d) => d.ordinal).filter((n) => n > 0);
  return used.length ? Math.max(...used) + 1 : 1;
}

/** Next free device code 'VERO-TAB-00N' (central). */
async function nextCode(): Promise<string> {
  const rows = await db.devices.toArray();
  let n = 1;
  const codes = new Set(rows.map((d) => d.code));
  while (codes.has(`VERO-TAB-${String(n).padStart(3, '0')}`)) n++;
  return `VERO-TAB-${String(n).padStart(3, '0')}`;
}

/** Register a device record at the central station (pending until authorized). */
export async function registerDevice(params: { id: string; code?: string; friendly_name?: string }): Promise<Device> {
  const existing = await db.devices.get(params.id);
  if (existing) return existing;
  const now = nowIso();
  const row: Device = {
    id: params.id,
    code: params.code ?? (await nextCode()),
    friendly_name: params.friendly_name ?? 'טאבלט חדש',
    status: 'pending',
    ordinal: 0,
    block_size: DEFAULT_BLOCK_SIZE,
    created_at: now,
    updated_at: now,
  };
  await db.devices.add(row);
  return row;
}

/** Authorize a device and assign its numbering band (central). */
export async function authorizeDevice(id: string, admin?: { id: string; full_name: string }): Promise<Device> {
  const row = await db.devices.get(id);
  if (!row) throw new Error('המכשיר לא נמצא');
  const ordinal = row.ordinal > 0 ? row.ordinal : await nextOrdinal();
  const next: Device = { ...row, status: 'authorized', ordinal, updated_at: nowIso() };
  await db.devices.put(next);
  if (admin) await logAudit({ user_id: admin.id, user_name: admin.full_name, action: 'DEVICE_AUTHORIZE', entity_type: 'device', entity_id: id, new_value: `${next.code} (band ${ordinal})` });
  return next;
}

export async function setDeviceStatus(id: string, status: Device['status'], admin?: { id: string; full_name: string }): Promise<void> {
  const row = await db.devices.get(id);
  if (!row) return;
  await db.devices.put({ ...row, status, updated_at: nowIso() });
  if (admin) await logAudit({ user_id: admin.id, user_name: admin.full_name, action: 'DEVICE_STATUS', entity_type: 'device', entity_id: id, old_value: row.status, new_value: status });
}

export async function renameDevice(id: string, friendly_name: string, code?: string): Promise<void> {
  const row = await db.devices.get(id);
  if (!row) return;
  await db.devices.put({ ...row, friendly_name, code: code ?? row.code, updated_at: nowIso() });
}

// ---- numbering bands ------------------------------------------------------

/**
 * Serial base for this device, so בד״ח numbers never collide across devices.
 * Band = (ordinal-1) * block_size. Ordinal 1 (or central/unassigned) → base 0,
 * identical to single-device behavior, so existing installs are unaffected.
 */
export async function deviceSerialBase(): Promise<number> {
  const self = await getThisDevice();
  return self.ordinal > 1 ? (self.ordinal - 1) * self.block_size : 0;
}

// ---- watermarks -----------------------------------------------------------

async function getSyncState(key: string): Promise<SyncState> {
  return (await db.sync_state.get(key)) ?? { key, updated_at: nowIso() };
}
async function putSyncState(s: Omit<SyncState, 'updated_at'>): Promise<void> {
  await db.sync_state.put({ ...s, updated_at: nowIso() });
}

// ---- effective mtime (form + its children) --------------------------------

function maxIso(...vals: Array<string | null | undefined>): string {
  let m = '';
  for (const v of vals) if (v && v > m) m = v;
  return m;
}

/**
 * A form's effective change time = latest of the form itself and its signatures.
 * Measurement/task/treatment edits already bump the form's `updated_at`
 * (touchInProgress), so the form timestamp covers its children's changes.
 */
function formMtime(form: CompletedForm, sigs: Signature[]): string {
  return maxIso(form.updated_at, form.created_at, form.completed_at, form.approved_at, ...sigs.map((s) => s.signed_at));
}

// ---- package types (local) ------------------------------------------------

export interface SyncPackage {
  type: 'vero-sync-package';
  version: number;
  kind: 'device-to-central' | 'central-to-device';
  from_device: string;
  from_code?: string;
  to_device?: string | null;
  created_at: string;
  since?: string | null;
  checksum: string;
  // tablet → central (owned by the device):
  forms?: CompletedForm[];
  tasks?: CompletedTask[];
  blocks?: CompletedBlock[];
  signatures?: Signature[];
  form_audit?: AuditEntry[];
  exam_attempts?: ExamAttempt[]; // owned by the device that sat the exam
  cert_renewals?: CertRenewal[]; // shared: created on a tablet, approved on central (newer-wins)
  device?: Device | null; // the sending device's own record (identity)
  // central → device (owned by central):
  users?: User[];
  roles?: Role[];
  user_roles?: UserRole[];
  systems?: System[];
  units?: Unit[];
  ranks?: Rank[];
  performers?: Performer[];
  templates?: Template[];
  template_tasks?: TemplateTask[];
  template_blocks?: TemplateBlock[];
  user_system_ranks?: UserSystemRank[];
  settings?: Setting[];
  exams?: Exam[]; // central-owned exam definitions
  exam_questions?: ExamQuestion[];
  renewal_approvers?: RenewalApprover[]; // central-owned approver assignments
  devices?: Device[]; // device registry mirror
  allocation?: { ordinal: number; block_size: number } | null; // band for the target
}

/** Stable, cheap integrity hash over the package (excluding the checksum). */
export function checksumOf(pkg: Omit<SyncPackage, 'checksum'>): string {
  const json = JSON.stringify(pkg);
  let h1 = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h1 ^= json.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return `${(h1 >>> 0).toString(16)}-${json.length}`;
}

// ---- build outgoing package ----------------------------------------------

/**
 * Build the package this install should SEND, from a watermark. On a tablet
 * this is its owned forms changed since the central watermark; on the central
 * station it is the config + registry changes for a target device.
 */
export async function buildOutgoingPackage(opts?: { targetDeviceId?: string }): Promise<SyncPackage> {
  const role = await getRole();
  const self = await getThisDevice();
  const base: Omit<SyncPackage, 'checksum'> = {
    type: 'vero-sync-package',
    version: PKG_VERSION,
    kind: role === 'central' ? 'central-to-device' : 'device-to-central',
    from_device: self.id,
    from_code: self.code,
    to_device: opts?.targetDeviceId ?? null,
    created_at: nowIso(),
  };

  if (role === 'tablet') {
    const peerKey = 'central';
    const since = (await getSyncState(peerKey)).last_sent_at ?? null;
    const [allForms, allTasks, allBlocks, allSigs, allAudit, allAttempts] = await Promise.all([
      db.completed_forms.toArray(),
      db.completed_tasks.toArray(),
      db.completed_blocks.toArray(),
      db.signatures.toArray(),
      db.audit_log.toArray(),
      db.exam_attempts.toArray(),
    ]);
    const sigsByForm = new Map<string, Signature[]>();
    for (const s of allSigs) (sigsByForm.get(s.completed_form_id) ?? sigsByForm.set(s.completed_form_id, []).get(s.completed_form_id)!).push(s);

    const forms = allForms.filter((f) => {
      const m = formMtime(f, sigsByForm.get(f.id) ?? []);
      return !since || m > since;
    });
    const ids = new Set(forms.map((f) => f.id));
    base.forms = forms;
    base.tasks = allTasks.filter((t) => ids.has(t.completed_form_id));
    base.blocks = allBlocks.filter((b) => ids.has(b.completed_form_id));
    base.signatures = allSigs.filter((s) => ids.has(s.completed_form_id));
    base.form_audit = allAudit.filter((a) => a.entity_type === 'form' && ids.has(a.entity_id));
    base.exam_attempts = allAttempts.filter((a) => !since || (a.updated_at ?? a.started_at) > since);
    const allRenewals = await db.cert_renewals.toArray();
    base.cert_renewals = allRenewals.filter((r) => !since || r.updated_at > since);
    base.device = self;
    base.since = since;
  } else {
    // central → device: config + registry. Permission-critical tables are sent
    // in full (so revocations propagate promptly); heavy tables are incremental.
    const target = opts?.targetDeviceId ? await db.devices.get(opts.targetDeviceId) : null;
    const peerKey = opts?.targetDeviceId ?? 'broadcast';
    const since = (await getSyncState(peerKey)).last_sent_at ?? null;
    const [users, roles, user_roles, systems, units, ranks, performers, templates, template_tasks, template_blocks, usr, settings, devices, exams, exam_questions] =
      await Promise.all([
        db.users.toArray(), db.roles.toArray(), db.user_roles.toArray(),
        db.systems.toArray(), db.units.toArray(), db.ranks.toArray(), db.performers.toArray(),
        db.templates.toArray(), db.template_tasks.toArray(), db.template_blocks.toArray(),
        db.user_system_ranks.toArray(), db.settings.toArray(), db.devices.toArray(),
        db.exams.toArray(), db.exam_questions.toArray(),
      ]);
    const fresh = <T extends { updated_at?: string }>(rows: T[]) => (since ? rows.filter((r) => !r.updated_at || r.updated_at > since) : rows);
    base.users = users; // full (revocations)
    base.roles = roles;
    base.user_roles = user_roles; // full (permission changes)
    base.user_system_ranks = usr; // full (cert changes / revocations)
    base.systems = fresh(systems);
    base.units = fresh(units);
    base.ranks = fresh(ranks);
    base.performers = performers;
    base.templates = fresh(templates);
    base.template_tasks = template_tasks.filter((t) => fresh(templates).some((tp) => tp.id === t.template_id) || !since);
    base.template_blocks = template_blocks.filter((b) => fresh(templates).some((tp) => tp.id === b.template_id) || !since);
    base.settings = settings.filter((s) => s.key !== ROLE_KEY); // never push role onto a device
    base.exams = fresh(exams);
    base.exam_questions = exam_questions.filter((q) => fresh(exams).some((e) => e.id === q.exam_id) || !since);
    base.renewal_approvers = await db.renewal_approvers.toArray(); // central-owned (small)
    const centralRenewals = await db.cert_renewals.toArray();
    base.cert_renewals = centralRenewals.filter((r) => !since || r.updated_at > since); // send approvals/rejections back
    base.devices = devices.map((d) => ({ ...d, is_self: false }));
    base.allocation = target && target.status === 'authorized' ? { ordinal: target.ordinal, block_size: target.block_size } : null;
    base.since = since;
  }

  return { ...base, checksum: checksumOf(base) };
}

// ---- apply incoming package ----------------------------------------------

function upsertNewer<T extends { id: string; updated_at?: string }>(existing: Map<string, T>, incoming: T[], mtime: (r: T) => string): { put: T[]; skipped: number } {
  const put: T[] = [];
  let skipped = 0;
  for (const r of incoming) {
    const cur = existing.get(r.id);
    if (!cur) put.push(r);
    else if (mtime(r) > mtime(cur)) put.push(r);
    else skipped++;
  }
  return { put, skipped };
}

/**
 * Apply a received package. Ownership-scoped (a central-to-device package never
 * touches forms; a device-to-central package never touches config), idempotent
 * (upsert by id, strictly-newer wins), and watermark-advancing for incremental
 * resume. Returns a human summary for the UI.
 */
export async function applyIncomingPackage(pkg: SyncPackage, admin?: { id: string; full_name: string }): Promise<SyncSummary> {
  if (pkg?.type !== 'vero-sync-package') throw new Error('חבילת הסנכרון אינה תקינה');
  // Integrity: recompute the checksum over the same shape used to build it.
  const { checksum: _c, ...rest } = pkg;
  if (checksumOf(rest) !== pkg.checksum) throw new Error('חבילת הסנכרון פגומה (checksum)');
  const role = await getRole();
  const now = nowIso();
  const counts = { forms: 0, templates: 0, certs: 0, users: 0, devices: 0, skipped: 0 };

  // Short-circuit an exact duplicate import.
  const peerKey = pkg.kind === 'device-to-central' ? pkg.from_device : 'central';
  const st = await getSyncState(peerKey);
  if (st.last_import_checksum === pkg.checksum) {
    return summarize('in', counts, now, 'החבילה כבר נקלטה קודם — אין שינויים חדשים.');
  }

  if (pkg.kind === 'device-to-central') {
    if (role !== 'central') throw new Error('חבילה זו מיועדת לתחנה המרכזית בלבד');
    // Authorization gate: an unknown/unauthorized device cannot sync.
    const dev = pkg.from_device ? await db.devices.get(pkg.from_device) : null;
    const known = dev ?? (pkg.device ? await registerDevice({ id: pkg.from_device, code: pkg.device.code, friendly_name: pkg.device.friendly_name }) : null);
    if (!known || known.status !== 'authorized') {
      await addSyncLog({ direction: 'in', peer_device: pkg.from_device, peer_code: pkg.from_code, kind: pkg.kind, counts, ok: false, message: 'מכשיר אינו מאושר — הסנכרון נדחה' });
      throw new Error('המכשיר אינו מאושר בתחנה המרכזית');
    }
    await db.transaction('rw', [db.completed_forms, db.completed_tasks, db.completed_blocks, db.signatures, db.audit_log, db.exam_attempts, db.cert_renewals], async () => {
      // Exam attempts are owned by the device that sat them — newer wins.
      if (pkg.exam_attempts?.length) {
        const curA = new Map((await db.exam_attempts.toArray()).map((a) => [a.id, a]));
        const put = pkg.exam_attempts.filter((a) => { const c = curA.get(a.id); return !c || (a.updated_at ?? a.started_at) > (c.updated_at ?? c.started_at); });
        if (put.length) await db.exam_attempts.bulkPut(put);
      }
      // Renewal records (shared) — newer wins; idempotent by id (one per attempt).
      if (pkg.cert_renewals?.length) {
        const curR = new Map((await db.cert_renewals.toArray()).map((r) => [r.id, r]));
        const put = pkg.cert_renewals.filter((r) => { const c = curR.get(r.id); return !c || r.updated_at > c.updated_at; });
        if (put.length) await db.cert_renewals.bulkPut(put);
      }
      const curForms = new Map((await db.completed_forms.toArray()).map((f) => [f.id, f]));
      const fRes = upsertNewer(curForms, pkg.forms ?? [], (f) => maxIso(f.updated_at, f.created_at, f.completed_at, f.approved_at));
      if (fRes.put.length) await db.completed_forms.bulkPut(fRes.put);
      counts.forms = fRes.put.length;
      counts.skipped += fRes.skipped;
      // Children: replace for forms we accepted (bounded per form).
      const acceptedForms = new Set(fRes.put.map((f) => f.id));
      if (pkg.tasks?.length) await db.completed_tasks.bulkPut(pkg.tasks.filter((t) => acceptedForms.has(t.completed_form_id)));
      if (pkg.blocks?.length) await db.completed_blocks.bulkPut(pkg.blocks.filter((b) => acceptedForms.has(b.completed_form_id)));
      if (pkg.signatures?.length) await db.signatures.bulkPut(pkg.signatures.filter((s) => acceptedForms.has(s.completed_form_id)));
      if (pkg.form_audit?.length) {
        const curA = new Map((await db.audit_log.toArray()).map((a) => [a.id, a]));
        const aNew = pkg.form_audit.filter((a) => !curA.has(a.id));
        if (aNew.length) await db.audit_log.bulkAdd(aNew);
      }
    });
    // Update device stats + watermark.
    const applied = maxIso(...(pkg.forms ?? []).map((f) => maxIso(f.updated_at, f.created_at, f.completed_at, f.approved_at)));
    await db.devices.put({ ...known, last_sync_at: now, last_dir: 'in', received_forms: (known.received_forms ?? 0) + counts.forms, updated_at: now });
    await putSyncState({ key: peerKey, last_received_at: maxIso(st.last_received_at, applied), last_import_checksum: pkg.checksum });
  } else {
    // central → device: config + registry + numbering band.
    if (role === 'central') throw new Error('חבילת הגדרות אינה חלה על התחנה המרכזית');
    await db.transaction('rw', [db.users, db.roles, db.user_roles, db.systems, db.units, db.ranks, db.performers, db.templates, db.template_tasks, db.template_blocks, db.user_system_ranks, db.settings, db.devices, db.exams, db.exam_questions, db.renewal_approvers, db.cert_renewals], async () => {
      // Central-authoritative tables (small) → unconditional upsert so that
      // permission/cert revocations always reach the tablet. Idempotent.
      //
      // Natural-key reconciliation: a tablet enrolled from central shares the
      // central's ids, so a plain id-upsert is exact. But a device that was
      // independently seeded has the same usernames under different ids and a
      // unique `username` index — so central wins by replacing the local row by
      // its natural key (username / role name), making central's id canonical.
      if (pkg.users?.length) {
        const byName = new Map((await db.users.toArray()).map((u) => [u.username, u]));
        for (const u of pkg.users) {
          const loc = byName.get(u.username);
          if (loc && loc.id !== u.id) {
            await db.user_roles.where('user_id').equals(loc.id).delete();
            await db.user_system_ranks.where('user_id').equals(loc.id).delete();
            await db.users.delete(loc.id);
          }
          await db.users.put(u);
        }
        counts.users = pkg.users.length;
      }
      if (pkg.roles?.length) {
        const byName = new Map((await db.roles.toArray()).map((r) => [r.name, r]));
        for (const r of pkg.roles) {
          const loc = byName.get(r.name);
          if (loc && loc.id !== r.id) await db.roles.delete(loc.id);
          await db.roles.put(r);
        }
      }
      if (pkg.user_roles?.length) await db.user_roles.bulkPut(pkg.user_roles);
      // Structure: a standalone-seeded tablet shares the central's names but not
      // ids, so reconcile top-level structure by name too (central authoritative)
      // instead of adding duplicates. Units stay id-based (names repeat per system).
      if (pkg.systems?.length) {
        const byName = new Map((await db.systems.toArray()).map((s) => [s.name, s]));
        for (const s of pkg.systems) { const loc = byName.get(s.name); if (loc && loc.id !== s.id) await db.systems.delete(loc.id); await db.systems.put(s); }
      }
      if (pkg.ranks?.length) {
        const byName = new Map((await db.ranks.toArray()).map((r) => [r.name, r]));
        for (const r of pkg.ranks) { const loc = byName.get(r.name); if (loc && loc.id !== r.id) await db.ranks.delete(loc.id); await db.ranks.put(r); }
      }
      if (pkg.units?.length) await db.units.bulkPut(pkg.units);
      if (pkg.performers?.length) await db.performers.bulkPut(pkg.performers);
      if (pkg.user_system_ranks?.length) await db.user_system_ranks.bulkPut(pkg.user_system_ranks);
      if (pkg.settings?.length) await db.settings.bulkPut(pkg.settings.filter((s) => s.key !== ROLE_KEY));
      counts.certs = pkg.user_system_ranks?.length ?? 0;
      // Heavy tables (templates may carry images) → incremental newer-wins.
      const mt = <T extends { updated_at?: string; created_at?: string }>(r: T) => maxIso(r.updated_at, r.created_at);
      const curT = new Map((await db.templates.toArray()).map((r) => [r.id, r]));
      const tRes = upsertNewer(curT, pkg.templates ?? [], mt);
      if (tRes.put.length) await db.templates.bulkPut(tRes.put);
      counts.templates = tRes.put.length;
      counts.skipped += tRes.skipped;
      if (pkg.template_tasks?.length) await db.template_tasks.bulkPut(pkg.template_tasks);
      if (pkg.template_blocks?.length) await db.template_blocks.bulkPut(pkg.template_blocks);
      // Exams (central-owned, may carry images) → incremental newer-wins.
      if (pkg.exams?.length) {
        const curE = new Map((await db.exams.toArray()).map((e) => [e.id, e]));
        const eRes = upsertNewer(curE, pkg.exams, mt);
        if (eRes.put.length) await db.exams.bulkPut(eRes.put);
        counts.skipped += eRes.skipped;
      }
      if (pkg.exam_questions?.length) await db.exam_questions.bulkPut(pkg.exam_questions);
      if (pkg.renewal_approvers?.length) await db.renewal_approvers.bulkPut(pkg.renewal_approvers);
      if (pkg.cert_renewals?.length) {
        const curR = new Map((await db.cert_renewals.toArray()).map((r) => [r.id, r]));
        const put = pkg.cert_renewals.filter((r) => { const c = curR.get(r.id); return !c || r.updated_at > c.updated_at; });
        if (put.length) await db.cert_renewals.bulkPut(put);
      }
      // Mirror the device registry (but keep THIS device's own row / self flag).
      if (pkg.devices?.length) {
        const selfId = getDeviceId();
        const mine = await db.devices.get(selfId);
        const rows = pkg.devices.filter((d) => d.id !== selfId).map((d) => ({ ...d, is_self: false }));
        if (rows.length) await db.devices.bulkPut(rows);
        // Apply my own numbering band / status from the package if present.
        if (mine && pkg.allocation) {
          await db.devices.put({ ...mine, ordinal: pkg.allocation.ordinal, block_size: pkg.allocation.block_size, status: 'authorized', updated_at: now });
        }
        const serverMe = pkg.devices.find((d) => d.id === selfId);
        if (mine && serverMe) await db.devices.put({ ...mine, code: serverMe.code, friendly_name: serverMe.friendly_name, status: serverMe.status, ordinal: pkg.allocation?.ordinal ?? serverMe.ordinal, block_size: pkg.allocation?.block_size ?? serverMe.block_size, updated_at: now });
        counts.devices = rows.length;
      }
    });
    // Record the "verified against central" time for stale-permission policy.
    await setSetting('last_central_sync_at', now);
    await putSyncState({ key: peerKey, last_received_at: now, last_import_checksum: pkg.checksum });
  }

  const msg = buildMessage(counts);
  await addSyncLog({ direction: 'in', peer_device: pkg.from_device, peer_code: pkg.from_code, kind: pkg.kind, counts, ok: true, message: msg });
  if (admin) await logAudit({ user_id: admin.id, user_name: admin.full_name, action: 'SYNC_IMPORT', entity_type: 'sync', entity_id: pkg.from_device, new_value: msg });
  return summarize('in', counts, now, msg);
}

/**
 * Mark the outgoing watermark after a package was successfully handed off.
 * Pass the package's `created_at` as `at` so the boundary is the build moment
 * (every record in the package existed at/ before it); anything edited later is
 * picked up on the next sync.
 */
export async function markSent(opts?: { targetDeviceId?: string; at?: string }): Promise<void> {
  const role = await getRole();
  const peerKey = role === 'tablet' ? 'central' : opts?.targetDeviceId ?? 'broadcast';
  const st = await getSyncState(peerKey);
  await putSyncState({ ...st, key: peerKey, last_sent_at: opts?.at ?? nowIso() });
}

// ---- sync log -------------------------------------------------------------

export async function addSyncLog(e: Omit<SyncLogEntry, 'id' | 'at'>): Promise<void> {
  await db.sync_log.add({ id: newId(), at: nowIso(), ...e });
}
export async function listSyncLog(limit = 100): Promise<SyncLogEntry[]> {
  const all = await db.sync_log.orderBy('at').reverse().limit(limit).toArray();
  return all;
}

// ---- summaries ------------------------------------------------------------

function buildMessage(c: { forms: number; templates: number; certs: number; users: number; devices: number }): string {
  const parts: string[] = [];
  if (c.forms) parts.push(`${c.forms} בד״חים הועברו`);
  if (c.templates) parts.push(`${c.templates} תבניות עודכנו`);
  if (c.certs) parts.push(`${c.certs} הסמכות עודכנו`);
  if (c.users) parts.push(`${c.users} משתמשים עודכנו`);
  if (c.devices) parts.push(`${c.devices} מכשירים עודכנו`);
  return parts.length ? parts.join(' · ') : 'אין נתונים חדשים לסנכרון';
}
function summarize(direction: 'in' | 'out', c: { forms: number; templates: number; certs: number; users: number; devices: number; skipped: number }, at: string, message: string): SyncSummary {
  return { direction, ...c, at, message };
}

/** The last time this tablet verified its config against the central station. */
export async function getLastCentralSyncAt(): Promise<string | null> {
  return getSetting('last_central_sync_at');
}
