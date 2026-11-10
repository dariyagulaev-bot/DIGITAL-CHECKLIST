import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { logAudit } from './audit';
import { isCertifier } from './rbac';
import type { CertifierAuthorization, UserWithRoles } from '@/types';

/**
 * CERTIFIER (מסמיך) authorization: an explicit permission to certify in a
 * specific (system, rank). Holding the CERTIFIER role alone is NOT enough — and
 * being ADMIN or APPROVER never grants certification authority implicitly. All
 * gating is enforced here in the business layer, not only in the UI.
 */

export async function listCertifierAuthorizations(userId: string): Promise<CertifierAuthorization[]> {
  return db.certifier_authorizations.where('user_id').equals(userId).toArray();
}

export async function listAllCertifierAuthorizations(): Promise<CertifierAuthorization[]> {
  return db.certifier_authorizations.toArray();
}

/** The certifier's scope as system_id → set of rank_ids they may certify. */
export async function certifierScope(userId: string): Promise<Map<string, Set<string>>> {
  const rows = await listCertifierAuthorizations(userId);
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.system_id)) map.set(r.system_id, new Set());
    map.get(r.system_id)!.add(r.rank_id);
  }
  return map;
}

/** Pure check: does this scope allow certifying (system, rank)? */
export function scopeAllows(scope: Map<string, Set<string>>, systemId: string, rankId: string): boolean {
  return !!scope.get(systemId)?.has(rankId);
}

/**
 * Business-layer gate: may `user` certify in (system, rank)? Requires BOTH the
 * CERTIFIER role AND an explicit authorization row for that exact (system, rank).
 * ADMIN does NOT bypass this.
 */
export async function canCertify(
  user: UserWithRoles | null,
  systemId: string,
  rankId: string
): Promise<boolean> {
  if (!user || !isCertifier(user)) return false;
  const scope = await certifierScope(user.id);
  return scopeAllows(scope, systemId, rankId);
}

export const NOT_AUTHORIZED_TO_CERTIFY = 'אינך מורשה לבצע הסמכה עבור מערכת ודרג אלה.';

/** Throwing variant for use inside certification/renewal flows. */
export async function assertCanCertify(
  user: UserWithRoles | null,
  systemId: string,
  rankId: string
): Promise<void> {
  if (!(await canCertify(user, systemId, rankId))) throw new Error(NOT_AUTHORIZED_TO_CERTIFY);
}

/** A compact, audit-friendly snapshot of a scope ("sys:rank,rank | sys2:rank"). */
function scopeSnap(rows: CertifierAuthorization[]): string {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    if (!map.has(r.system_id)) map.set(r.system_id, []);
    map.get(r.system_id)!.push(r.rank_id);
  }
  return [...map.entries()].map(([s, rk]) => `${s}:${rk.sort().join(',')}`).sort().join(' | ');
}

/**
 * Replace a user's certifier authorizations with the given (system, rank) pairs.
 * Removing an authorization NEVER affects certifications/certificates the user
 * already performed — only future actions in that scope. Audited (old → new).
 */
export async function setCertifierAuthorizations(
  userId: string,
  pairs: Array<{ system_id: string; rank_id: string }>,
  actor: { id: string; full_name: string }
): Promise<void> {
  const before = await listCertifierAuthorizations(userId);
  // De-duplicate incoming pairs.
  const seen = new Set<string>();
  const clean = pairs.filter((p) => {
    const k = `${p.system_id}|${p.rank_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const beforeSnap = scopeSnap(before);
  const now = nowIso();
  const next: CertifierAuthorization[] = clean.map((p) => ({
    id: newId(),
    user_id: userId,
    system_id: p.system_id,
    rank_id: p.rank_id,
    created_at: now,
  }));
  const afterSnap = scopeSnap(next);
  if (beforeSnap === afterSnap) return; // no change → no write, no audit noise

  await db.transaction('rw', db.certifier_authorizations, async () => {
    if (before.length) await db.certifier_authorizations.bulkDelete(before.map((r) => r.id));
    if (next.length) await db.certifier_authorizations.bulkAdd(next);
  });
  await logAudit({
    user_id: actor.id,
    user_name: actor.full_name,
    action: 'CERTIFIER_AUTH_CHANGE',
    entity_type: 'certifier_authorization',
    entity_id: userId,
    old_value: beforeSnap || '—',
    new_value: afterSnap || '—',
  });
}
