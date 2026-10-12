import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, ensureRoles, makeUser, certifyAllSystems } from '@/test/helpers';
import { RoleName, type TableConfig, type UserWithRoles } from '@/types';
import { createTemplate, getTemplate } from '@/services/templates';
import { addBlock, addCheckBlock } from '@/services/blocks';
import { publishTemplate, validateTemplate } from '@/services/publish';
import { createDraftForm, getFormBundle } from '@/services/forms';

describe('template draft / publish / versioning', () => {
  let admin: UserWithRoles;
  let perf: UserWithRoles;
  let templateId: string;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    admin = await makeUser('admin', 'מנהל', [RoleName.ADMIN]);
    perf = await makeUser('perf', 'ישראל', [RoleName.PERFORMER]);
    const t = await createTemplate({ name: 'תבנית' });
    templateId = t.id;
    await addCheckBlock(templateId, { part_name: 'אזור A', action: 'בדיקה', equipment_items: [] });
    await certifyAllSystems(perf.id);
  });

  it('validateTemplate catches structural problems', async () => {
    // A select column without options + a rule pointing at a non-existent cell.
    const bad: TableConfig = {
      title: 'טבלה',
      columns: [{ id: 'c1', label: 'בחירה', field_type: 'select', options: [] }],
      rows: [{ id: 'r1', label: 'שורה' }],
      rules: [{ id: 'g', type: 'delta', initial: { row_id: 'r1', col_id: 'c1' }, final: { row_id: 'ghost', col_id: 'c1' }, allowed_difference: 5 }],
    };
    await addBlock(templateId, 'table', bad);
    const errs = await validateTemplate(templateId);
    expect(errs.join(' ')).toContain('אפשרויות');
    expect(errs.join(' ')).toContain('שדה שנמחק');
  });

  it('publishes a first version and marks the template usable', async () => {
    const v = await publishTemplate(templateId, admin);
    expect(v).toBe('1.0');
    const t = await getTemplate(templateId);
    expect(t!.ever_published).toBe(true);
    expect(t!.has_unpublished_changes).toBe(false);
    expect(t!.published!.blocks).toHaveLength(1);
    expect(t!.version_history).toHaveLength(1);
  });

  it('new forms use the PUBLISHED content; draft edits do not leak until re-publish', async () => {
    await publishTemplate(templateId, admin); // v1.0 with one check
    // Edit the draft: add a second check.
    await addCheckBlock(templateId, { part_name: 'אזור B', action: 'בדיקה', equipment_items: [] });
    expect((await getTemplate(templateId))!.has_unpublished_changes).toBe(true);

    // A new form still reflects the published (single-check) version.
    const f1 = await createDraftForm({ templateId, performer: perf });
    expect((await getFormBundle(f1))!.tasks).toHaveLength(1);

    // Re-publish → now new forms include both checks.
    const v2 = await publishTemplate(templateId, admin, { bump: 'minor' });
    expect(v2).toBe('1.1');
    const f2 = await createDraftForm({ templateId, performer: perf });
    expect((await getFormBundle(f2))!.tasks).toHaveLength(2);
    // The earlier form is unchanged.
    expect((await getFormBundle(f1))!.tasks).toHaveLength(1);
  });

  it('version bump: minor increments y, major increments x and resets y', async () => {
    expect(await publishTemplate(templateId, admin)).toBe('1.0');
    expect(await publishTemplate(templateId, admin, { bump: 'minor' })).toBe('1.1');
    expect(await publishTemplate(templateId, admin, { bump: 'major' })).toBe('2.0');
    expect(await publishTemplate(templateId, admin, { bump: 'minor' })).toBe('2.1');
  });
});
