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
