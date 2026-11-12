import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '@/test/helpers';
import {
  defaultCanvasDesign,
  getDraftTemplate,
  saveDraftTemplate,
  resetDraftTemplate,
  publishTemplate,
  getPublishedTemplate,
  listPublishedVersions,
  designUsesIdentity,
  A4,
} from '@/services/certificateTemplates';
import { issueCertificate } from '@/services/certificates';
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

const makeRankCert = (): RankCertification => ({
  id: 'rc',
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
});

describe('canvas certificate templates (versioned draft/publish)', () => {
  beforeEach(resetDb);

  it('default design is A4 portrait with elements', () => {
    const d = defaultCanvasDesign('initial');
    expect(d.kind).toBe('canvas');
    expect(d.orientation).toBe('portrait');
    expect(d.width_mm).toBe(A4.width);
    expect(d.height_mm).toBe(A4.height);
    expect(d.elements.length).toBeGreaterThan(5);
    // Renewal wording differs.
    const r = defaultCanvasDesign('renewal');
    expect(r.elements.some((e) => e.text === 'תעודת רענון הסמכה')).toBe(true);
  });

  it('creates a draft at version 1.0 on first use', async () => {
    const draft = await getDraftTemplate('initial');
    expect(draft.status).toBe('draft');
    expect(draft.version).toBe('1.0');
  });

  it('publish freezes a version and advances the draft to the next version', async () => {
    await getDraftTemplate('initial');
    const pub1 = await publishTemplate('initial', admin);
    expect(pub1.status).toBe('published');
    expect(pub1.version).toBe('1.0');
    // Draft advanced to 1.1.
    const draft = await getDraftTemplate('initial');
    expect(draft.version).toBe('1.1');
    // Publish again → 1.1 published, two versions in history.
    const pub2 = await publishTemplate('initial', admin);
    expect(pub2.version).toBe('1.1');
    const history = await listPublishedVersions('initial');
    expect(history.map((h) => h.version)).toEqual(['1.1', '1.0']);
    expect((await getPublishedTemplate('initial'))?.version).toBe('1.1');
  });

  it('editing the draft does not change an already-published version', async () => {
    const draft = await getDraftTemplate('initial');
    await publishTemplate('initial', admin); // publishes 1.0
    // Edit the (now 1.1) draft heavily.
    const edited = {
      ...draft.design,
      elements: [...draft.design.elements, { id: 'x', type: 'text' as const, x: 10, y: 10, w: 50, h: 10, z: 99, text: 'חדש' }],
    };
    await saveDraftTemplate('initial', edited, admin);
    const pub = await getPublishedTemplate('initial');
    expect(pub?.version).toBe('1.0');
    expect(pub?.design.elements.some((e) => e.text === 'חדש')).toBe(false);
  });

  it('issued certificate uses the PUBLISHED canvas design and records its version', async () => {
    await getDraftTemplate('initial');
    await publishTemplate('initial', admin); // 1.0 published
    const cert = await issueCertificate({
      rankCertification: makeRankCert(),
      userName: 'ישראל ישראלי',
      systemName: 'מערכת א׳',
      rankName: 'דרג א׳',
      certifier: admin,
    });
    expect((cert.design_snapshot as { kind?: string }).kind).toBe('canvas');
    expect(cert.template_version).toBe('1.0');
  });

  it('resetDraftTemplate restores the default', async () => {
    const draft = await getDraftTemplate('initial');
    await saveDraftTemplate(
      'initial',
      { ...draft.design, bg_color: '#000000' },
      admin
    );
    await resetDraftTemplate('initial', admin);
    const back = await getDraftTemplate('initial');
    expect(back.design.bg_color).toBe('#ffffff');
  });

  it('the default design includes the identity line and so uses identity', () => {
    const d = defaultCanvasDesign('initial');
    expect(d.elements.some((e) => e.field === '[זיהוי]')).toBe(true);
    expect(designUsesIdentity(d)).toBe(true);
  });

  it('designUsesIdentity detects all identity tokens', () => {
    const base = { ...defaultCanvasDesign('initial'), elements: [] as never[] };
    expect(designUsesIdentity({ ...base })).toBe(false);
    for (const field of ['[זיהוי]', '[מספר אישי / ת"ז]', '[סוג זיהוי]']) {
      expect(
        designUsesIdentity({ ...base, elements: [{ id: 'x', type: 'field', x: 0, y: 0, w: 10, h: 10, z: 1, field }] })
      ).toBe(true);
    }
  });
});
