import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Modal } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { fileToManagedDataUrl } from '@/services/images';
import { ImageMarkerEditor } from '@/components/ImageMarker';
import { ExamRunner } from '@/components/ExamTaker';
import {
  getExam, updateExamMeta, listQuestions, addQuestion, updateQuestion, deleteQuestion, duplicateQuestion, moveQuestion,
  publishExam, validateExam, snapshotQuestions,
} from '@/services/exams';
import { listSystems } from '@/services/systems';
import { listRanks } from '@/services/ranks';
import type { Exam, ExamAnswer, ExamOption, ExamQuestion, ExamQuestionSnapshot, ExamQuestionType, Rank, System } from '@/types';

const TYPES: { type: ExamQuestionType; label: string }[] = [
  { type: 'single', label: 'בחירה יחידה (אמריקאית)' },
  { type: 'multi', label: 'בחירה מרובה' },
  { type: 'open', label: 'שאלה פתוחה' },
  { type: 'image_match', label: 'זיהוי ציוד בתמונה' },
];

export default function ExamEditorPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { notify } = useToast();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [preview, setPreview] = useState<ExamQuestionSnapshot[] | null>(null);
  const [previewAns, setPreviewAns] = useState<ExamAnswer[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    const e = await getExam(id);
    setExam(e ?? null);
    setQuestions(await listQuestions(id));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { listSystems().then(setSystems); listRanks().then(setRanks); }, []);

  const setMeta = (patch: Partial<Exam>) => { setExam((e) => (e ? { ...e, ...patch } : e)); updateExamMeta(id, patch); };

  const patchQuestionLocal = (qid: string, patch: Partial<ExamQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
    if (saveTimers.current[qid]) clearTimeout(saveTimers.current[qid]);
    saveTimers.current[qid] = setTimeout(() => {
      const q = { ...(questions.find((x) => x.id === qid) as ExamQuestion), ...patch };
      updateQuestion(qid, { text: q.text, points: q.points, config: q.config }).catch(() => {});
    }, 300);
  };

  const add = async (type: ExamQuestionType) => { setAddOpen(false); await addQuestion(id, type); await load(); };
  const del = async (qid: string) => { if (!confirm('למחוק שאלה זו?')) return; await deleteQuestion(qid); await load(); };
  const dup = async (qid: string) => { await duplicateQuestion(qid); await load(); };
  const move = async (qid: string, dir: 'up' | 'down') => { await moveQuestion(qid, dir); await load(); };

  const doPreview = async () => { setPreviewAns([]); setPreview(await snapshotQuestions(id)); };
  const doPublish = async () => {
    if (!user) return;
    const errs = await validateExam(id);
    if (errs.length) { notify(errs[0], 'error'); return; }
    try {
      const bump = exam?.ever_published ? (confirm('האם זו גרסה ראשית (שינוי מהותי)? אישור = גרסה ראשית, ביטול = גרסת משנה') ? 'major' : 'minor') : undefined;
      const v = await publishExam(id, user, { bump });
      notify(`המבחן פורסם — גרסה ${v}`, 'ok');
      await load();
    } catch (e) { notify((e as Error).message, 'error'); }
  };

  if (!exam) return <div className="card p-8 text-center text-ink-400">טוען…</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/admin/exams" className="link flex items-center gap-1 text-[13px]"><Icon name="back" size={15} /> חזרה למבחנים</Link>
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm gap-1.5" onClick={doPreview}><Icon name="eye" size={15} /> תצוגה מקדימה כנבחן</button>
          <button className="btn-primary btn-sm gap-1.5" onClick={doPublish}><Icon name="check" size={15} /> פרסם גרסה</button>
        </div>
      </div>

      <div className="card p-4">
        <label className="label">כותרת המבחן</label>
        <input className="input mb-3" value={exam.title} onChange={(e) => { setExam({ ...exam, title: e.target.value }); updateExamMeta(id, { title: e.target.value }); }} />
        <label className="label">תיאור (לא חובה)</label>
        <textarea className="input min-h-[52px]" value={exam.description ?? ''} onChange={(e) => { setExam({ ...exam, description: e.target.value }); updateExamMeta(id, { description: e.target.value }); }} />

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">סוג מבחן</label>
            <select className="input" value={exam.exam_type ?? 'initial'} onChange={(e) => setMeta({ exam_type: e.target.value as Exam['exam_type'] })}>
              <option value="initial">הסמכה ראשונית</option>
              <option value="renewal">רענון הסמכה</option>
            </select>
          </div>
          <div>
            <label className="label">מערכת (סוג){exam.exam_type === 'renewal' ? ' *' : ''}</label>
            <select className="input" value={exam.system_id ?? ''} onChange={(e) => setMeta({ system_id: e.target.value || null })}>
              <option value="">— כללי —</option>
              {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">דרג{exam.exam_type === 'renewal' ? ' *' : ''}</label>
            <select className="input" value={exam.rank_id ?? ''} onChange={(e) => setMeta({ rank_id: e.target.value || null })}>
              <option value="">— כל הדרגים —</option>
              {ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        {exam.exam_type === 'renewal' && (
          <p className="mt-1.5 text-[12px] text-ink-400">מבחן רענון משויך לפי מערכת + דרג, ומוצג אוטומטית למי שהסמכתו באותה מערכת/דרג מתקרבת לפקיעה.</p>
        )}

        <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-400">
          <Icon name="shield-check" size={14} /> ציון מעבר: 80/100 · {exam.ever_published ? `גרסה ${exam.version}${exam.has_unpublished_changes ? ' (יש שינויים שלא פורסמו)' : ''}` : 'טיוטה — טרם פורסם'}
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionEditor key={q.id} q={q} index={i + 1} total={questions.length}
            onPatch={(patch) => patchQuestionLocal(q.id, patch)}
            onDelete={() => del(q.id)} onDup={() => dup(q.id)} onMove={(d) => move(q.id, d)} />
        ))}
      </div>

      <button className="btn-secondary w-full gap-1.5" onClick={() => setAddOpen(true)}><Icon name="plus" size={16} /> הוסף שאלה</button>

      {addOpen && (
        <Modal open onClose={() => setAddOpen(false)} title="בחר סוג שאלה" maxWidth="max-w-md" footer={<button className="btn-ghost" onClick={() => setAddOpen(false)}>ביטול</button>}>
          <div className="grid gap-2">
            {TYPES.map((t) => (
              <button key={t.type} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-right hover:border-brand-300 hover:bg-brand-50/40" onClick={() => add(t.type)}>
                <span className="font-semibold text-ink-800">{t.label}</span>
                <Icon name="plus" size={16} className="text-ink-400" />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {preview && (
        <Modal open onClose={() => setPreview(null)} title="תצוגה מקדימה כנבחן" maxWidth="max-w-2xl" footer={<button className="btn-primary" onClick={() => setPreview(null)}>סגור</button>}>
          <p className="mb-3 rounded-md border border-pending-200 bg-pending-50 px-3 py-2 text-[12.5px] text-pending-700">זו תצוגה מקדימה בלבד — אינה יוצרת ניסיון בחינה ואינה משפיעה על ציונים.</p>
          <ExamRunner snapshot={preview} answers={previewAns} onChange={setPreviewAns} editable />
        </Modal>
      )}
    </div>
  );
}

// ===== per-question editor =================================================

function QuestionEditor({ q, index, total, onPatch, onDelete, onDup, onMove }: {
  q: ExamQuestion; index: number; total: number;
  onPatch: (patch: Partial<ExamQuestion>) => void;
  onDelete: () => void; onDup: () => void; onMove: (d: 'up' | 'down') => void;
}) {
  const cfg = q.config;
  const setCfg = (patch: Partial<typeof cfg>) => onPatch({ config: { ...cfg, ...patch } });
  const typeLabel = TYPES.find((t) => t.type === q.type)?.label ?? q.type;

  const uploadImage = async (file: File) => { try { setCfg({ image: await fileToManagedDataUrl(file) }); } catch (e) { alert((e as Error).message); } };

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{index}</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-ink-500">{typeLabel}</span>
        <div className="ms-auto flex items-center gap-0.5">
          <button className="btn-ghost !min-h-0 !p-1.5" onClick={() => onMove('up')} disabled={index === 1}><Icon name="up" size={14} /></button>
          <button className="btn-ghost !min-h-0 !p-1.5" onClick={() => onMove('down')} disabled={index === total}><Icon name="down" size={14} /></button>
          <button className="btn-ghost !min-h-0 !p-1.5" onClick={onDup}><Icon name="layers" size={14} /></button>
          <button className="btn-ghost !min-h-0 !p-1.5 text-fault-600" onClick={onDelete}><Icon name="trash" size={14} /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label className="mb-0.5 block text-[11px] text-ink-500">נוסח השאלה</label>
          <textarea className="input !min-h-0 w-full !py-1.5" rows={2} value={q.text} placeholder="כתבו את השאלה כאן…" onChange={(e) => onPatch({ text: e.target.value })} />
        </div>
        <div className="w-24">
          <label className="mb-0.5 block text-[11px] text-ink-500">ניקוד</label>
          <input type="number" min={1} className="input !min-h-0 w-full !py-1.5 nums" value={q.points} onChange={(e) => onPatch({ points: Math.max(0, Number(e.target.value)) })} />
        </div>
      </div>

      {/* attach image for single/multi/open */}
      {q.type !== 'image_match' && (
        <div className="mt-2">
          {cfg.image ? (
            <div className="flex items-center gap-2">
              <img src={cfg.image} alt="" className="h-16 w-16 rounded border border-slate-200 object-cover" />
              <button className="btn-ghost btn-sm text-fault-600" onClick={() => setCfg({ image: null })}>הסר תמונה</button>
            </div>
          ) : (
            <label className="btn-ghost btn-sm inline-flex cursor-pointer gap-1.5"><Icon name="image" size={14} /> צרף תמונה
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = ''; }} />
            </label>
          )}
        </div>
      )}

      {/* type-specific editors */}
      {(q.type === 'single' || q.type === 'multi') && (
        <OptionsEditor type={q.type} options={cfg.options ?? []} correct={cfg.correct_option_ids ?? []}
          onOptions={(options) => setCfg({ options })} onCorrect={(correct_option_ids) => setCfg({ correct_option_ids })}
          partial={q.type === 'multi' ? !!cfg.multi_partial : undefined} onPartial={(v) => setCfg({ multi_partial: v })} />
      )}

      {q.type === 'open' && (
        <div className="mt-3 space-y-2">
          <div><label className="mb-0.5 block text-[11px] text-ink-500">תשובה לדוגמה (למנהל)</label><textarea className="input !min-h-0 !py-1.5" rows={2} value={cfg.sample_answer ?? ''} onChange={(e) => setCfg({ sample_answer: e.target.value })} /></div>
          <div><label className="mb-0.5 block text-[11px] text-ink-500">מחוון לבדיקה (למנהל)</label><input className="input !min-h-0 !py-1.5" value={cfg.rubric ?? ''} onChange={(e) => setCfg({ rubric: e.target.value })} /></div>
          <p className="text-[12px] text-ink-400">שאלה פתוחה נבדקת ידנית. לא ייקבע ציון סופי לפני שכל השאלות הפתוחות נבדקו.</p>
        </div>
      )}

      {q.type === 'image_match' && (
        <div className="mt-3 space-y-3">
          {cfg.image ? (
            <>
              <ImageMarkerEditor image={cfg.image} markers={cfg.markers ?? []} onChange={(markers) => setCfg({ markers })} />
              <div className="flex items-center gap-2">
                <label className="btn-ghost btn-sm inline-flex cursor-pointer gap-1.5"><Icon name="refresh" size={14} /> החלף תמונה
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = ''; }} />
                </label>
                <button className="btn-ghost btn-sm text-fault-600" onClick={() => setCfg({ image: null, markers: [] })}>מחק תמונה</button>
              </div>
              <div>
                <label className="mb-0.5 block text-[11px] text-ink-500">שמות מסיחים נוספים (לא על התמונה) — מופרדים בפסיק</label>
                <input className="input !min-h-0 !py-1.5" value={(cfg.distractors ?? []).join(', ')} onChange={(e) => setCfg({ distractors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="למשל: ממסר, נתיך" />
              </div>
              <label className="flex items-center gap-2 text-[13px] text-ink-600"><input type="checkbox" className="h-4 w-4" checked={cfg.image_partial !== false} onChange={(e) => setCfg({ image_partial: e.target.checked })} /> ניקוד חלקי לפי מספר ההתאמות הנכונות</label>
            </>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-ink-500 hover:border-brand-300">
              <Icon name="image" size={28} /> העלו תמונת ציוד כדי לסמן רכיבים
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = ''; }} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ type, options, correct, onOptions, onCorrect, partial, onPartial }: {
  type: 'single' | 'multi'; options: ExamOption[]; correct: string[];
  onOptions: (o: ExamOption[]) => void; onCorrect: (c: string[]) => void;
  partial?: boolean; onPartial?: (v: boolean) => void;
}) {
  const list = options.length ? options : [{ id: crypto.randomUUID(), text: '' }];
  const toggle = (oid: string) => {
    if (type === 'single') onCorrect([oid]);
    else { const s = new Set(correct); s.has(oid) ? s.delete(oid) : s.add(oid); onCorrect([...s]); }
  };
  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-[11px] font-semibold text-ink-500">תשובות — סמנו את {type === 'single' ? 'התשובה הנכונה' : 'כל התשובות הנכונות'}</div>
      {list.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <input type={type === 'single' ? 'radio' : 'checkbox'} className="h-4 w-4" checked={correct.includes(o.id)} onChange={() => toggle(o.id)} />
          <input className="input !min-h-0 flex-1 !py-1.5" value={o.text} placeholder={`תשובה ${i + 1}`} onChange={(e) => onOptions(list.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))} />
          <button className="btn-ghost !min-h-0 !p-1.5 text-fault-600" onClick={() => { const next = list.filter((x) => x.id !== o.id); onOptions(next); onCorrect(correct.filter((c) => c !== o.id)); }} disabled={list.length <= 2}><Icon name="trash" size={13} /></button>
        </div>
      ))}
      <button className="btn-ghost btn-sm gap-1" onClick={() => onOptions([...list, { id: crypto.randomUUID(), text: '' }])}><Icon name="plus" size={13} /> הוסף תשובה</button>
      {type === 'multi' && onPartial && (
        <label className="flex items-center gap-2 pt-1 text-[12.5px] text-ink-600"><input type="checkbox" className="h-4 w-4" checked={!!partial} onChange={(e) => onPartial(e.target.checked)} /> ניקוד חלקי (ברירת מחדל: ניקוד מלא רק על תשובה מלאה ונכונה)</label>
      )}
    </div>
  );
}
