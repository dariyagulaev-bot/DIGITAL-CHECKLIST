import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { logAudit } from './audit';
import { getSetting, setSetting } from './settings';
import { formatDateDots } from '@/exports/labels';
import { identityTypeLabel } from './identity';
import { formatHebrewDate } from './hebrewDate';
import type {
  Certificate,
  CertificateActionType,
  CertificateDesign,
  RankCertification,
  UserWithRoles,
} from '@/types';

/**
 * Certificate templates + issuance (תעודות הסמכה). Fully OFFLINE: logos are
 * embedded data URLs and fonts come from a fixed LOCAL set — no CDN/Cloud. The
 * editable designs live in `settings` (JSON); issued certificates are immutable
 * snapshots in the `certificates` table, so history never changes silently.
 */

const TEMPLATE_SETTING_KEY = 'certificate_templates';
const CERT_COUNTER_KEY = 'CERTIFICATE';

/** Local, offline font choices (no remote fonts). Value is a CSS font-family. */
export const CERTIFICATE_FONTS: { key: string; label: string; css: string }[] = [
  { key: 'default', label: 'ברירת מחדל (מערכת)', css: 'inherit' },
  { key: 'serif', label: 'מסורתי (Serif)', css: 'Georgia, "Times New Roman", serif' },
  { key: 'sans', label: 'מודרני (Sans)', css: '"Segoe UI", Arial, sans-serif' },
  { key: 'rounded', label: 'מעוגל', css: '"Trebuchet MS", "Segoe UI", sans-serif' },
];

export function fontCss(key: string): string {
  return CERTIFICATE_FONTS.find((f) => f.key === key)?.css ?? 'inherit';
}

/** Dynamic field tokens available in the designer. */
export interface CertificateFieldData {
  fullName: string;
  systemName: string;
  rankName: string;
  actionLabel: string;
  issuedAt: string; // YYYY-MM-DD
  expiresAt: string; // YYYY-MM-DD
  issuedHebrew: string; // Hebrew date string
  expiresHebrew: string; // Hebrew date string
  certifierName: string;
  certifierRole: string; // תפקיד המסמיך
  number: string;
  idType?: string;
  idNumber?: string;
}

export const CERTIFICATE_TOKENS: { token: string; desc: string }[] = [
  { token: '[שם מלא]', desc: 'שם העובד המוסמך' },
  { token: '[מערכת]', desc: 'שם המערכת' },
  { token: '[דרג]', desc: 'שם הדרג' },
  { token: '[סוג פעולה]', desc: 'הסמכה ראשונית / רענון' },
  { token: '[תאריך הסמכה]', desc: 'תאריך ההסמכה/רענון' },
  { token: '[תוקף עד]', desc: 'תאריך פקיעת התוקף' },
  { token: '[שם המסמיך]', desc: 'שם המסמיך (אוטומטי)' },
  { token: '[מספר תעודה]', desc: 'מספר התעודה הרץ' },
  { token: '[סוג זיהוי]', desc: 'מספר אישי / תעודת זהות (אופציונלי)' },
  { token: '[מספר זיהוי]', desc: 'מספר הזיהוי (אופציונלי, מוגן)' },
];

/** True when a design references the protected identity tokens. */
export function designUsesIdentity(d: CertificateDesign): boolean {
  const all = [d.title, d.subtitle ?? '', d.footer ?? '', ...d.body_lines].join('\n');
  return all.includes('[מספר זיהוי]') || all.includes('[סוג זיהוי]');
}

