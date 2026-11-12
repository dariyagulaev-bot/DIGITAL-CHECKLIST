import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { logAudit } from './audit';
import type {
  CertCanvasDesign,
  CertElement,
  CertificateActionType,
  CertificateTemplateRow,
} from '@/types';

/**
 * Versioned WYSIWYG certificate templates (A4 canvas). Each action type has ONE
 * editable DRAFT plus any number of PUBLISHED versions (history). Issuance uses
 * the latest published version and snapshots its design, so editing a template
 * never changes certificates already issued — a change becomes a new version
 * (1.0 → 1.1). Only ADMIN edits templates (enforced by the admin-only route and
 * audited here). Fully offline — images embedded, local fonts.
 */

// A4 portrait in millimetres.
export const A4 = { width: 210, height: 297 };

export const CERT_FONTS: { key: string; label: string; css: string }[] = [
  { key: 'heebo', label: 'Heebo (ברירת מחדל)', css: '"Heebo", Arial, sans-serif' },
  { key: 'serif', label: 'מסורתי (Serif)', css: 'Georgia, "Times New Roman", serif' },
  { key: 'sans', label: 'מודרני (Sans)', css: '"Segoe UI", Arial, sans-serif' },
  { key: 'rounded', label: 'מעוגל', css: '"Trebuchet MS", "Segoe UI", sans-serif' },
];
export function certFontCss(key?: string): string {
  return CERT_FONTS.find((f) => f.key === key)?.css ?? CERT_FONTS[0].css;
}

/** Dynamic field tokens available on the canvas. */
export const CERT_FIELD_TOKENS: { token: string; label: string }[] = [
  { token: '[שם מלא]', label: 'שם מלא' },
  { token: '[זיהוי]', label: 'זיהוי (סוג + מספר, אוטומטי)' },
  { token: '[סוג זיהוי]', label: 'סוג זיהוי' },
  { token: '[מספר אישי / ת"ז]', label: 'מספר אישי / ת״ז' },
  { token: '[מערכת]', label: 'מערכת' },
  { token: '[דרג]', label: 'דרג' },
  { token: '[סוג הסמכה]', label: 'סוג הסמכה' },
  { token: '[תאריך הסמכה]', label: 'תאריך הסמכה (לועזי)' },
  { token: '[תאריך עברי]', label: 'תאריך הסמכה (עברי)' },
  { token: '[תאריך לועזי]', label: 'תאריך לועזי' },
  { token: '[תוקף הסמכה]', label: 'תוקף (לועזי)' },
  { token: '[תוקף עברי]', label: 'תוקף (עברי)' },
  { token: '[שם המסמיך]', label: 'שם המסמיך' },
  { token: '[תפקיד המסמיך]', label: 'תפקיד המסמיך' },
  { token: '[מספר תעודה]', label: 'מספר תעודה' },
];

/** Tokens that reference the protected identity. */
export function designUsesIdentity(design: CertCanvasDesign): boolean {
  const idTokens = ['[מספר אישי / ת"ז]', '[סוג זיהוי]', '[זיהוי]', '[מספר זיהוי]'];
  return design.elements.some(
    (e) =>
      (e.field != null && idTokens.includes(e.field)) ||
      (!!e.text && idTokens.some((t) => e.text!.includes(t)))
  );
}

let zc = 0;
const mk = (e: Omit<CertElement, 'id' | 'z'> & { z?: number }): CertElement => ({
  id: newId(),
  z: e.z ?? zc++,
  ...e,
});

/**
 * The built-in default design — a clean, official A4 portrait document: white
 * background, thin frame, generous white space, no UI chrome. Separate wording
 * for initial vs renewal.
 */
