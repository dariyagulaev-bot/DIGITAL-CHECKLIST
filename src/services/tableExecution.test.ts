import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, ensureRoles, makeUser, certifyAllSystems } from '@/test/helpers';
import { RoleName, type TableConfig, type UserWithRoles } from '@/types';
import { createTemplate, addTask } from '@/services/templates';
import { addBlock } from '@/services/blocks';
import { createDraftForm, getFormBundle, setBlockData, validateForSubmit } from '@/services/forms';

const SIG = 'data:image/png;base64,AAAA';

/** A measurement table: rows init/fin, one numeric column, a ±25 rule. */
function tableConfig(required = false): TableConfig {
  return {
    title: 'בדיקת נתוני עבודה',
    required,
    columns: [{ id: 'c_val', label: 'ערך', field_type: 'number', required, unit: '' }],
    rows: [
      { id: 'r_init', label: 'תחילת בדיקה' },
      { id: 'r_fin', label: 'סיום בדיקה' },
    ],
    rules: [
      {
        id: 'rule1',
        type: 'delta',
        initial: { row_id: 'r_init', col_id: 'c_val' },
        final: { row_id: 'r_fin', col_id: 'c_val' },
        allowed_difference: 25,
        fail_on_exceed: true,
      },
    ],
    show_in_execution: true,
    show_in_pdf: true,
  };
}

describe('measurement-table execution (Stage 5)', () => {
  let perf: UserWithRoles;
  let templateId: string;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    perf = await makeUser('perf', 'ישראל', [RoleName.PERFORMER]);
    const t = await createTemplate({ name: 'בד״ח מדידה' });
    await addTask(t.id, { part_name: 'מנוע', action: 'בדיקה', equipment: '' }); // one check
    await addBlock(t.id, 'table', tableConfig());
    templateId = t.id;
    await certifyAllSystems(perf.id);
  });

  it('creates a completed_block for the table and persists cell data + ±X results', async () => {
    const formId = await createDraftForm({ templateId, performer: perf });
    let bundle = await getFormBundle(formId);
    const tableBlk = bundle!.blocks.find((b) => b.type === 'table')!;
    expect(tableBlk).toBeTruthy();
    expect(tableBlk.config_snapshot).toMatchObject({ title: 'בדיקת נתוני עבודה' });

    // 100 → 50 exceeds ±25 → FAIL, and the SIGNED difference is kept.
    await setBlockData(formId, perf.id, tableBlk.id, {
      'r_init|c_val': '100',
      'r_fin|c_val': '50',
    });
    bundle = await getFormBundle(formId);
    const after = bundle!.blocks.find((b) => b.id === tableBlk.id)!;
    expect(after.data!.cells['r_fin|c_val']).toBe('50');
    const res = after.data!.results![0];
    expect(res.difference).toBe(-50);
    expect(res.passed).toBe(false);

    // Autosave survives a fresh read (simulates reopening the draft).
    const reread = await getFormBundle(formId);
    expect(reread!.blocks.find((b) => b.id === tableBlk.id)!.data!.cells['r_init|c_val']).toBe('100');

    // 100 → 90 is within ±25 → PASS.
    await setBlockData(formId, perf.id, tableBlk.id, {
      'r_init|c_val': '100',
      'r_fin|c_val': '90',
    });
    const ok = (await getFormBundle(formId))!.blocks.find((b) => b.id === tableBlk.id)!;
    expect(ok.data!.results![0].passed).toBe(true);
    expect(ok.data!.results![0].difference).toBe(-10);
  });

  it('a required table blocks submit until its cells are filled', async () => {
    // Rebuild the template with a REQUIRED table.
    const t = await createTemplate({ name: 'חובה' });
    await addTask(t.id, { part_name: 'a', action: 'b', equipment: '' });
    await addBlock(t.id, 'table', tableConfig(true));
    await certifyAllSystems(perf.id);
    const formId = await createDraftForm({ templateId: t.id, performer: perf });

    // Mark the check + both performers + signatures so only the table is missing.
    const bundle = await getFormBundle(formId);
    const { setTaskResult, addSignature, updateFormMeta } = await import('./forms');
    const { SignerType, TaskResult } = await import('@/types');
    const perf2 = await makeUser('perf2', 'דני', [RoleName.PERFORMER]);
    await certifyAllSystems(perf2.id);
    await setTaskResult(formId, perf.id, bundle!.tasks[0].id, TaskResult.OK);
    await addSignature({ formId, signer: perf, type: SignerType.PERFORMER, signatureData: SIG });
    await updateFormMeta(formId, perf.id, { performer2_id: perf2.id, performer2_name: perf2.full_name });
    await addSignature({ formId, signer: { id: perf2.id, full_name: perf2.full_name }, type: SignerType.PERFORMER2, signatureData: SIG });

    let v = await validateForSubmit(formId);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toContain('טבלה');

    // Fill the required cells → now valid.
    const tBlk = (await getFormBundle(formId))!.blocks.find((b) => b.type === 'table')!;
    await setBlockData(formId, perf.id, tBlk.id, { 'r_init|c_val': '10', 'r_fin|c_val': '12' });
    v = await validateForSubmit(formId);
    expect(v.ok).toBe(true);
  });
});
