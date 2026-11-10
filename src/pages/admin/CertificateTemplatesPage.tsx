import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { CertificateView } from '@/components/CertificateView';
import {
  getCertificateTemplates,
  saveCertificateTemplate,
  resetCertificateTemplate,
  CERTIFICATE_FONTS,
  CERTIFICATE_TOKENS,
  type CertificateFieldData,
} from '@/services/certificates';
import { addMonths, todayStr } from '@/services/dates';
import type { CertificateActionType, CertificateDesign } from '@/types';

/** Sample data used for the LIVE preview only (never persisted). */
function sampleData(type: CertificateActionType): CertificateFieldData {
  const issued = todayStr();
  return {
    fullName: 'ישראל ישראלי',
    systemName: 'מערכת א׳',
    rankName: 'דרג ב׳',
    actionLabel: type === 'renewal' ? 'רענון הסמכה' : 'הסמכה ראשונית',
    issuedAt: issued,
    expiresAt: addMonths(issued, 12),
    certifierName: 'דנה כהן',
    number: 'VERO-CERT-000123',
    idType: 'מספר אישי',
    idNumber: '1234567',
  };
}

export default function CertificateTemplatesPage() {
  const { user: admin } = useAuth();
  const { notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<CertificateActionType>('initial');
  const [designs, setDesigns] = useState<Record<CertificateActionType, CertificateDesign> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCertificateTemplates()
      .then((d) => setDesigns(d))
      .catch(() => setDesigns(null))
      .finally(() => setLoading(false));
  }, []);

  const design = designs?.[type] ?? null;
  const data = useMemo(() => sampleData(type), [type]);

  const patch = (p: Partial<CertificateDesign>) =>
    setDesigns((prev) => (prev ? { ...prev, [type]: { ...prev[type], ...p } } : prev));

  const setLine = (i: number, value: string) =>
    patch({ body_lines: (design?.body_lines ?? []).map((l, idx) => (idx === i ? value : l)) });
  const addLine = () => patch({ body_lines: [...(design?.body_lines ?? []), ''] });
  const removeLine = (i: number) =>
    patch({ body_lines: (design?.body_lines ?? []).filter((_, idx) => idx !== i) });

  const onLogo = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patch({ logo_data: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!design || !admin) return;
    setBusy(true);
    try {
      await saveCertificateTemplate(type, design, { id: admin.id, full_name: admin.full_name });
      notify('תבנית התעודה נשמרה', 'ok');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!admin) return;
    if (!confirm('לאפס את התבנית לברירת המחדל? פעולה זו אינה משפיעה על תעודות שכבר הונפקו.')) return;
    setBusy(true);
    try {
      const def = await resetCertificateTemplate(type, { id: admin.id, full_name: admin.full_name });
      setDesigns((prev) => (prev ? { ...prev, [type]: def } : prev));
      notify('התבנית אופסה לברירת המחדל', 'ok');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !design) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="עיצוב תעודות הסמכה"
        subtitle="עיצוב נפרד להסמכה ראשונית ולרענון. התצוגה מתעדכנת בזמן אמת. אין שינוי לתעודות שכבר הונפקו."
      />

      {/* initial / renewal tabs */}
      <div className="mb-4 flex gap-2">
        {(['initial', 'renewal'] as const).map((t) => (
          <button
            key={t}
            className={`rounded-xl border px-4 py-2 text-[14px] font-semibold ${
              type === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'
            }`}
            onClick={() => setType(t)}
          >
            {t === 'initial' ? 'הסמכה ראשונית' : 'רענון'}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Editor ---- */}
        <div className="space-y-4">
          <div className="card space-y-3 p-4">
            <div>
              <label className="label">כותרת</label>
              <input className="input" value={design.title} onChange={(e) => patch({ title: e.target.value })} />
            </div>
            <div>
              <label className="label">כותרת משנה</label>
              <input
                className="input"
                value={design.subtitle ?? ''}
                onChange={(e) => patch({ subtitle: e.target.value })}
              />
            </div>
            <div>
              <label className="label">שורות גוף התעודה</label>
              <div className="space-y-2">
                {design.body_lines.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input flex-1" value={line} onChange={(e) => setLine(i, e.target.value)} />
                    <button className="btn-ghost !px-2" type="button" onClick={() => removeLine(i)} aria-label="מחק שורה">
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
                <button className="btn-secondary btn-sm gap-1.5" type="button" onClick={addLine}>
                  <Icon name="plus" size={15} /> הוסף שורה
                </button>
              </div>
            </div>
            <div>
              <label className="label">כיתוב תחתון</label>
              <input
                className="input"
                value={design.footer ?? ''}
                onChange={(e) => patch({ footer: e.target.value })}
              />
            </div>
          </div>

          <div className="card space-y-3 p-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">צבע הדגשה</label>
                <input type="color" className="h-10 w-full rounded" value={design.accent_color} onChange={(e) => patch({ accent_color: e.target.value })} />
              </div>
              <div>
                <label className="label">צבע טקסט</label>
                <input type="color" className="h-10 w-full rounded" value={design.text_color} onChange={(e) => patch({ text_color: e.target.value })} />
              </div>
              <div>
                <label className="label">רקע</label>
                <input type="color" className="h-10 w-full rounded" value={design.bg_color} onChange={(e) => patch({ bg_color: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">גופן</label>
              <select className="input" value={design.font_key} onChange={(e) => patch({ font_key: e.target.value })}>
                {CERTIFICATE_FONTS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="label">לוגו (תמונה מקומית)</label>
                <input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0])} className="text-[13px]" />
              </div>
              {design.logo_data && (
                <button className="btn-ghost btn-sm" type="button" onClick={() => patch({ logo_data: null })}>
                  הסר לוגו
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-[14px] text-ink-700">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={design.show_signature}
                onChange={(e) => patch({ show_signature: e.target.checked })}
              />
              הצג בלוק חתימת מסמיך
            </label>
          </div>

          <div className="card p-4">
            <div className="mb-1 text-[13px] font-semibold text-ink-700">שדות דינמיים זמינים</div>
            <div className="flex flex-wrap gap-1.5">
              {CERTIFICATE_TOKENS.map((t) => (
                <span key={t.token} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[12px] text-ink-600" title={t.desc}>
                  {t.token}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-primary flex-1" onClick={save} disabled={busy}>
              שמור תבנית
            </button>
            <button className="btn-ghost" onClick={reset} disabled={busy}>
              איפוס לברירת מחדל
            </button>
          </div>
        </div>

        {/* ---- Live preview ---- */}
        <div>
          <div className="mb-2 text-[13px] font-semibold text-ink-500">תצוגה מקדימה חיה</div>
          <CertificateView design={design} data={data} />
        </div>
      </div>
    </div>
  );
}
