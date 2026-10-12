import { db } from '@/data/db';

/**
 * Settings service. Key/value store for configurable options
 * (e.g. approval policy, auto-logout timeout). No hard-coded passwords here.
 */
export const SettingKeys = {
  APPROVAL_MODE: 'approval_mode', // 'personal_accounts' (default) | 'shared_password'
  APPROVER_SHARED_HASH: 'approver_shared_password_hash', // only if shared mode is chosen
  ADMIN_AUTOLOGOUT_MIN: 'admin_autologout_minutes',
  ORG_NAME: 'org_name',
  CERT_VALIDITY_MONTHS: 'cert_validity_months', // default certification validity
  MEASURE_DURATION_DEFAULTS: 'measure_duration_defaults', // JSON {sysId|rankId: minutes}
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.settings.get(key);
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getApprovalMode(): Promise<'personal_accounts' | 'shared_password'> {
  const v = await getSetting(SettingKeys.APPROVAL_MODE);
  return v === 'shared_password' ? 'shared_password' : 'personal_accounts';
}

export async function getAdminAutoLogoutMinutes(): Promise<number> {
  const v = await getSetting(SettingKeys.ADMIN_AUTOLOGOUT_MIN);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 10; // default 10 minutes
}

/** Admin-configured default certification validity, in months (default 12). */
export async function getCertValidityMonths(): Promise<number> {
  const v = await getSetting(SettingKeys.CERT_VALIDITY_MONTHS);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 12;
}

export async function setCertValidityMonths(months: number): Promise<void> {
  await setSetting(SettingKeys.CERT_VALIDITY_MONTHS, String(Math.max(1, Math.round(months))));
}

const durKey = (systemId: string | null, rankId: string | null) => `${systemId ?? ''}|${rankId ?? ''}`;

/** The admin-set default minimum measurement duration (minutes) for a
 *  (system, rank), or null when none is configured. */
export async function getMeasureDurationDefault(
  systemId: string | null,
  rankId: string | null
): Promise<number | null> {
  const raw = await getSetting(SettingKeys.MEASURE_DURATION_DEFAULTS);
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, number>;
    const v = map[durKey(systemId, rankId)];
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** All configured defaults as a map (for the admin editor). */
export async function getMeasureDurationDefaults(): Promise<Record<string, number>> {
  const raw = await getSetting(SettingKeys.MEASURE_DURATION_DEFAULTS);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

export async function setMeasureDurationDefault(
  systemId: string | null,
  rankId: string | null,
  minutes: number | null
): Promise<void> {
  const map = await getMeasureDurationDefaults();
  const k = durKey(systemId, rankId);
  if (minutes && minutes > 0) map[k] = Math.round(minutes);
  else delete map[k];
  await setSetting(SettingKeys.MEASURE_DURATION_DEFAULTS, JSON.stringify(map));
}
