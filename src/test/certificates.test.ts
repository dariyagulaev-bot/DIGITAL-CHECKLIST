import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/helpers';
import {
  defaultDesign,
  getCertificateTemplate,
  saveCertificateTemplate,
  resetCertificateTemplate,
  issueCertificate,
  listCertificates,
  getCertificate,
  renderTokens,
  designUsesIdentity,
  certificateFieldData,
  type CertificateFieldData,
} from '@/services/certificates';
import type { RankCertification, UserWithRoles } from '@/types';

const admin: UserWithRoles = {
  id: 'admin',
  username: 'admin',
  full_name: 'מנהל',
  password_hash: '',
  active: true,
  created_at: '',
  roles: [],
};

const certifier: UserWithRoles = { ...admin, id: 'cert', full_name: 'מסמיך' };

function makeRankCert(overrides: Partial<RankCertification> = {}): RankCertification {
  return {
    id: 'rc1',
    user_id: 'emp',
    system_id: 'sys',
    rank_id: 'rank',
    action_type: 'initial',
    issued_at: '2026-01-01',
    validity_months: 12,
    expires_at: '2027-01-01',
    certifier_user_id: 'cert',
    certifier_name_snapshot: 'מסמיך',
    signature_data: 'data:image/png;base64,SIG',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

const issueInput = () => ({
  rankCertification: makeRankCert(),
  userName: 'ישראל ישראלי',
  systemName: 'מערכת א׳',
  rankName: 'דרג ב׳',
  certifier,
});

describe('certificate templates', () => {
  beforeEach(resetDb);

  it('returns built-in defaults when nothing is saved', async () => {
    const d = await getCertificateTemplate('initial');
    expect(d.title).toBe(defaultDesign('initial').title);
    const r = await getCertificateTemplate('renewal');
    expect(r.title).toBe('תעודת רענון הסמכה');
  });

  it('saves and reloads a template, independently per type', async () => {
    const d = await getCertificateTemplate('initial');
    await saveCertificateTemplate('initial', { ...d, title: 'תעודה מותאמת' }, admin);
    expect((await getCertificateTemplate('initial')).title).toBe('תעודה מותאמת');
    // Renewal stays at default.
    expect((await getCertificateTemplate('renewal')).title).toBe('תעודת רענון הסמכה');
  });

  it('resets a template to default', async () => {
    const d = await getCertificateTemplate('initial');
    await saveCertificateTemplate('initial', { ...d, title: 'X' }, admin);
    await resetCertificateTemplate('initial', admin);
    expect((await getCertificateTemplate('initial')).title).toBe(defaultDesign('initial').title);
  });
});

describe('certificate issuance (immutable snapshot)', () => {
  beforeEach(resetDb);

  it('issues a certificate with a running number and frozen design', async () => {
    const c1 = await issueCertificate(issueInput());
    expect(c1.number).toBe('VERO-CERT-000001');
    expect((c1.design_snapshot as ReturnType<typeof defaultDesign>).title).toBe(
      defaultDesign('initial').title
    );
    expect(c1.signature_data).toBe('data:image/png;base64,SIG');
    const c2 = await issueCertificate(issueInput());
    expect(c2.number).toBe('VERO-CERT-000002');
    expect((await listCertificates()).length).toBe(2);
  });

  it('does not change a historical certificate when the template is later edited', async () => {
    const c = await issueCertificate(issueInput());
    const d = await getCertificateTemplate('initial');
    await saveCertificateTemplate('initial', { ...d, title: 'שונה לגמרי' }, admin);
    const reloaded = await getCertificate(c.id);
    expect((reloaded?.design_snapshot as ReturnType<typeof defaultDesign>).title).toBe(
      defaultDesign('initial').title
    ); // frozen
  });

  it('snapshots the protected identity ONLY when the design uses it', async () => {
    // Default design does NOT use identity → not stored.
    const c1 = await issueCertificate({
      ...issueInput(),
      idType: 'national',
      idNumber: '123456782',
    });
    expect(c1.id_number_snapshot).toBeUndefined();

    // A design that references [מספר זיהוי] → identity is snapshotted.
    const d = await getCertificateTemplate('initial');
    await saveCertificateTemplate(
      'initial',
      { ...d, body_lines: [...d.body_lines, 'מספר זיהוי: [מספר זיהוי]'] },
      admin
    );
    const c2 = await issueCertificate({
      ...issueInput(),
      idType: 'national',
      idNumber: '123456782',
    });
    expect(c2.id_number_snapshot).toBe('123456782');
  });

  it('logs a CERTIFICATE_ISSUE audit entry', async () => {
    const c = await issueCertificate(issueInput());
    const logs = (await db.audit_log.toArray()).filter((l) => l.action === 'CERTIFICATE_ISSUE');
    expect(logs.length).toBe(1);
    expect(logs[0].entity_id).toBe(c.id);
  });
});

describe('token rendering', () => {
  const data: CertificateFieldData = {
    fullName: 'דנה',
    systemName: 'מערכת ב׳',
    rankName: 'דרג א׳',
    actionLabel: 'הסמכה ראשונית',
    issuedAt: '2026-01-02',
    expiresAt: '2027-01-02',
    issuedHebrew: '',
    expiresHebrew: '',
    certifierName: 'יוסי',
    certifierRole: 'מסמיך',
    number: 'VERO-CERT-000009',
    identityLine: '',
  };

  it('substitutes tokens', () => {
    expect(renderTokens('מוענקת ל־[שם מלא] במערכת [מערכת]', data)).toBe(
      'מוענקת ל־דנה במערכת מערכת ב׳'
    );
    expect(renderTokens('מספר: [מספר תעודה]', data)).toBe('מספר: VERO-CERT-000009');
    // Date tokens render in DD.MM.YYYY.
    expect(renderTokens('[תאריך הסמכה]', data)).toBe('02.01.2026');
  });

  it('designUsesIdentity detects identity tokens', () => {
    const d = defaultDesign('initial');
    expect(designUsesIdentity(d)).toBe(false);
    expect(designUsesIdentity({ ...d, footer: '[מספר זיהוי]' })).toBe(true);
  });

  it('builds the identity line from the snapshot (ת״ז / מספר אישי) or empty', () => {
    const national = {
      ...makeRankCert(),
      user_name_snapshot: 'דני',
      system_name_snapshot: 's',
      rank_name_snapshot: 'r',
      id_type_snapshot: 'national',
      id_number_snapshot: '123456789',
    } as unknown as Parameters<typeof certificateFieldData>[0];
    expect(certificateFieldData(national).identityLine).toBe('ת״ז: 123456789');

    const personal = { ...national, id_type_snapshot: 'personal', id_number_snapshot: '1234567' } as typeof national;
    expect(certificateFieldData(personal).identityLine).toBe('מספר אישי: 1234567');

    const none = { ...national, id_type_snapshot: undefined, id_number_snapshot: undefined } as typeof national;
    expect(certificateFieldData(none).identityLine).toBe('');
  });

  it('certificateFieldData maps a certificate snapshot', () => {
    const c = {
      ...makeRankCert(),
      number: 'VERO-CERT-000003',
      user_name_snapshot: 'אבי',
      system_name_snapshot: 'מערכת ג׳',
      rank_name_snapshot: 'דרג ד׳',
    } as unknown as Parameters<typeof certificateFieldData>[0];
    const data2 = certificateFieldData(c);
    expect(data2.fullName).toBe('אבי');
    expect(data2.number).toBe('VERO-CERT-000003');
  });
});