/** Substitute dynamic tokens in a single string (legacy + canvas tokens). */
export function renderTokens(text: string, data: CertificateFieldData): string {
  return text
    .replaceAll('[שם מלא]', data.fullName)
    .replaceAll('[מערכת]', data.systemName)
    .replaceAll('[דרג]', data.rankName)
    .replaceAll('[סוג פעולה]', data.actionLabel)
    .replaceAll('[סוג הסמכה]', data.actionLabel)
    .replaceAll('[תאריך הסמכה]', formatDateDots(data.issuedAt))
    .replaceAll('[תאריך לועזי]', formatDateDots(data.issuedAt))
    .replaceAll('[תאריך עברי]', data.issuedHebrew)
    .replaceAll('[תוקף עד]', formatDateDots(data.expiresAt))
    .replaceAll('[תוקף הסמכה]', formatDateDots(data.expiresAt))
    .replaceAll('[תוקף עברי]', data.expiresHebrew)
    .replaceAll('[שם המסמיך]', data.certifierName)
    .replaceAll('[תפקיד המסמיך]', data.certifierRole)
    .replaceAll('[מספר תעודה]', data.number)
    .replaceAll('[סוג זיהוי]', data.idType ?? '')
    .replaceAll('[מספר אישי / ת"ז]', data.idNumber ?? '')
    .replaceAll('[מספר זיהוי]', data.idNumber ?? '');
}

export function defaultDesign(type: CertificateActionType): CertificateDesign {
  const isRenewal = type === 'renewal';
  return {
    logo_data: null,
    title: isRenewal ? 'תעודת רענון הסמכה' : 'תעודת הסמכה',
    subtitle: 'מערכת VERO — בדיקות דיגיטליות',
    body_lines: [
      'מוענקת בזאת ל־[שם מלא]',
      isRenewal
        ? 'אישור רענון ההסמכה לביצוע בדיקות במערכת [מערכת] בדרג [דרג].'
        : 'אישור הסמכה לביצוע בדיקות במערכת [מערכת] בדרג [דרג].',
      'תאריך הסמכה: [תאריך הסמכה]   ·   בתוקף עד: [תוקף עד]',
    ],
    footer: 'מספר תעודה: [מספר תעודה]',
    accent_color: '#1e3a8a',
    text_color: '#0f172a',
    bg_color: '#ffffff',
    font_key: 'serif',
    show_signature: true,
  };
}

interface StoredTemplates {
  initial?: CertificateDesign;
  renewal?: CertificateDesign;
}

/** The current designs for both types, each falling back to the built-in default. */
export async function getCertificateTemplates(): Promise<Record<CertificateActionType, CertificateDesign>> {
  const raw = await getSetting(TEMPLATE_SETTING_KEY);
  let parsed: StoredTemplates = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as StoredTemplates;
    } catch {
      parsed = {};
    }
  }
  return {
    initial: { ...defaultDesign('initial'), ...(parsed.initial ?? {}) },
    renewal: { ...defaultDesign('renewal'), ...(parsed.renewal ?? {}) },
  };
}

export async function getCertificateTemplate(type: CertificateActionType): Promise<CertificateDesign> {
  return (await getCertificateTemplates())[type];
}

export async function saveCertificateTemplate(
  type: CertificateActionType,
  design: CertificateDesign,
  actor: { id: string; full_name: string }
): Promise<void> {
  const current = await getCertificateTemplates();
  const next: StoredTemplates = { ...current, [type]: design };
  await setSetting(TEMPLATE_SETTING_KEY, JSON.stringify(next));
  await logAudit({
    user_id: actor.id,
    user_name: actor.full_name,
    action: 'CERT_TEMPLATE_SAVE',
    entity_type: 'certificate_template',
    entity_id: type,
  });
}

/** Reset one template back to the built-in default. */
export async function resetCertificateTemplate(
  type: CertificateActionType,
  actor: { id: string; full_name: string }
): Promise<CertificateDesign> {
  const def = defaultDesign(type);
  await saveCertificateTemplate(type, def, actor);
  return def;
}

/** Mint the next running certificate number (monotonic, offline). */
async function nextCertificateNumber(): Promise<string> {
  const value = await db.transaction('rw', db.counters, async () => {
    const row = await db.counters.get(CERT_COUNTER_KEY);
    const next = (row?.value ?? 0) + 1;
    await db.counters.put({ id: CERT_COUNTER_KEY, value: next });
    return next;
  });
  return `VERO-CERT-${String(value).padStart(6, '0')}`;
}

