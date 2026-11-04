import { db } from '@/data/db';
import { nowIso } from './ids';
import { markTemplateDirty } from './publish';
import { defaultStages, type Stage } from '@/types';

/**
 * Work-stage management for a בד״ח template (e.g. "לפני הכנה" / "אחרי הכנה").
 *
 * Stages live on the template row (`template.stages`, `template.uses_stages`).
 * The display `name` is admin-editable; the `id` is a STABLE key (stage_1, …) so
 * renaming never breaks existing data. All edits mark the template as having
 * unpublished changes — the names are frozen only on Publish (new version).
 *
 * Fully additive: a template with `uses_stages` off behaves exactly as before.
 */

function sortStages(stages: Stage[]): Stage[] {
  return [...stages].sort((a, b) => a.sort_order - b.sort_order);
}

/** Current draft stages (sorted). */
export async function getStages(templateId: string): Promise<Stage[]> {
  const t = await db.templates.get(templateId);
  return sortStages(t?.stages ?? []);
}

/** Only the stages a performer actually sees (active), in order. */
export async function getActiveStages(templateId: string): Promise<Stage[]> {
  return (await getStages(templateId)).filter((s) => s.active);
}

/** The next stable stage id, never reusing a number while it exists. */
function nextStageId(stages: Stage[]): string {
  let max = 0;
  for (const s of stages) {
    const m = /^stage_(\d+)$/.exec(s.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `stage_${max + 1}`;
}

async function saveStages(templateId: string, stages: Stage[]): Promise<void> {
  await db.templates.update(templateId, { stages, updated_at: nowIso() });
  await markTemplateDirty(templateId);
}

/**
 * Turn work-stages on or off for a template. Turning it on for the first time
 * seeds the default "לפני / אחרי" split (names are editable afterwards).
 */
export async function setUsesStages(templateId: string, on: boolean): Promise<Stage[]> {
  const t = await db.templates.get(templateId);
  if (!t) throw new Error('התבנית לא נמצאה');
  let stages = t.stages ?? [];
  if (on && stages.length === 0) stages = defaultStages();
  await db.templates.update(templateId, { uses_stages: on, stages, updated_at: nowIso() });
  await markTemplateDirty(templateId);
  return sortStages(stages);
}

/** Add a new empty stage at the end. */
export async function addStage(templateId: string, name?: string): Promise<Stage> {
  const stages = await getStages(templateId);
  const stage: Stage = {
    id: nextStageId(stages),
    name: name?.trim() || `שלב ${stages.length + 1}`,
    active: true,
    sort_order: stages.length,
  };
  await saveStages(templateId, [...stages, stage]);
  return stage;
}

/** Rename a stage (display name only — the id never changes). */
export async function renameStage(templateId: string, stageId: string, name: string): Promise<void> {
  const stages = await getStages(templateId);
  await saveStages(
    templateId,
    stages.map((s) => (s.id === stageId ? { ...s, name } : s))
  );
}

/** Enable / disable a stage. A disabled stage is hidden from the performer. */
export async function setStageActive(templateId: string, stageId: string, active: boolean): Promise<void> {
  const stages = await getStages(templateId);
  await saveStages(
    templateId,
    stages.map((s) => (s.id === stageId ? { ...s, active } : s))
  );
}

/**
 * Remove a phase option. Historical/archived forms are untouched — each carries
 * its own frozen phase name snapshot.
 */
export async function removeStage(templateId: string, stageId: string): Promise<void> {
  const stages = (await getStages(templateId)).filter((s) => s.id !== stageId);
  stages.forEach((s, i) => (s.sort_order = i)); // re-pack 0..n-1
  await db.templates.update(templateId, { stages, updated_at: nowIso() });
  await markTemplateDirty(templateId);
}

/** Reorder stages by a list of ids. */
export async function reorderStages(templateId: string, orderedIds: string[]): Promise<void> {
  const stages = await getStages(templateId);
  const byId = new Map(stages.map((s) => [s.id, s]));
  const next: Stage[] = [];
  orderedIds.forEach((id, i) => {
    const s = byId.get(id);
    if (s) next.push({ ...s, sort_order: i });
  });
  // Keep any stage not listed (defensive) at the end.
  stages.filter((s) => !orderedIds.includes(s.id)).forEach((s) => next.push({ ...s, sort_order: next.length }));
  await saveStages(templateId, next);
}
