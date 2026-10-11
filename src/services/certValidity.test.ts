import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, ensureRoles, makeUser } from '@/test/helpers';
import { RoleName, type UserWithRoles } from '@/types';
import { createSystem } from '@/services/systems';
import { createRank } from '@/services/ranks';
import {
  setCertification,
  renewCertification,
  getCertRow,
  certStatus,
  isUserCertified,
  listCertifiedPerformerUsers,
  listAlertsForUser,
  certificationSummary,
} from '@/services/certifications';
import { addMonths, diffMonthsDays, remainingLabel, todayStr } from '@/services/dates';

describe('date helpers (calendar-month based)', () => {
  it('addMonths handles year rollover and month-length clamping', () => {
    expect(addMonths('2026-10-15', 12)).toBe('2027-10-15');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'); // clamp to Feb
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29'); // leap year
    expect(addMonths('2027-10-15', -3)).toBe('2027-07-15'); // 3 months before
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15'); // year rollover
  });
  it('diffMonthsDays + remainingLabel match the spec example (2 months 18 days)', () => {
    expect(diffMonthsDays('2027-07-27', '2027-10-15')).toEqual({ months: 2, days: 18 });
    expect(remainingLabel('2027-07-27', '2027-10-15')).toBe('2 חודשים ו-18 ימים');
    expect(diffMonthsDays('2027-10-15', '2027-10-15')).toEqual({ months: 0, days: 0 });
  });
});

describe('certStatus — pure date-based thresholds (part 18)', () => {
  const exp = { expires_at: '2027-10-15' };
  it('more than 3 months to expiry → valid (no alert)', () => {
    expect(certStatus(exp, '2027-06-01')).toBe('valid');
  });
  it('exactly 3 months before → needs_renewal', () => {
    expect(certStatus(exp, '2027-07-15')).toBe('needs_renewal');
  });
  it('one month / one day before → needs_renewal', () => {
    expect(certStatus(exp, '2027-09-15')).toBe('needs_renewal');
    expect(certStatus(exp, '2027-10-14')).toBe('needs_renewal');
  });
  it('on the expiry day → still valid (needs_renewal), not expired', () => {
    expect(certStatus(exp, '2027-10-15')).toBe('needs_renewal');
  });
  it('the day after expiry → expired', () => {
    expect(certStatus(exp, '2027-10-16')).toBe('expired');
  });
  it('a cert with no expiry is valid (legacy / unconfigured)', () => {
    expect(certStatus({ expires_at: undefined })).toBe('valid');
    expect(certStatus(null)).toBe('none');
  });
});

describe('certification validity — DB enforcement & alerts', () => {
  let admin: UserWithRoles;
  let perf: UserWithRoles;
  let perf2: UserWithRoles;
  let sysA: string;
  let rankA: string;
  let rankB: string;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    admin = await makeUser('admin', 'מנהל', [RoleName.ADMIN]);
    perf = await makeUser('perf', 'ישראל', [RoleName.PERFORMER]);
    perf2 = await makeUser('perf2', 'דני', [RoleName.PERFORMER]);
    sysA = (await createSystem('מערכת א׳')).id;
    rankA = (await createRank('דרג א׳')).id;
    rankB = (await createRank('דרג ב׳')).id;
  });

  it('computes expiry = issued + validity months (no hard-coded year)', async () => {
    await setCertification(perf.id, sysA, rankB, admin, { issuedAt: '2026-10-15', validityMonths: 12 });
    const cert = await getCertRow(perf.id, sysA);
    expect(cert!.expires_at).toBe('2027-10-15');
    // A different validity period changes the date accordingly.
    await setCertification(perf.id, sysA, rankB, admin, { issuedAt: '2026-10-15', validityMonths: 24 });
    expect((await getCertRow(perf.id, sysA))!.expires_at).toBe('2028-10-15');
  });

  it('an expired certification cannot be used for new work (business layer)', async () => {
    // issued in the far past, 12-month validity → long expired
    await setCertification(perf.id, sysA, rankB, admin, { issuedAt: '2020-01-01', validityMonths: 12 });
    expect(certStatus(await getCertRow(perf.id, sysA))).toBe('expired');
    expect(await isUserCertified(perf.id, sysA, rankA)).toBe(false);
    // a valid cert works
    await setCertification(perf.id, sysA, rankB, admin, { issuedAt: todayStr(), validityMonths: 12 });
    expect(await isUserCertified(perf.id, sysA, rankA)).toBe(true);
  });

  it('an expired performer is excluded from the מבצע 2 / repair picker', async () => {
    await setCertification(perf.id, sysA, rankB, admin, { issuedAt: todayStr(), validityMonths: 12 });
    await setCertification(perf2.id, sysA, rankB, admin, { issuedAt: '2020-01-01', validityMonths: 12 }); // expired
    const list = await listCertifiedPerformerUsers(sysA, rankA);
    expect(list.map((u) => u.id)).toContain(perf.id);
    expect(list.map((u) => u.id)).not.toContain(perf2.id);
  });

  it('renewal clears the alert and returns the cert to valid', async () => {
    // expires soon → needs_renewal (issued ~11 months ago, 12mo validity)
    const issued = addMonths(todayStr(), -11);
    await setCertification(perf.id, sysA, rankB, admin, { issuedAt: issued, validityMonths: 12 });
    expect(certStatus(await getCertRow(perf.id, sysA))).toBe('needs_renewal');
    let alerts = await listAlertsForUser(perf.id);
    expect(alerts).toHaveLength(1);

    await renewCertification(perf.id, sysA, todayStr(), admin);
    expect(certStatus(await getCertRow(perf.id, sysA))).toBe('valid');
    alerts = await listAlertsForUser(perf.id);
    expect(alerts).toHaveLength(0);
  });

  it('dashboard summary counts valid / needs-renewal / expired', async () => {
    await setCertification(perf.id, sysA, rankB, admin, { issuedAt: todayStr(), validityMonths: 12 }); // valid
    await setCertification(perf2.id, sysA, rankB, admin, { issuedAt: addMonths(todayStr(), -11), validityMonths: 12 }); // needs_renewal
    const extra = await makeUser('x', 'יוסי', [RoleName.PERFORMER]);
    await setCertification(extra.id, sysA, rankA, admin, { issuedAt: '2020-01-01', validityMonths: 12 }); // expired
    const s = await certificationSummary();
    expect(s.total).toBe(3);
    expect(s.valid).toBe(1);
    expect(s.needsRenewal).toBe(1);
    expect(s.expired).toBe(1);
  });

  it('changing a certification is audited with before/after and never erased', async () => {
    await setCertification(perf.id, sysA, rankA, admin, { issuedAt: '2026-01-01', validityMonths: 12 });
    await setCertification(perf.id, sysA, rankB, admin, { issuedAt: '2026-06-01', validityMonths: 12 });
    const { listAudit } = await import('@/services/audit');
    const audit = await listAudit();
    const certEvents = audit.filter((e) => e.entity_type === 'user_system_rank');
    expect(certEvents.some((e) => e.action === 'CERT_ADD')).toBe(true);
    expect(certEvents.some((e) => e.action === 'CERT_UPDATE')).toBe(true);
    const upd = certEvents.find((e) => e.action === 'CERT_UPDATE')!;
    expect(upd.old_value).toContain('exp=2027-01-01');
    expect(upd.new_value).toContain('exp=2027-06-01');
  });
});
