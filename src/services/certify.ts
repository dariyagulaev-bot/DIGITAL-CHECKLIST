import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { logAudit } from './audit';
import { assertCanCertify } from './certifiers';
import { transitivePrerequisites } from './prerequisites';
import {
  systemCompetency,
  effectiveRankStatus,
  isActiveStatus,
  effectiveStatusLabel,
} from './competency';
import { listRanks } from './ranks';
import { getCertValidityMonths, getCertifierRequireOwnCompetency } from './settings';
import { maskIdNumber } from './identity';
import { addMonths, todayStr } from './dates';
import type { RankCertification, UserWithRoles } from '@/types';

/**
 * The certification workflow (ביצוע הסמכה / רענון). Orders the gates exactly as
 * the spec requires (§16-17), ALL in the business layer:
 *   employee → system → rank → initial/renewal
 *   → certifier authorized for (system, rank)?        (assertCanCertify)
 *   → [optional] certifier is competent themselves?   (§15 policy)
 *   → employee meets rank prerequisites?              (effective competency)
 *   → execute: write rank_certifications + certifier signature snapshot
 *   → update legacy max-rank projection + audit.
 *
 * Nothing here trusts the UI; every gate is enforced server-side. ADMIN does not
 * bypass certifier authorization.
 */

export const PREREQ_NOT_MET = 'העובד אינו עומד בתנאי הקדם הנדרשים לדרג זה.';
export const CERTIFIER_NOT_COMPETENT =
  'אינך מוסמך בעצמך במערכת ובדרג אלה, ולכן אינך רשאי להסמיך בהם (לפי מדיניות המערכת).';

export interface PerformCertificationInput {
  employeeUserId: string;
  systemId: string;
  rankId: string;
  actionType: 'initial' | 'renewal';
  certifier: UserWithRoles;
  signatureData?: string; // PNG data URL from the signature pad
  issuedAt?: string; // defaults to today
  validityMonths?: number; // defaults to the global setting
  certificateIssued?: boolean; // whether a certificate was generated (audit only)
}

export interface PerformCertificationResult {
  rankCertification: RankCertification;
}

/** The transitive prerequisites the employee is MISSING for (system, rank). */
export async function missingPrerequisites(
  employeeUserId: string,
  systemId: string,
  rankId: string,
  now?: string
): Promise<string[]> {
  const required = await transitivePrerequisites(systemId, rankId);
  if (required.size === 0) return [];
  const comp = await systemCompetency(employeeUserId, systemId, now);
  const missing: string[] = [];
  for (const prereqId of required) {
    if (!isActiveStatus(comp.get(prereqId) ?? 'none')) missing.push(prereqId);
  }
  return missing;
}

export async function getRankCertification(
  userId: string,
  systemId: string,
  rankId: string
): Promise<RankCertification | undefined> {
  return db.rank_certifications
    .where('[user_id+system_id+rank_id]')
    .equals([userId, systemId, rankId])
    .first();
}

export async function listRankCertifications(
  userId: string,
  systemId?: string
): Promise<RankCertification[]> {
  if (systemId) {
    return db.rank_certifications.where('[user_id+system_id]').equals([userId, systemId]).toArray();
  }
  return db.rank_certifications.where('user_id').equals(userId).toArray();
}

/**
 * Keep the legacy user_system_ranks row (max-rank + validity) in sync with the
 * granular rank_certifications, so existing screens (dashboard, alerts, admin
 * certifications list, exports) keep working. The projection is the HIGHEST rank
 * the user holds a granular grant for, carrying that grant's validity window.
 */
