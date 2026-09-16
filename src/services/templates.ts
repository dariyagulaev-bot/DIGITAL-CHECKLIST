import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { ensureDefaultSystem } from './systems';
import { ensureDefaultRank } from './ranks';
import { equipmentItemsOf } from '@/exports/labels';
import type { Template, TemplateTask } from '@/types';

/** Normalize equipment input into a clean list + a joined legacy string. */
function normalizeEquipment(items?: string[], text?: string): { items: string[]; text: string } {
  const list = equipmentItemsOf(items, text);
  return { items: list, text: list.join(', ') };
}

/** Bump a template's version + updated_at whenever its structure changes. */
async function touchTemplate(templateId: string): Promise<void> {
  const t = await db.templates.get(templateId);
  await db.templates.update(templateId, {
    updated_at: nowIso(),
    version: (t?.version ?? 1) + 1,
  });
}

export async function listTemplatesBy(
  systemId: string,
  rankId: string,
  includeInactive = false
): Promise<Template[]> {
  const all = await db.templates.where('system_id').equals(systemId).toArray();
  return all
    .filter((t) => t.rank_id === rankId && (includeInactive || t.active))
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

/**
 * Template management. Templates (בד״חים) are data-driven (never hard-coded),
 * belong to a system (מערכת), and are fully managed by the admin.
 */

export async function listTemplates(includeInactive = false): Promise<Template[]> {
  const all = await db.templates.toArray();
  const filtered = includeInactive ? all : all.filter((t) => t.active);
  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

/** Templates belonging to a given system. */
export async function listTemplatesBySystem(
  systemId: string,
  includeInactive = false
): Promise<Template[]> {
  const all = await db.templates.where('system_id').equals(systemId).toArray();
  const filtered = includeInactive ? all : all.filter((t) => t.active);
  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  return db.templates.get(id);
}

export async function getTemplateTasks(templateId: string): Promise<TemplateTask[]> {
  const tasks = await db.template_tasks.where('template_id').equals(templateId).toArray();
  return tasks.sort((a, b) => a.sort_order - b.sort_order);
}

export async function createTemplate(params: {
  name: string;
  description?: string;
  active?: boolean;
  system_id?: string;
  /** Explicit `null` means "applies to all ranks"; omit to default to the first rank. */
  rank_id?: string | null;
}): Promise<Template> {
  const systemId = params.system_id ?? (await ensureDefaultSystem());
  const rankId = params.rank_id === undefined ? await ensureDefaultRank() : params.rank_id;
  const t: Template = {
    id: newId(),
    system_id: systemId,
    rank_id: rankId,
    name: params.name.trim(),
    description: (params.description ?? '').trim(),
    active: params.active ?? true,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.templates.add(t);
  return t;
}

export async function updateTemplate(
  id: string,
  patch: Partial<Pick<Template, 'name' | 'description' | 'active' | 'system_id' | 'rank_id'>>
): Promise<void> {
  await db.templates.update(id, { ...patch, updated_at: nowIso() });
}

export async function setTemplateActive(id: string, active: boolean): Promise<void> {
  await db.templates.update(id, { active, updated_at: nowIso() });
}

export async function deleteTemplate(id: string): Promise<void> {
  const tasks = await db.template_tasks.where('template_id').equals(id).toArray();
  await db.template_tasks.bulkDelete(tasks.map((t) => t.id));
  await db.templates.delete(id);
}

/** Deep-duplicate a template and all its tasks. */
export async function duplicateTemplate(id: string): Promise<Template> {
  const src = await db.templates.get(id);
  if (!src) throw new Error('התבנית לא נמצאה');
  const tasks = await getTemplateTasks(id);
  const copy: Template = {
    ...src,
    id: newId(),
    name: `${src.name} (העתק)`,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.templates.add(copy);
  const taskCopies: TemplateTask[] = tasks.map((t) => ({
    ...t,
    id: newId(),
    template_id: copy.id,
  }));
  if (taskCopies.length) await db.template_tasks.bulkAdd(taskCopies);
  return copy;
}

export async function addTask(
  templateId: string,
  params: {
    part_name: string;
    action: string;
    equipment?: string;
    equipment_items?: string[];
    image_data?: string | null;
  }
): Promise<TemplateTask> {
  const existing = await getTemplateTasks(templateId);
  const eq = normalizeEquipment(params.equipment_items, params.equipment);
  const task: TemplateTask = {
    id: newId(),
    template_id: templateId,
    part_name: params.part_name.trim(),
    action: params.action.trim(),
    equipment: eq.text,
    equipment_items: eq.items,
    image_data: params.image_data ?? null,
    sort_order: existing.length,
  };
  await db.template_tasks.add(task);
  await touchTemplate(templateId);
  return task;
}

export async function updateTask(
  taskId: string,
  patch: Partial<
    Pick<TemplateTask, 'part_name' | 'action' | 'equipment' | 'equipment_items' | 'image_data'>
  >
): Promise<void> {
  // When equipment is edited, keep the list and the legacy joined string in sync.
  const finalPatch: Partial<TemplateTask> = { ...patch };
  if (patch.equipment_items !== undefined || patch.equipment !== undefined) {
    const eq = normalizeEquipment(patch.equipment_items, patch.equipment);
    finalPatch.equipment_items = eq.items;
    finalPatch.equipment = eq.text;
  }
  await db.template_tasks.update(taskId, finalPatch);
  const task = await db.template_tasks.get(taskId);
  if (task) await touchTemplate(task.template_id);
}

export async function deleteTask(taskId: string): Promise<void> {
  const task = await db.template_tasks.get(taskId);
  await db.template_tasks.delete(taskId);
  if (task) {
    // Re-pack sort_order to stay contiguous.
    const rest = await getTemplateTasks(task.template_id);
    await Promise.all(rest.map((t, i) => db.template_tasks.update(t.id, { sort_order: i })));
    await touchTemplate(task.template_id);
  }
}

/** Persist a new ordering (array of task ids in desired order). */
export async function reorderTasks(templateId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) => db.template_tasks.update(id, { sort_order: index }))
  );
  await touchTemplate(templateId);
}

/** Move a task up or down by one position. */
export async function moveTask(taskId: string, direction: 'up' | 'down'): Promise<void> {
  const task = await db.template_tasks.get(taskId);
  if (!task) return;
  const tasks = await getTemplateTasks(task.template_id);
  const idx = tasks.findIndex((t) => t.id === taskId);
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= tasks.length) return;
  const ids = tasks.map((t) => t.id);
  [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
  await reorderTasks(task.template_id, ids);
}
