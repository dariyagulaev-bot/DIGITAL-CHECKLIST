import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { logAudit } from './audit';
import { listRanks } from './ranks';
import { listSystems } from './systems';
import { listUsersWithRoles } from './auth';
import { getCertValidityMonths } from './settings';
import { todayStr, addMonths, cmpDate } from './dates';
import { RoleName, type CertStatus, type Rank, type UserSystemRank } from '@/types';

/**
 * User certifications (הסמכות): per (user, system type), the HIGHEST rank the
 * user may inspect. Ranks are HIERARCHICAL — a max rank automatically covers
 * every rank below it (ordered by Rank.sort_order). No row = ללא הסמכה.
 *
 * All gating is enforced here in the business layer, not only in the UI.
 */

export async function listCertifications(userId: string): Promise<UserSystemRank[]> {
  return db.user_system_ranks.where('user_id').equals(userId).toArray();
}

export async function listAllCertifications(): Promise<UserSystemRank[]> {
  return db.user_system_ranks.toArray();
}

export async function getMaxRankId(userId: string, systemId: string): Promise<string | null> {
  const row = await db.user_system_ranks
    .where('[user_id+system_id]')
    .equals([userId, systemId])
    .first();
  return row?.max_rank_id ?? null;
}

/** The full certification row for (user, system), or undefined. */
export async function getCertRow(
  userId: string,
  systemId: string
): Promise<UserSystemRank | undefined> {
  return db.user_system_ranks.where('[user_id+system_id]').equals([userId, systemId]).first();
}

/**
 * Validity status of a certification, derived purely from dates (offline).
 *   • no expires_at        → 'valid' (legacy / validity not configured yet)
 *   • today  > expires     → 'expired'
 *   • today ≥ expires − 3mo → 'needs_renewal' (3 months before, DATE-based)
 *   • otherwise            → 'valid'
 * The expiry day itself counts as still valid ("needs_renewal"), and only the
 * day AFTER expiry is 'expired' — handled consistently via date comparison.
 */
export function certStatus(
  cert: Pick<UserSystemRank, 'expires_at'> | null | undefined,
  now: string = todayStr()
): CertStatus {
  if (!cert) return 'none';
  if (!cert.expires_at) return 'valid';
  if (cmpDate(now, cert.expires_at) > 0) return 'expired';
  const renewalStart = addMonths(cert.expires_at, -3);
  if (cmpDate(now, renewalStart) >= 0) return 'needs_renewal';
  return 'valid';
}

/** A certification is usable for NEW work only when it is not expired. */
export function isCertActive(cert: UserSystemRank | null | undefined, now?: string): boolean {
  return !!cert && certStatus(cert, now) !== 'expired';
}

/** The set of rank ids a given max-rank certification covers (hierarchy). */
export function allowedRankIds(
  maxRankId: string | null,
  ranksAsc: Pick<Rank, 'id' | 'sort_order'>[]
): Set<string> {
  if (!maxRankId) return new Set();
  const max = ranksAsc.find((r) => r.id === maxRankId);
  if (!max) return new Set();
  return new Set(ranksAsc.filter((r) => r.sort_order <= max.sort_order).map((r) => r.id));
}

/**
 * Set (maxRankId) or clear (null = ללא הסמכה) a user's certification for a
 * system. Audited with the acting admin + timestamp. Because a higher rank
 * always includes the ranks below it, storing only the max rank makes an
 * illegal combination (e.g. ד׳ without ב׳) structurally impossible.
 */
export interface CertOptions {
  /** Issue / last-renewal date (YYYY-MM-DD). Defaults to today for a new cert. */
  issuedAt?: string;
  /** Validity period in months. Defaults to the admin-configured global value. */
  validityMonths?: number;
}

/** A full, Audit-friendly snapshot of a cert's key fields. */
function snap(c: UserSystemRank | undefined): string {
  if (!c) return '';
  return `rank=${c.max_rank_id};issued=${c.issued_at ?? ''};valid=${c.validity_months ?? ''};exp=${c.expires_at ?? ''}`;
}

