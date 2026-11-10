import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';
import { resetDb, ensureRoles, makeUser } from '@/test/helpers';
import { createSystem } from '@/services/systems';
import { createRank } from '@/services/ranks';
import {
  setCertification,
  isUserCertified,
  listCertifiedPerformerUsers,
  certStatus,
} from '@/services/certifications';
import { newId, nowIso } from '@/services/ids';
import { addMonths, todayStr } from '@/services/dates';
import { RoleName, type UserWithRoles } from '@/types';

/**
 * Regression guard: the LEGACY certification model (single max-rank in
 * user_system_ranks, hierarchical, no granular grants, no prerequisites) must
 * behave EXACTLY as before even though VERO gating now routes through the
 * effective-competency engine. Nothing about existing data/behaviour changes.
 */

let admin: UserWithRoles;
let p1: UserWithRoles;
let p2: UserWithRoles;
let sysId: string;
let rankA: string;
let rankB: string;

beforeEach(async () => {
  await resetDb();
  await ensureRoles();
  admin = await makeUser('admin', 'מנהל', [RoleName.ADMIN]);
  p1 = await makeUser('p1', 'מבצע 1', [RoleName.PERFORMER]);
  p2 = await makeUser('p2', 'מבצע 2', [RoleName.PERFORMER]);
  sysId = (await createSystem('מערכת א׳')).id;
  rankA = (await createRank('דרג א׳')).id; // sort 0
  rankB = (await createRank('דרג ב׳')).id; // sort 1
});

const actor = () => ({ id: admin.id, full_name: admin.full_name });

describe('legacy certification regression', () => {
  it('max-rank hierarchy still covers lower ranks (no granular layer)', async () => {
    await setCertification(p1.id, sysId, rankB, actor()); // max = B
    // Certified for both A and B; the single max-rank covers the one below.
    expect(await isUserCertified(p1.id, sysId, rankA)).toBe(true);
    expect(await isUserCertified(p1.id, sysId, rankB)).toBe(true);
    // No row for p2 → not certified.
    expect(await isUserCertified(p2.id, sysId, rankA)).toBe(false);
  });

  it('an expired legacy certification is excluded from new work', async () => {
    // Manually craft an expired legacy row (issued long ago, 1-month validity).
    await db.user_system_ranks.add({
      id: newId(),
      user_id: p1.id,
      system_id: sysId,
      max_rank_id: rankA,
      issued_at: '2020-01-01',
      validity_months: 1,
      expires_at: '2020-02-01',
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    expect(await isUserCertified(p1.id, sysId, rankA)).toBe(false);
    const pool = await listCertifiedPerformerUsers(sysId, rankA);
    expect(pool.some((u) => u.id === p1.id)).toBe(false);
  });

  it('a valid legacy certification lists the performer in the certified pool', async () => {
    const issued = addMonths(todayStr(), -1);
    await setCertification(p1.id, sysId, rankA, actor(), { issuedAt: issued, validityMonths: 24 });
    const pool = await listCertifiedPerformerUsers(sysId, rankA);
    expect(pool.some((u) => u.id === p1.id)).toBe(true);
  });

  it('certStatus date logic is unchanged (valid / needs_renewal / expired)', () => {
    const now = '2026-01-01';
    expect(certStatus({ expires_at: undefined }, now)).toBe('valid');
    expect(certStatus({ expires_at: '2027-01-01' }, now)).toBe('valid');
    expect(certStatus({ expires_at: '2026-02-01' }, now)).toBe('needs_renewal');
    expect(certStatus({ expires_at: '2025-12-31' }, now)).toBe('expired');
  });

  it('a system with no rank context accepts any active certification', async () => {
    await setCertification(p1.id, sysId, rankA, actor());
    expect(await isUserCertified(p1.id, sysId, null)).toBe(true);
    expect(await isUserCertified(p2.id, sysId, null)).toBe(false);
  });

  it('no system context is never gated (defensive legacy behaviour)', async () => {
    expect(await isUserCertified(p2.id, null, null)).toBe(true);
  });
});
