import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import type { AuditEntry } from '@/types';

/**
 * Append an entry to the audit log. Used for admin/unusual changes,
 * approvals, re-approvals, backups/restores, etc.
 */
export async function logAudit(params: {
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  reason?: string | null;
}): Promise<void> {
  const entry: AuditEntry = {
    id: newId(),
    user_id: params.user_id,
    user_name: params.user_name,
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    field: params.field ?? null,
    old_value: params.old_value ?? null,
    new_value: params.new_value ?? null,
    reason: params.reason ?? null,
    timestamp: nowIso(),
  };
  await db.audit_log.add(entry);
}

export async function listAudit(limit = 500): Promise<AuditEntry[]> {
  const all = await db.audit_log.orderBy('timestamp').reverse().limit(limit).toArray();
  return all;
}