export function defaultCanvasDesign(type: CertificateActionType): CertCanvasDesign {
  zc = 1;
  const isRenewal = type === 'renewal';
  const margin = 16;
  const contentW = A4.width - 2 * margin;
  const accent = '#1e3a8a';
  const ink = '#0f172a';
  const centered = {
    align: 'center' as const,
    valign: 'middle' as const,
    font_key: 'heebo',
    color: ink,
  };
  const elements: CertElement[] = [
    // Thin frame (safe area rectangle, no fill).
    mk({ type: 'rect', x: 8, y: 8, w: A4.width - 16, h: A4.height - 16, fill_color: null, border_color: accent, border_width: 0.4, z: 0 }),
    // Small VERO mark (toggleable object).
    mk({ type: 'text', x: margin, y: 14, w: contentW, h: 8, text: 'מערכת VERO', ...centered, color: '#64748b', font_size: 11 }),
    // Title.
    mk({ type: 'text', x: margin, y: 34, w: contentW, h: 16, text: isRenewal ? 'תעודת רענון הסמכה' : 'תעודת הסמכה', ...centered, color: accent, font_size: 30, bold: true }),
    // Subtitle.
    mk({ type: 'text', x: margin, y: 52, w: contentW, h: 8, text: 'בדיקות דיגיטליות', ...centered, color: '#475569', font_size: 13 }),
    // Divider.
    mk({ type: 'line', x: A4.width / 2 - 20, y: 66, w: 40, h: 0, line_color: accent, line_width: 0.8 }),
    // Grant line + name field.
    mk({ type: 'text', x: margin, y: 90, w: contentW, h: 8, text: 'מוענקת בזאת ל־', ...centered, font_size: 15 }),
    mk({ type: 'field', x: margin, y: 98, w: contentW, h: 12, field: '[שם מלא]', ...centered, font_size: 24, bold: true, color: accent }),
    // Identity line under the name (ת״ז / מספר אישי — pulled from the profile;
    // renders nothing when the employee has no identity on file).
    mk({ type: 'field', x: margin, y: 112, w: contentW, h: 7, field: '[זיהוי]', ...centered, font_size: 13, color: '#475569' }),
    // Body description.
    mk({ type: 'text', x: margin, y: 126, w: contentW, h: 12, text: isRenewal ? 'אישור רענון ההסמכה לביצוע בדיקות במערכת [מערכת] בדרג [דרג].' : 'אישור הסמכה לביצוע בדיקות במערכת [מערכת] בדרג [דרג].', ...centered, font_size: 15 }),
    // Dates — Gregorian line + Hebrew line, each on its own row (never cramped).
    mk({ type: 'text', x: margin, y: 146, w: contentW, h: 8, text: 'תאריך הסמכה: [תאריך הסמכה]   ·   בתוקף עד: [תוקף הסמכה]', ...centered, font_size: 13 }),
    mk({ type: 'field', x: margin, y: 156, w: contentW, h: 7, field: '[תאריך עברי]', date_mode: 'hebrew', ...centered, font_size: 12, color: '#64748b' }),
    // Signature block near the bottom.
    mk({ type: 'signature', x: A4.width / 2 - 28, y: 220, w: 56, h: 22 }),
    mk({ type: 'line', x: A4.width / 2 - 30, y: 244, w: 60, h: 0, line_color: ink, line_width: 0.3 }),
    mk({ type: 'text', x: A4.width / 2 - 45, y: 246, w: 90, h: 7, text: 'חתימת המסמיך: [שם המסמיך]', ...centered, font_size: 11 }),
    // Footer number.
    mk({ type: 'text', x: margin, y: 270, w: contentW, h: 7, text: 'מספר תעודה: [מספר תעודה]', ...centered, font_size: 10, color: '#64748b' }),
  ];
  return {
    kind: 'canvas',
    orientation: 'portrait',
    width_mm: A4.width,
    height_mm: A4.height,
    margin_mm: margin,
    bg_color: '#ffffff',
    elements,
    version: '1.0',
  };
}

// --- Draft / publish operations --------------------------------------------

