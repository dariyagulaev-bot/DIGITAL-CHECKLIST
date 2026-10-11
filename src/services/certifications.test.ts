import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, ensureRoles, makeUser } from '@/test/helpers';
import { RoleName, type UserWithRoles } from '@/types';
import { createSystem } from '@/services/systems';
import { createRank } from '@/services/ranks';
import { createTemplate, addTask } from '@/services/templates';
import {
  setCertification,
  isUserCertified,
  allowedRankIds,
  getMaxRankId,
  listCertifiedPerformerUsers,
  certifiedSystemIds,
} from '@/services/certifications';
import { createDraftForm, updateFormMeta, getForm } from '@/services/forms';

describe('user certifications (הסמכות) — hierarchy, gating, history', () => {
  let admin: UserWithRoles;
  let perf: UserWithRoles;
  let perf2: UserWithRoles;
  let perf3: UserWithRoles;
  let sysA: string;
  let sysB: string;
  let rankA: string;
  let rankB: string;
  let rankD: string;
  let tplA_rankA: string;
  let tplA_rankD: string;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    admin = await makeUser('admin', 'מנהל', [RoleName.ADMIN]);
    perf = await makeUser('perf', 'ישראל', [RoleName.PERFORMER]);
    perf2 = await makeUser('perf2', 'דני', [RoleName.PERFORMER]);
    perf3 = await makeUser('perf3', 'יוסי', [RoleName.PERFORMER]);
    sysA = (await createSystem('מערכת א׳')).id;
    sysB = (await createSystem('מערכת ב׳')).id;
    rankA = (await createRank('דרג א׳')).id; // sort 0
    rankB = (await createRank('דרג ב׳')).id; // sort 1
    rankD = (await createRank('דרג ד׳')).id; // sort 2
    tplA_rankA = (await createTemplate({ name: 'בדיקה א', system_id: sysA, rank_id: rankA })).id;
    tplA_rankD = (await createTemplate({ name: 'בדיקה ד', system_id: sysA, rank_id: rankD })).id;
    await addTask(tplA_rankA, { part_name: 'x', action: 'y', equipment: '' });
    await addTask(tplA_rankD, { part_name: 'x', action: 'y', equipment: '' });
  });

  it('hierarchy: a max rank covers every rank below it', () => {
    const ranks = [
      { id: rankA, sort_order: 0 },
      { id: rankB, sort_order: 1 },
      { id: rankD, sort_order: 2 },
    ];
    expect(allowedRankIds(rankD, ranks)).toEqual(new Set([rankA, rankB, rankD]));
    expect(allowedRankIds(rankB, ranks)).toEqual(new Set([rankA, rankB]));
    expect(allowedRankIds(rankA, ranks)).toEqual(new Set([rankA]));
    expect(allowedRankIds(null, ranks)).toEqual(new Set());
  });

  it('setCertification stores the max rank and derives access; null = ללא הסמכה', async () => {
    await setCertification(perf.id, sysA, rankB, admin);
    expect(await getMaxRankId(perf.id, sysA)).toBe(rankB);
    expect(await isUserCertified(perf.id, sysA, rankA)).toBe(true);
    expect(await isUserCertified(perf.id, sysA, rankB)).toBe(true);
    expect(await isUserCertified(perf.id, sysA, rankD)).toBe(false); // above max
    expect(await isUserCertified(perf.id, sysB, rankA)).toBe(false); // no cert for B
    expect([...(await certifiedSystemIds(perf.id))]).toEqual([sysA]);

    await setCertification(perf.id, sysA, null, admin);
    expect(await getMaxRankId(perf.id, sysA)).toBe(null);
    expect(await isUserCertified(perf.id, sysA, rankA)).toBe(false);
  });

  it('createDraftForm is enforced in the business layer (not just UI)', async () => {
    await expect(createDraftForm({ templateId: tplA_rankD, performer: perf })).rejects.toThrow(/מוסמך/);
    await setCertification(perf.id, sysA, rankB, admin);
    // still cannot run rank ד (above the certified max ב)
    await expect(createDraftForm({ templateId: tplA_rankD, performer: perf })).rejects.toThrow(/מוסמך/);
    // can run rank א
    const id = await createDraftForm({ templateId: tplA_rankA, performer: perf });
    expect(id).toBeTruthy();
  });

  it('admins are exempt from certification gating', async () => {
    const id = await createDraftForm({ templateId: tplA_rankD, performer: admin });
    expect(id).toBeTruthy();
  });

  it('performer-2 must be an active, certified performer and not performer 1', async () => {
    await setCertification(perf.id, sysA, rankB, admin);
    await setCertification(perf3.id, sysA, rankA, admin);
    const formId = await createDraftForm({ templateId: tplA_rankA, performer: perf }); // rank א
    // perf3 is certified to rank א → allowed on a rank-א form
    await updateFormMeta(formId, perf.id, { performer2_id: perf3.id, performer2_name: 'יוסי' });
    expect((await getForm(formId))!.performer2_id).toBe(perf3.id);
    // cannot pick performer 1 as performer 2
    await expect(
      updateFormMeta(formId, perf.id, { performer2_id: perf.id, performer2_name: 'ישראל' })
    ).rejects.toThrow();
    // an uncertified user cannot be performer 2 (perf2 has no cert)
    await expect(
      updateFormMeta(formId, perf.id, { performer2_id: perf2.id, performer2_name: 'דני' })
    ).rejects.toThrow(/מוסמך/);
  });

  it('performer-2 picker lists only certified performers for the form rank', async () => {
    await setCertification(perf.id, sysA, rankD, admin);
    await setCertification(perf2.id, sysA, rankB, admin); // up to ב
    await setCertification(perf3.id, sysA, rankA, admin); // up to א
    const forD = await listCertifiedPerformerUsers(sysA, rankD, perf.id);
    expect(forD.map((u) => u.id)).toEqual([]); // nobody else is certified to ד
    const forA = await listCertifiedPerformerUsers(sysA, rankA, perf.id);
    expect(forA.map((u) => u.id).sort()).toEqual([perf2.id, perf3.id].sort());
  });

  it('changing a certification never alters an already-created בד״ח (history)', async () => {
    await setCertification(perf.id, sysA, rankB, admin);
    const id = await createDraftForm({ templateId: tplA_rankA, performer: perf });
    const before = await getForm(id);
    await setCertification(perf.id, sysA, null, admin); // revoke afterwards
    const after = await getForm(id);
    expect(after!.rank_name_snapshot).toBe(before!.rank_name_snapshot);
    expect(after!.system_name_snapshot).toBe(before!.system_name_snapshot);
    expect(after!.status).toBe(before!.status);
  });
});
