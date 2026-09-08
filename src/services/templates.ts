import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import type { Template, TemplateTask } from '@/types';

/**
 * Template management. Templates are data-driven (never hard-coded) and
 * fully managed by the admin: create, edit, duplicate, deactivate, reorder.
 */

export async function listTemplates(includeInactive = false): Promise<Template[]> {
  const all = await db.templates.toArray();
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
}): Promise<Template> {
  const t: Template = {
    id: newId(),
    name: params.name.trim(),
    description: (params.description ?? '').trim(),
    active: params.active ?? true,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.templates.add(t);
  return t;
}

export async function updateTemplate(
  id: string,
  patch: Partial<Pick<Template, 'name' | 'description' | 'active'>>
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
  params: { part_name: string; action: string; equipment: string; image_data?: string | null }
): Promise<TemplateTask> {
  const existing = await getTemplateTasks(templateId);
  const task: TemplateTask = {
    id: newId(),
    template_id: templateId,
    part_name: params.part_name.trim(),
    action: params.action.trim(),
    equipment: params.equipment.trim(),
    image_data: params.image_data ?? null,
    sort_order: existing.length,
  };
  await db.template_tasks.add(task);
  await db.templates.update(templateId, { updated_at: nowIso() });
  return task;
}

export async function updateTask(
  taskId: string,
  patch: Partial<Pick<TemplateTask, 'part_name' | 'action' | 'equipment' | 'image_data'>>
): Promise<void> {
  await db.template_tasks.update(taskId, patch);
  const task = await db.template_tasks.get(taskId);
  if (task) await db.templates.update(task.template_id, { updated_at: nowIso() });
}

export async function deleteTask(taskId: string): Promise<void> {
  const task = await db.template_tasks.get(taskId);
  await db.template_tasks.delete(taskId);
  if (task) {
    // Re-pack sort_order to stay contiguous.
    const rest = await getTemplateTasks(task.template_id);
    await Promise.all(rest.map((t, i) => db.template_tasks.update(t.id, { sort_order: i })));
    await db.templates.update(task.template_id, { updated_at: nowIso() });
  }
}

/** Persist a new ordering (array of task ids in desired order). */
export async function reorderTasks(templateId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) => db.template_tasks.update(id, { sort_order: index }))
  );
  await db.templates.update(templateId, { updated_at: nowIso() });
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