async function syncLegacyProjection(userId: string, systemId: string): Promise<void> {
  const [ranks, grants, legacy] = await Promise.all([
    listRanks(true),
    listRankCertifications(userId, systemId),
    db.user_system_ranks.where('[user_id+system_id]').equals([userId, systemId]).first(),
  ]);
  if (grants.length === 0) return; // nothing granular yet — leave legacy as-is
  const orderById = new Map(ranks.map((r) => [r.id, r.sort_order]));
  let top = grants[0];
  for (const g of grants) {
    if ((orderById.get(g.rank_id) ?? -1) > (orderById.get(top.rank_id) ?? -1)) top = g;
  }
  const now = nowIso();
  if (legacy) {
    await db.user_system_ranks.update(legacy.id, {
      max_rank_id: top.rank_id,
      issued_at: top.issued_at,
      validity_months: top.validity_months,
      expires_at: top.expires_at,
      updated_at: now,
    });
  } else {
    await db.user_system_ranks.add({
      id: newId(),
      user_id: userId,
      system_id: systemId,
      max_rank_id: top.rank_id,
      issued_at: top.issued_at,
      validity_months: top.validity_months,
      expires_at: top.expires_at,
      created_at: now,
      updated_at: now,
    });
  }
}

export async function performCertification(
  input: PerformCertificationInput
): Promise<PerformCertificationResult> {
  const { employeeUserId, systemId, rankId, actionType, certifier } = input;

  // 1) Certifier must be authorized for this exact (system, rank). ADMIN does NOT
  //    bypass. Throws NOT_AUTHORIZED_TO_CERTIFY otherwise.
  await assertCanCertify(certifier, systemId, rankId);

  // 2) §15 — optional policy: the certifier must be competent themselves.
  if (await getCertifierRequireOwnCompetency()) {
    const selfStatus = await effectiveRankStatus(certifier.id, systemId, rankId);
    if (!isActiveStatus(selfStatus)) throw new Error(CERTIFIER_NOT_COMPETENT);
  }

  // 3) Employee must meet the rank's prerequisites (effective competency).
  const missing = await missingPrerequisites(employeeUserId, systemId, rankId);
  if (missing.length > 0) throw new Error(PREREQ_NOT_MET);

  // 4) Execute — upsert the granular rank certification.
  const issuedAt = input.issuedAt ?? todayStr();
  const validityMonths = input.validityMonths ?? (await getCertValidityMonths());
  const expiresAt = addMonths(issuedAt, validityMonths);
  const now = nowIso();
  const existing = await getRankCertification(employeeUserId, systemId, rankId);

  const row: RankCertification = {
    id: existing?.id ?? newId(),
    user_id: employeeUserId,
    system_id: systemId,
    rank_id: rankId,
    action_type: actionType,
    issued_at: issuedAt,
    validity_months: validityMonths,
    expires_at: expiresAt,
    certifier_user_id: certifier.id,
    certifier_name_snapshot: certifier.full_name,
    signature_data: input.signatureData,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  if (existing) await db.rank_certifications.put(row);
  else await db.rank_certifications.add(row);

  // 5) Keep the legacy max-rank projection in sync.
  await syncLegacyProjection(employeeUserId, systemId);

  // 6) Audit the certification performed (who/system/rank/type/date/validity/cert).
  //    The employee's protected identity is NEVER written in full here.
  const employee = await db.users.get(employeeUserId);
  const idMask = employee?.id_number ? ` [${maskIdNumber(employee.id_number)}]` : '';
  await logAudit({
    user_id: certifier.id,
    user_name: certifier.full_name,
    action: actionType === 'renewal' ? 'CERT_RENEW_PERFORM' : 'CERT_CERTIFY_PERFORM',
    entity_type: 'rank_certification',
    entity_id: employeeUserId,
    field: `${systemId}|${rankId}`,
    old_value: existing ? `exp=${existing.expires_at}` : null,
    new_value:
      `employee=${employee?.full_name ?? '—'}${idMask};action=${actionType};` +
      `issued=${issuedAt};valid=${validityMonths};exp=${expiresAt};` +
      `certificate=${input.certificateIssued ? 'yes' : 'no'}`,
  });

  return { rankCertification: row };
}

/** Convenience: a one-line human description of a (user, system, rank) status. */
export async function rankStatusLabel(
  userId: string,
  systemId: string,
  rankId: string
): Promise<string> {
  return effectiveStatusLabel(await effectiveRankStatus(userId, systemId, rankId));
}
