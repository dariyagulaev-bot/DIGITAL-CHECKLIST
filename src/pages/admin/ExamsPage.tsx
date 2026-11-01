import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useToast } from '@/context/ToastContext';
import { listExams, createExam, deleteExam, listAttempts } from '@/services/exams';
import type { Exam, ExamAttempt } from '@/types';

/** "מבחני הסמכה" — list + create exams (admin). */
export default function ExamsPage() {
  const { notify } = useToast();
  const nav = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [pending, setPending] = useState<ExamAttempt[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    listExams().then(setExams).catch(() => {});
    listAttempts({ status: 'pending_review' }).then(setPending).catch(() => {});
  };
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    setBusy(true);
    try {
      const e = await createExam({ title: 'מבחן חדש' });
      nav(`/admin/exams/${e.id}`);
    } catch (err) {
      notify('לא ניתן ליצור מבחן: ' + (err as Error).message, 'error');
    } finally { setBusy(false); }
  };
  const remove = async (e: Exam) => {
    if (!confirm(`למחוק את המבחן "${e.title}"? פעולה זו אינה הפיכה.`)) return;
    await deleteExam(e.id);
    notify('המבחן נמחק', 'ok');
    refresh();
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink-900">מבחני הסמכה</h2>
          <p className="text-[13px] text-ink-500">יצירה ועריכה של מבחנים — אמריקאיות, מספר תשובות, שאלות פתוחות וזיהוי ציוד בתמונה. ציון מעבר: 80/100.</p>
        </div>
        <button className="btn-primary gap-1.5" disabled={busy} onClick={add}><Icon name="plus" size={17} /> מבחן חדש</button>
      </div>

      {pending.length > 0 && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <div className="mb-2 flex items-center gap-2 text-[14px] font-bold text-brand-800"><Icon name="clock" size={16} /> ממתינים לבדיקת מנהל ({pending.length})</div>
          <div className="space-y-1.5">
            {pending.map((a) => (
              <Link key={a.id} to={`/exam/result/${a.id}`} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] hover:border-brand-300">
                <span className="font-semibold text-ink-800">{a.exam_title}</span>
                <span className="text-ink-500">{a.user_name} · {new Date(a.started_at).toLocaleDateString('he-IL')}</span>
                <span className="link">בדוק</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {exams.length === 0 ? (
        <div className="card p-10 text-center text-ink-400">עדיין אין מבחנים. צרו מבחן חדש כדי להתחיל.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {exams.map((e) => (
            <div key={e.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-bold text-ink-900">{e.title}</div>
                  {e.description && <div className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-500">{e.description}</div>}
                </div>
                {e.ever_published ? (
                  <span className="shrink-0 rounded-full border border-ok-200 bg-ok-50 px-2 py-0.5 text-[11px] font-medium text-ok-700">פורסם · {e.version}{e.has_unpublished_changes ? ' •' : ''}</span>
                ) : (
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-ink-500">טיוטה</span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2.5 text-[13px]">
                <Link to={`/admin/exams/${e.id}`} className="link font-semibold">עריכה</Link>
                <button className="link text-fault-600" onClick={() => remove(e)}>מחק</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