export async function setCertification(
  userId: string,
  systemId: string,
  maxRankId: string | null,
  actor: { id: string; full_name: string },
  opts: CertOptions = {}
): Promise<void> {
  const existing = await getCertRow(userId, systemId);
  const now = nowIso();

  // Richer audit: keep the previous rank + dates and the new ones, never
  // overwriting prior history (each change is a fresh audit entry).
  const audit = (action: string, before: UserSystemRank | undefined, after: UserSystemRank | undefined) =>
    logAudit({
      user_id: actor.id,
      user_name: actor.full_name,
      action,
      entity_type: 'user_system_rank',
      entity_id: userId,
      field: systemId,
      old_value: snap(before) || null,
      new_value: snap(after) || null,
    });

  if (maxRankId === null) {
    if (existing) {
      await db.user_system_ranks.delete(existing.id);
      await audit('CERT_REMOVE', existing, undefined);
    }
    return;
  }

  // Resolve validity window. An explicit validity or issue date always applies;
  // otherwise a new cert gets today's date + the global default, while an
  // existing cert keeps its current window unless the rank is the only change.
  const validityMonths = opts.validityMonths ?? existing?.validity_months ?? (await getCertValidityMonths());
  const issuedAt = opts.issuedAt ?? existing?.issued_at ?? todayStr();
  const expiresAt = addMonths(issuedAt, validityMonths);

  if (existing) {
    const unchanged =
      existing.max_rank_id === maxRankId &&
      existing.issued_at === issuedAt &&
      existing.validity_months === validityMonths &&
      existing.expires_at === expiresAt;
    if (unchanged) return;
    const after: UserSystemRank = {
      ...existing,
      max_rank_id: maxRankId,
      issued_at: issuedAt,
      validity_months: validityMonths,
      expires_at: expiresAt,
      updated_at: now,
    };
    await db.user_system_ranks.update(existing.id, {
      max_rank_id: maxRankId,
      issued_at: issuedAt,
      validity_months: validityMonths,
      expires_at: expiresAt,
      updated_at: now,
    });
    await audit('CERT_UPDATE', existing, after);
  } else {
    const row: UserSystemRank = {
      id: newId(),
      user_id: userId,
      system_id: systemId,
      max_rank_id: maxRankId,
      issued_at: issuedAt,
      validity_months: validityMonths,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    };
    await db.user_system_ranks.add(row);
    await audit('CERT_ADD', undefined, row);
  }
}

/**
 * Renew a certification: set a new issue/renewal date and recompute expiry from
 * the cert's own validity window. Clears the "needs renewal" / "expired" state
 * automatically — no manual "handled" flag. Audited with before/after.
 */
export async function renewCertification(
  userId: string,
  systemId: string,
  newIssuedAt: string,
  actor: { id: string; full_name: string },
  validityMonths?: number
): Promise<void> {
  const existing = await getCertRow(userId, systemId);
  if (!existing) throw new Error('לא נמצאה הסמכה לחידוש.');
  const months = validityMonths ?? existing.validity_months ?? (await getCertValidityMonths());
  const expiresAt = addMonths(newIssuedAt, months);
  const after: UserSystemRank = {
    ...existing,
    issued_at: newIssuedAt,
    validity_months: months,
    expires_at: expiresAt,
    updated_at: nowIso(),
  };
  await db.user_system_ranks.update(existing.id, {
    issued_at: newIssuedAt,
    validity_months: months,
    expires_at: expiresAt,
    updated_at: nowIso(),
  });
  await logAudit({
    user_id: actor.id,
    user_name: actor.full_name,
    action: 'CERT_RENEW',
    entity_type: 'user_system_rank',
    entity_id: userId,
    field: systemId,
    old_value: snap(existing),
    new_value: snap(after),
  });
}

/** Systems the user is certified for (has any certification row). */
export async function certifiedSystemIds(userId: string): Promise<Set<string>> {
  const certs = await listCertifications(userId);
  return new Set(certs.map((c) => c.system_id));
}

/**
 * Is the user certified to run an inspection of (system, rank)?
 *  - systemId null → no system context to gate (legacy/defensive): allowed.
 *  - rankId null → the system has no meaningful rank; any certification suffices.
 * Ranks include inactive ones here so the hierarchy order is stable over time.
 */
export async function isUserCertified(
  userId: string,
  systemId: string | null,
  rankId: string | null
): Promise<boolean> {
  if (!systemId) return true;
  const cert = await getCertRow(userId, systemId);
  if (!cert) return false;
  // An expired certification is NOT usable for new work (enforced here, in the
  // business layer — never only hidden in the UI).
  if (certStatus(cert) === 'expired') return false;
  if (!rankId) return true;
  const ranks = await listRanks(true);
  return allowedRankIds(cert.max_rank_id, ranks).has(rankId);
}

/**
 * Active PERFORMER users certified for (system, rank) — the pool the מבצע 2
 * picker (and repair-performer pickers) draw from. Excludes `excludeUserId`.
 * When `minRankId` is given instead of an exact rank, requires certification at
 * least up to that rank (used for rank-ד treatment performers).
 */
