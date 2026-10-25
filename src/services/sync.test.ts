import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/helpers';
import { db } from '@/data/db';
import { getDeviceId, nowIso } from '@/services/ids';
import { FormStatus, type CompletedForm } from '@/types';
import {
  getRole,
  setRole,
  getThisDevice,
  registerDevice,
  authorizeDevice,
  deviceSerialBase,
  buildOutgoingPackage,
  applyIncomingPackage,
  checksumOf,
  markSent,
} from '@/services/sync';

/** Minimal completed form row for sync tests. */
function form(id: string, patch: Partial<CompletedForm> = {}): CompletedForm {
  const now = nowIso();
  return {
    id,
    device_id: getDeviceId(),
    badach_number: id,
    template_id: 't1',
    status: FormStatus.APPROVED,
    created_at: now,
    updated_at: now,
    completed_at: now,
    approved_at: now,
    ...(patch as object),
  } as CompletedForm;
}

describe('sync — role & device identity', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('defaults to tablet role and creates a self device record', async () => {
    expect(await getRole()).toBe('tablet');
    const self = await getThisDevice();
    expect(self.id).toBe(getDeviceId());
    expect(self.is_self).toBe(true);
    expect(self.status).toBe('pending');
  });

  it('numbering bands never overlap across devices', async () => {
    // ordinal 1 → base 0 (identical to single device), ordinal 2 → +block_size.
    const self = await getThisDevice();
    await db.devices.put({ ...self, ordinal: 1, block_size: 1000 });
    expect(await deviceSerialBase()).toBe(0);
    await db.devices.put({ ...self, ordinal: 2, block_size: 1000 });
    expect(await deviceSerialBase()).toBe(1000);
    await db.devices.put({ ...self, ordinal: 5, block_size: 1000 });
    expect(await deviceSerialBase()).toBe(4000);
  });
});

describe('sync — integrity', () => {
  beforeEach(async () => { await resetDb(); });
  it('checksum is stable and detects tampering', async () => {
    const pkg = await buildOutgoingPackage();
    const { checksum, ...rest } = pkg;
    expect(checksumOf(rest)).toBe(checksum);
    const tampered = { ...rest, from_code: 'HACKED' };
    expect(checksumOf(tampered)).not.toBe(checksum);
  });
});

describe('sync — device → central (idempotent, authorized, incremental)', () => {
  beforeEach(async () => { await resetDb(); });

  it('rejects a package from an unauthorized device', async () => {
    // Build on the tablet.
    await db.completed_forms.add(form('F1'));
    const pkg = await buildOutgoingPackage();
    // Switch to central with the device only pending.
    await resetDb();
    await setRole('central');
    await registerDevice({ id: pkg.from_device, code: 'VERO-TAB-001' });
    await expect(applyIncomingPackage(pkg)).rejects.toThrow(/מאושר/);
  });

  it('applies forms once and is idempotent on re-import', async () => {
    await db.completed_forms.bulkAdd([form('F1'), form('F2')]);
    const pkg = await buildOutgoingPackage();
    expect(pkg.kind).toBe('device-to-central');
    expect(pkg.forms).toHaveLength(2);

    // Central receives.
    await resetDb();
    await setRole('central');
    await registerDevice({ id: pkg.from_device });
    await authorizeDevice(pkg.from_device);

    const first = await applyIncomingPackage(pkg);
    expect(first.forms).toBe(2);
    expect(await db.completed_forms.count()).toBe(2);

    // Re-import the SAME package → no duplicates, no change.
    const second = await applyIncomingPackage(pkg);
    expect(second.forms).toBe(0);
    expect(await db.completed_forms.count()).toBe(2);
  });

  it('incremental: only forms changed since the last send are re-sent', async () => {
    await db.completed_forms.add(form('F1', { updated_at: '2026-01-01T00:00:00.000Z' }));
    const pkg1 = await buildOutgoingPackage();
    expect(pkg1.forms).toHaveLength(1);
    await markSent({ at: pkg1.created_at });

    // Nothing changed → next package is empty.
    const pkg2 = await buildOutgoingPackage();
    expect(pkg2.forms).toHaveLength(0);

    // A newer form appears → only it is included.
    await db.completed_forms.add(form('F2', { updated_at: nowIso() }));
    const pkg3 = await buildOutgoingPackage();
    expect(pkg3.forms?.map((f) => f.id)).toEqual(['F2']);
  });
});

describe('sync — central → device (ownership: config only, never forms)', () => {
  beforeEach(async () => { await resetDb(); });

  it('a central→device package updates config but never touches local forms', async () => {
    // Central side: a template + a user.
    await setRole('central');
    const now = nowIso();
    await db.templates.add({ id: 'TPL1', name: 'תבנית', created_at: now, updated_at: now } as never);
    await db.users.add({ id: 'U1', username: 'u1', full_name: 'משתמש', password_hash: 'x', active: true, created_at: now } as never);
    const self = await getThisDevice();
    await registerDevice({ id: 'DEV2', code: 'VERO-TAB-002' });
    await authorizeDevice('DEV2');
    const pkg = await buildOutgoingPackage({ targetDeviceId: 'DEV2' });
    expect(pkg.kind).toBe('central-to-device');

    // Tablet side: has a local form that must NOT be touched.
    await resetDb();
    await setRole('tablet');
    await db.completed_forms.add(form('LOCAL1'));
    const res = await applyIncomingPackage(pkg);
    expect(res.templates).toBe(1);
    expect(await db.templates.count()).toBe(1);
    expect(await db.completed_forms.count()).toBe(1); // local form preserved
    expect(res.forms).toBe(0);
    // Stale-permission policy: records the central-verification time.
    const { getLastCentralSyncAt } = await import('@/services/sync');
    expect(await getLastCentralSyncAt()).not.toBeNull();
    // void self to satisfy lint
    expect(self.id).toBeTruthy();
  });
});
