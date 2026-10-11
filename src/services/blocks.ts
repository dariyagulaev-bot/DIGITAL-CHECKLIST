import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { getTemplateTasks, addTask, deleteTask } from './templates';
import type {
  BlockConfig,
  BlockType,
  CheckRefConfig,
  EquipmentConfig,
  ImageConfig,
  SectionConfig,
  TableColumn,
  TableConfig,
  TableRow,
  TemplateBlock,
  TextConfig,
} from '@/types';

/**
 * Template BLOCK layer (Dynamic Checklist Builder). A template is an ordered
 * list of blocks. 'check' blocks reference a classic `template_tasks` row (so
 * the whole inspection pipeline is unchanged); other block types carry their
 * own config. Everything here is offline / local DB only.
 */

export async function getTemplateBlocks(templateId: string): Promise<TemplateBlock[]> {
  const blocks = await db.template_blocks.where('template_id').equals(templateId).toArray();
  return blocks.sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * The effective ordered blocks for a template: the persisted blocks if any,
 * otherwise a derived (non-persisted) list of check blocks built from the
 * legacy template_tasks. This keeps templates created via the old API (seed /
 * tests / pre-v10 data not yet opened in the editor) working seamlessly.
 */
export async function getEffectiveBlocks(templateId: string): Promise<TemplateBlock[]> {
  const blocks = await getTemplateBlocks(templateId);
  if (blocks.length) return blocks;
  const tasks = await getTemplateTasks(templateId);
  const now = nowIso();
  return tasks.map((t, i) => ({
    id: `derived-${t.id}`,
    template_id: templateId,
    type: 'check' as const,
    sort_order: i,
    config: { task_id: t.id } as CheckRefConfig,
    created_at: now,
    updated_at: now,
  }));
}

/**
 * Ensure a template has a persisted block list. If it has none but has legacy
 * tasks, create one check block per task (idempotent). Called when the editor
 * opens a legacy template so it can be edited as blocks.
 */
export async function ensureBlocks(templateId: string): Promise<void> {
  const existing = await getTemplateBlocks(templateId);
  if (existing.length) return;
  const tasks = await getTemplateTasks(templateId);
  if (!tasks.length) return;
  const now = nowIso();
  const blocks: TemplateBlock[] = tasks.map((t, i) => ({
    id: newId(),
    template_id: templateId,
    type: 'check',
    sort_order: i,
    config: { task_id: t.id },
    created_at: now,
    updated_at: now,
  }));
  await db.template_blocks.bulkAdd(blocks);
}

// ---- Default configs for each block type --------------------------------

export function defaultColumn(label = 'עמודה'): TableColumn {
  return { id: newId(), label, field_type: 'short_text', required: false };
}
export function defaultRow(label = 'שורה'): TableRow {
  return { id: newId(), label };
}
export function defaultTableConfig(): TableConfig {
  return {
    title: 'טבלת מדידה',
    description: '',
    required: false,
    duration_label: '',
    columns: [
      { id: newId(), label: 'ערך', field_type: 'number', required: false, unit: '' },
      { id: newId(), label: 'שעה', field_type: 'time', required: false },
    ],
    rows: [defaultRow('תחילת בדיקה'), defaultRow('סיום בדיקה')],
    rules: [],
    show_in_execution: true,
    show_in_pdf: true,
  };
}
function defaultConfig(type: BlockType): BlockConfig {
  switch (type) {
    case 'section':
      return { title: 'כותרת חדשה' } as SectionConfig;
    case 'text':
      return { text: '' } as TextConfig;
    case 'table':
      return defaultTableConfig();
    case 'image':
      return { image_data: null, title: '', description: '', show_in_execution: true, show_in_pdf: true } as ImageConfig;
    case 'equipment':
      return { title: 'ציוד נדרש', items: [] } as EquipmentConfig;
    case 'divider':
      return {};
    default:
      return {};
  }
}

// ---- Block CRUD ----------------------------------------------------------

async function nextSort(templateId: string): Promise<number> {
  const blocks = await getTemplateBlocks(templateId);
  return blocks.length ? Math.max(...blocks.map((b) => b.sort_order)) + 1 : 0;
}

/** Append a new block of the given type (non-check). Returns the new block. */
export async function addBlock(
  templateId: string,
  type: Exclude<BlockType, 'check'>,
  config?: BlockConfig
): Promise<TemplateBlock> {
  await ensureBlocks(templateId);
  const now = nowIso();
  const block: TemplateBlock = {
    id: newId(),
    template_id: templateId,
    type,
    sort_order: await nextSort(templateId),
    config: config ?? defaultConfig(type),
    created_at: now,
    updated_at: now,
  };
  await db.template_blocks.add(block);
  return block;
}

/**
 * Append a check block, creating its backing template_task. Params mirror the
 * classic addTask so the check content (area/action/equipment/image) is stored
 * exactly as before.
 */
export async function addCheckBlock(
  templateId: string,
  params: { part_name: string; action: string; equipment_items?: string[]; image_data?: string | null }
): Promise<TemplateBlock> {
  await ensureBlocks(templateId);
  const task = await addTask(templateId, params);
  const now = nowIso();
  const block: TemplateBlock = {
    id: newId(),
    template_id: templateId,
    type: 'check',
    sort_order: await nextSort(templateId),
    config: { task_id: task.id },
    created_at: now,
    updated_at: now,
  };
  await db.template_blocks.add(block);
  return block;
}

export async function updateBlockConfig(blockId: string, config: BlockConfig): Promise<void> {
  await db.template_blocks.update(blockId, { config, updated_at: nowIso() });
}

/** Delete a block. For a check block, also delete its backing task. */
export async function deleteBlock(blockId: string): Promise<void> {
  const block = await db.template_blocks.get(blockId);
  if (!block) return;
  if (block.type === 'check') {
    const taskId = (block.config as CheckRefConfig).task_id;
    if (taskId) await deleteTask(taskId).catch(() => {});
  }
  await db.template_blocks.delete(blockId);
  // Re-pack sort_order.
  const rest = await getTemplateBlocks(block.template_id);
  await Promise.all(rest.map((b, i) => db.template_blocks.update(b.id, { sort_order: i })));
}

export async function reorderBlocks(templateId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) => db.template_blocks.update(id, { sort_order: i })));
}