export interface IssueCertificateInput {
  rankCertification: RankCertification;
  userName: string;
  systemName: string;
  rankName: string;
  certifier: UserWithRoles;
  /** Protected identity, passed ONLY so it can be snapshotted when the design uses it. */
  idType?: import('@/types').IdentityType;
  idNumber?: string;
}

/**
 * Issue a certificate for a completed certification. Freezes a full snapshot
 * (employee, certification, certifier, signature, and the live design) so the
 * document can be reprinted unchanged forever. The protected identity is stored
 * ONLY when the chosen design actually references it.
 */
export async function issueCertificate(input: IssueCertificateInput): Promise<Certificate> {
  const rc = input.rankCertification;
  // Prefer a PUBLISHED A4 canvas template; fall back to the legacy token default
  // when no canvas template has been published yet (backward compatible).
  const { getPublishedTemplate, designUsesIdentity: canvasUsesId } = await import(
    './certificateTemplates'
  );
  const published = await getPublishedTemplate(rc.action_type);
  const design = published ? published.design : await getCertificateTemplate(rc.action_type);
  const templateVersion = published?.version;
  const usesId = published
    ? canvasUsesId(published.design)
    : designUsesIdentity(design as import('@/types').CertificateDesign);
  const number = await nextCertificateNumber();
  const cert: Certificate = {
    id: newId(),
    number,
    action_type: rc.action_type,
    user_id: rc.user_id,
    user_name_snapshot: input.userName,
    system_id: rc.system_id,
    system_name_snapshot: input.systemName,
    rank_id: rc.rank_id,
    rank_name_snapshot: input.rankName,
    issued_at: rc.issued_at,
    expires_at: rc.expires_at,
    certifier_user_id: rc.certifier_user_id,
    certifier_name_snapshot: rc.certifier_name_snapshot,
    certifier_role_snapshot: 'מסמיך',
    signature_data: rc.signature_data,
    id_type_snapshot: usesId ? input.idType : undefined,
    id_number_snapshot: usesId ? input.idNumber : undefined,
    design_snapshot: design,
    template_version: templateVersion,
    created_at: nowIso(),
  };
  await db.certificates.add(cert);
  await logAudit({
    user_id: input.certifier.id,
    user_name: input.certifier.full_name,
    action: 'CERTIFICATE_ISSUE',
    entity_type: 'certificate',
    entity_id: cert.id,
    field: `${rc.system_id}|${rc.rank_id}`,
    new_value: `number=${number};employee=${input.userName};action=${rc.action_type};template=${templateVersion ?? 'legacy'}`,
  });
  return cert;
}

export async function listCertificates(): Promise<Certificate[]> {
  return (await db.certificates.toArray()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listCertificatesForUser(userId: string): Promise<Certificate[]> {
  return (await db.certificates.where('user_id').equals(userId).toArray()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

export async function getCertificate(id: string): Promise<Certificate | undefined> {
  return db.certificates.get(id);
}

/** Build the token data for an issued certificate's own snapshot. */
export function certificateFieldData(cert: Certificate): CertificateFieldData {
  return {
    fullName: cert.user_name_snapshot,
    systemName: cert.system_name_snapshot,
    rankName: cert.rank_name_snapshot,
    actionLabel: cert.action_type === 'renewal' ? 'רענון הסמכה' : 'הסמכה ראשונית',
    issuedAt: cert.issued_at,
    expiresAt: cert.expires_at,
    issuedHebrew: safeHebrew(cert.issued_at),
    expiresHebrew: safeHebrew(cert.expires_at),
    certifierName: cert.certifier_name_snapshot,
    certifierRole: cert.certifier_role_snapshot ?? 'מסמיך',
    number: cert.number,
    idType: cert.id_type_snapshot ? identityTypeLabel(cert.id_type_snapshot) : undefined,
    idNumber: cert.id_number_snapshot,
  };
}

function safeHebrew(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return formatHebrewDate(iso);
  } catch {
    return '';
  }
}