/** The editable draft for a type, creating it from the default on first use. */
export async function getDraftTemplate(type: CertificateActionType): Promise<CertificateTemplateRow> {
  const existing = await db.certificate_templates.where('[type+status]').equals([type, 'draft']).first();
  if (existing) return existing;
  const now = nowIso();
  // Seed the draft at the next version after the latest published one.
  const published = await listPublishedVersions(type);
  const nextVersion = published.length ? bumpVersion(published[0].version) : '1.0';
  const row: CertificateTemplateRow = {
    id: newId(),
    type,
    status: 'draft',
    version: nextVersion,
    design: { ...defaultCanvasDesign(type), version: nextVersion },
    created_at: now,
    updated_at: now,
  };
  await db.certificate_templates.add(row);
  return row;
}

export async function saveDraftTemplate(
  type: CertificateActionType,
  design: CertCanvasDesign,
  actor: { id: string; full_name: string }
): Promise<CertificateTemplateRow> {
  const draft = await getDraftTemplate(type);
  const updated: CertificateTemplateRow = {
    ...draft,
    design: { ...design, version: draft.version },
    updated_at: nowIso(),
  };
  await db.certificate_templates.put(updated);
  await logAudit({
    user_id: actor.id,
    user_name: actor.full_name,
    action: 'CERT_TEMPLATE_DRAFT_SAVE',
    entity_type: 'certificate_template',
    entity_id: type,
    new_value: `version=${draft.version}`,
  });
  return updated;
}

/** Reset the draft back to the built-in default (does not touch published). */
export async function resetDraftTemplate(
  type: CertificateActionType,
  actor: { id: string; full_name: string }
): Promise<CertificateTemplateRow> {
  const draft = await getDraftTemplate(type);
  const def = { ...defaultCanvasDesign(type), version: draft.version };
  return saveDraftTemplate(type, def, actor);
}

/** Latest published versions for a type, newest first. */
export async function listPublishedVersions(
  type: CertificateActionType
): Promise<CertificateTemplateRow[]> {
  const rows = await db.certificate_templates.where('[type+status]').equals([type, 'published']).toArray();
  return rows.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
}

export async function getPublishedTemplate(
  type: CertificateActionType
): Promise<CertificateTemplateRow | undefined> {
  return (await listPublishedVersions(type))[0];
}

function bumpVersion(v: string): string {
  const [maj, min] = v.split('.').map((n) => parseInt(n, 10));
  if (!Number.isFinite(maj)) return '1.0';
  return `${maj}.${(Number.isFinite(min) ? min : 0) + 1}`;
}

/**
 * Publish the current draft: freeze it as a new published version, then advance
 * the draft to the next version for continued editing. Returns the published row.
 */
export async function publishTemplate(
  type: CertificateActionType,
  actor: { id: string; full_name: string }
): Promise<CertificateTemplateRow> {
  const draft = await getDraftTemplate(type);
  const now = nowIso();
  const publishedRow: CertificateTemplateRow = {
    id: newId(),
    type,
    status: 'published',
    version: draft.version,
    design: { ...draft.design, version: draft.version },
    created_at: now,
    updated_at: now,
    published_at: now,
  };
  const nextDraftVersion = bumpVersion(draft.version);
  const nextDraft: CertificateTemplateRow = {
    ...draft,
    version: nextDraftVersion,
    design: { ...draft.design, version: nextDraftVersion },
    updated_at: now,
  };
  await db.transaction('rw', db.certificate_templates, async () => {
    await db.certificate_templates.add(publishedRow);
    await db.certificate_templates.put(nextDraft);
  });
  await logAudit({
    user_id: actor.id,
    user_name: actor.full_name,
    action: 'CERT_TEMPLATE_PUBLISH',
    entity_type: 'certificate_template',
    entity_id: type,
    new_value: `version=${publishedRow.version}`,
  });
  return publishedRow;
}