export async function listCertifiedPerformerUsers(
  systemId: string | null,
  rankId: string | null,
  excludeUserId?: string
): Promise<Array<{ id: string; full_name: string }>> {
  const users = (await listUsersWithRoles()).filter(
    (u) => u.active && u.roles.includes(RoleName.PERFORMER)
  );
  const ranks = await listRanks(true);
  const certs = await listAllCertifications();
  // Key → the full cert row, so we can enforce BOTH the rank hierarchy AND that
  // the certification is still in force (expired certs are excluded from new
  // work — part of the business-layer enforcement, not just UI hiding).
  const byKey = new Map(certs.map((c) => [c.user_id + '|' + c.system_id, c]));
  const out: Array<{ id: string; full_name: string }> = [];
  for (const u of users) {
    if (excludeUserId && u.id === excludeUserId) continue;
    if (!systemId) {
      out.push({ id: u.id, full_name: u.full_name });
      continue;
    }
    const cert = byKey.get(u.id + '|' + systemId);
    if (!cert) continue;
    if (certStatus(cert) === 'expired') continue;
    if (rankId && !allowedRankIds(cert.max_rank_id, ranks).has(rankId)) continue;
    out.push({ id: u.id, full_name: u.full_name });
  }
  return out.sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'));
}

/** How many active PERFORMER users are certified for (system, rank). */
export async function countCertifiedPerformers(
  systemId: string | null,
  rankId: string | null,
  excludeUserId?: string
): Promise<number> {
  return (await listCertifiedPerformerUsers(systemId, rankId, excludeUserId)).length;
}

// ---------------------------------------------------------------------------
// Validity: management view, dashboard summary, and user/admin alerts
// ---------------------------------------------------------------------------

/** A fully-resolved certification row for the management screen. */
export interface CertDetail {
  cert: UserSystemRank;
  user_id: string;
  user_name: string;
  user_active: boolean;
  system_id: string;
  system_name: string;
  rank_name: string;
  issued_at?: string;
  expires_at?: string;
  validity_months?: number;
  status: CertStatus;
}

/** All certifications resolved with user/system/rank names + live status. */
export async function listCertificationsDetailed(now?: string): Promise<CertDetail[]> {
  const [certs, users, systems, ranks] = await Promise.all([
    listAllCertifications(),
    listUsersWithRoles(),
    listSystems(true),
    listRanks(true),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const sysMap = new Map(systems.map((s) => [s.id, s]));
  const rankMap = new Map(ranks.map((r) => [r.id, r]));
  return certs
    .map((c) => {
      const u = userMap.get(c.user_id);
      return {
        cert: c,
        user_id: c.user_id,
        user_name: u?.full_name ?? '—',
        user_active: u?.active ?? false,
        system_id: c.system_id,
        system_name: sysMap.get(c.system_id)?.name ?? '—',
        rank_name: rankMap.get(c.max_rank_id)?.name ?? '—',
        issued_at: c.issued_at,
        expires_at: c.expires_at,
        validity_months: c.validity_months,
        status: certStatus(c, now),
      } as CertDetail;
    })
    .sort((a, b) => a.user_name.localeCompare(b.user_name, 'he') || a.system_name.localeCompare(b.system_name, 'he'));
}

export interface CertSummary {
  valid: number;
  needsRenewal: number;
  expired: number;
  total: number;
}

/** Dashboard counts across all certifications. */
export async function certificationSummary(now?: string): Promise<CertSummary> {
  const details = await listCertificationsDetailed(now);
  const s: CertSummary = { valid: 0, needsRenewal: 0, expired: 0, total: details.length };
  for (const d of details) {
    if (d.status === 'needs_renewal') s.needsRenewal += 1;
    else if (d.status === 'expired') s.expired += 1;
    else s.valid += 1; // 'valid' (and 'none' never occurs here)
  }
  return s;
}

/**
 * Certifications for a user that need attention (needs_renewal or expired) —
 * drives the login popup and the persistent home warning. Returns the resolved
 * detail rows, soonest-expiring first.
 */
export async function listAlertsForUser(userId: string, now?: string): Promise<CertDetail[]> {
  const details = await listCertificationsDetailed(now);
  return details
    .filter((d) => d.user_id === userId && (d.status === 'needs_renewal' || d.status === 'expired'))
    .sort((a, b) => (a.expires_at ?? '').localeCompare(b.expires_at ?? ''));
}