export async function moveBlock(blockId: string, dir: 'up' | 'down'): Promise<void> {
  const block = await db.template_blocks.get(blockId);
  if (!block) return;
  const blocks = await getTemplateBlocks(block.template_id);
  const idx = blocks.findIndex((b) => b.id === blockId);
  const swap = dir === 'up' ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= blocks.length) return;
  const ids = blocks.map((b) => b.id);
  [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
  await reorderBlocks(block.template_id, ids);
}

/** Duplicate a block (deep copy). Check blocks also duplicate the backing task. */
export async function duplicateBlock(blockId: string): Promise<TemplateBlock> {
  const block = await db.template_blocks.get(blockId);
  if (!block) throw new Error('הרכיב לא נמצא');
  const now = nowIso();
  let config: BlockConfig = JSON.parse(JSON.stringify(block.config));
  if (block.type === 'check') {
    const srcTaskId = (block.config as CheckRefConfig).task_id;
    const srcTask = srcTaskId ? await db.template_tasks.get(srcTaskId) : undefined;
    if (srcTask) {
      const copy = await addTask(block.template_id, {
        part_name: srcTask.part_name,
        action: srcTask.action,
        equipment_items: srcTask.equipment_items ?? [],
        image_data: srcTask.image_data,
      });
      config = { task_id: copy.id };
    }
  } else if (block.type === 'table') {
    config = cloneTableConfigWithNewIds(config as TableConfig);
  }
  // Insert right after the source block.
  const blocks = await getTemplateBlocks(block.template_id);
  const dup: TemplateBlock = {
    id: newId(),
    template_id: block.template_id,
    type: block.type,
    sort_order: block.sort_order + 0.5,
    config,
    created_at: now,
    updated_at: now,
  };
  await db.template_blocks.add(dup);
  // Re-pack to integers preserving order.
  const reordered = [...blocks, dup].sort((a, b) => a.sort_order - b.sort_order);
  await Promise.all(reordered.map((b, i) => db.template_blocks.update(b.id, { sort_order: i })));
  return dup;
}

/** Fresh ids for table rows/columns/rules (keeps rule cell refs consistent). */
export function cloneTableConfigWithNewIds(cfg: TableConfig): TableConfig {
  const colMap = new Map<string, string>();
  const rowMap = new Map<string, string>();
  const columns = cfg.columns.map((c) => {
    const id = newId();
    colMap.set(c.id, id);
    return { ...c, id };
  });
  const rows = cfg.rows.map((r) => {
    const id = newId();
    rowMap.set(r.id, id);
    return { ...r, id };
  });
  const rules = (cfg.rules ?? []).map((rule) => ({
    ...rule,
    id: newId(),
    initial: { row_id: rowMap.get(rule.initial.row_id) ?? rule.initial.row_id, col_id: colMap.get(rule.initial.col_id) ?? rule.initial.col_id },
    final: { row_id: rowMap.get(rule.final.row_id) ?? rule.final.row_id, col_id: colMap.get(rule.final.col_id) ?? rule.final.col_id },
  }));
  return { ...cfg, columns, rows, rules };
}

/** Load a check block's backing task. */
export function checkTaskId(block: TemplateBlock): string | null {
  return block.type === 'check' ? (block.config as CheckRefConfig).task_id ?? null : null;
}
