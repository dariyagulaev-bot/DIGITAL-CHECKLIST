import { db } from '@/data/db';
import { nowIso } from './ids';
import { logAudit } from './audit';
import { getTemplate, getTemplateTasks } from './templates';
import { getEffectiveBlocks } from './blocks';
import { equipmentItemsOf } from '@/exports/labels';
import type {
  CheckRefConfig,
  PublishedBlock,
  PublishedCheckConfig,
  SectionConfig,
  TableConfig,
  TextConfig,
} from '@/types';

/**
 * Draft → Preview → Publish for templates. The admin edits a DRAFT (the live
 * template_blocks); only Publish freezes the current content into a versioned
 * `published` snapshot that NEW forms are built from. Existing forms keep their
 * own creation-time snapshot and never change. Fully offline.
 */

/** Assemble the current DRAFT content as self-contained published blocks. */
export async function buildDraftContent(templateId: string): Promise<PublishedBlock[]> {
  const blocks = await getEffectiveBlocks(templateId);
  const tasks = await getTemplateTasks(templateId);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const out: PublishedBlock[] = [];
  blocks.forEach((b, i) => {
    if (b.type === 'check') {
      const t = taskMap.get((b.config as CheckRefConfig).task_id);
      if (!t) return;
      const cfg: PublishedCheckConfig = {
        part_name: t.part_name,
        action: t.action,
        equipment: t.equipment,
        equipment_items: equipmentItemsOf(t.equipment_items, t.equipment),
        image_data: t.image_data,
      };
      out.push({ type: 'check', sort_order: i, config: cfg });
    } else {
      out.push({ type: b.type, sort_order: i, config: JSON.parse(JSON.stringify(b.config)) });
    }
  });
  return out;
}

/**
 * Pre-publish validation (part 28). Returns a list of human-readable problems;
 * an empty list means the template may be published.
 */
export async function validateTemplate(templateId: string): Promise<string[]> {
  const errors: string[] = [];
  const content = await buildDraftContent(templateId);
  if (content.length === 0) {
    errors.push('הבד״ח ריק — יש להוסיף לפחות רכיב אחד.');
    return errors;
  }
  let tableNo = 0;
  for (const b of content) {
    if (b.type === 'check') {
      const c = b.config as PublishedCheckConfig;
      if (!c.part_name.trim() || !c.action.trim()) errors.push('קיים סעיף בדיקה ללא שם אזור או פעולה.');
    } else if (b.type === 'section') {
      if (!(b.config as SectionConfig).title?.trim()) errors.push('קיימת כותרת ריקה.');
    } else if (b.type === 'text') {
      if (!(b.config as TextConfig).text?.trim()) errors.push('קיימת הוראה/טקסט ריקים.');
    } else if (b.type === 'table') {
      tableNo += 1;
      const c = b.config as TableConfig;
      const name = c.title?.trim() || `טבלה ${tableNo}`;
      if (!c.title?.trim()) errors.push(`לטבלה ${tableNo} חסר שם.`);
      if (!c.columns?.length || !c.rows?.length) errors.push(`לטבלה "${name}" חסר מבנה תקין (שורות/עמודות).`);
      const colIds = new Set<string>();
      const rowIds = new Set<string>();
      for (const col of c.columns ?? []) {
        if (!col.label.trim()) errors.push(`בטבלה "${name}" קיימת עמודה ללא שם.`);
        if (colIds.has(col.id)) errors.push(`בטבלה "${name}" קיימים מזהי עמודות כפולים.`);
        colIds.add(col.id);
        if ((col.field_type === 'select' || col.field_type === 'multiselect') && !(col.options ?? []).filter(Boolean).length)
          errors.push(`בטבלה "${name}" לעמודה "${col.label}" מסוג בחירה חסרות אפשרויות.`);
      }
      for (const row of c.rows ?? []) {
        if (rowIds.has(row.id)) errors.push(`בטבלה "${name}" קיימים מזהי שורות כפולים.`);
        rowIds.add(row.id);
      }
      for (const rule of c.rules ?? []) {
        if (!(rule.allowed_difference >= 0) || !Number.isFinite(rule.allowed_difference))
          errors.push(`בטבלה "${name}" קיים חוק מדידה עם פער לא חוקי.`);
        const refs = [rule.initial, rule.final];
        for (const ref of refs) {
          if (!rowIds.has(ref.row_id) || !colIds.has(ref.col_id))
            errors.push(`בטבלה "${name}" חוק מדידה מפנה לשדה שנמחק.`);
        }
      }
    }
  }
  // De-duplicate identical messages.
  return [...new Set(errors)];
}

function nextVersion(prev: string | undefined, bump: 'minor' | 'major'): string {
  if (!prev) return '1.0';
  const [maj, min] = prev.split('.').map((n) => Number(n) || 0);
  return bump === 'major' ? `${maj + 1}.0` : `${maj}.${min + 1}`;
}

export interface PublishOptions {
  bump?: 'minor' | 'major';
  summary?: string;
}

/**
 * Publish the current draft as a new version. Validates first (throws if the
 * template is not publishable), freezes the content, bumps the version, records
 * who/when (+ optional change summary) and audits. Does NOT touch existing
 * forms — they keep their own snapshot.
 */
export async function publishTemplate(
  templateId: string,
  admin: { id: string; full_name: string },
  opts: PublishOptions = {}
): Promise<string> {
  const errors = await validateTemplate(templateId);
  if (errors.length) throw new Error('לא ניתן לפרסם — יש לתקן:\n• ' + errors.join('\n• '));
  const t = await getTemplate(templateId);
  if (!t) throw new Error('התבנית לא נמצאה');
  const blocks = await buildDraftContent(templateId);
  const version = nextVersion(t.published?.version, opts.bump ?? 'minor');
  const now = nowIso();
  const entry = {
    version,
    published_at: now,
    published_by_id: admin.id,
    published_by_name: admin.full_name,
    change_summary: opts.summary?.trim() || undefined,
  };
  await db.templates.update(templateId, {
    published: { ...entry, blocks },
    ever_published: true,
    has_unpublished_changes: false,
    version_history: [...(t.version_history ?? []), entry],
    version: (t.version ?? 1) + 1,
    updated_at: now,
  });
  await logAudit({
    user_id: admin.id,
    user_name: admin.full_name,
    action: 'PUBLISH_TEMPLATE',
    entity_type: 'template',
    entity_id: templateId,
    new_value: version,
    reason: opts.summary?.trim() || undefined,
  });
  return version;
}

/** Mark a template as having unpublished draft changes (called on every edit). */
export async function markTemplateDirty(templateId: string): Promise<void> {
  await db.templates.update(templateId, { has_unpublished_changes: true, updated_at: nowIso() });
}
