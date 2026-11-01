import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { listExams, listAttempts, startAttempt } from '@/services/exams';
import type { Exam, ExamAttempt } from '@/types';

/** User-facing list of certification exams + the user's own attempts. */
export default function ExamsListPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const nav = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);

  useEffect(() => {
    listExams().then((all) => setExams(all.filter((e) => e.published))).catch(() => {});
    if (user) listAttempts({ userId: user.id }).then(setAttempts).catch(() => {});
  }, [user]);

  const start = async (exam: Exam) => {
    if (!user) return;
    const existing = attempts.find((a) => a.exam_id === exam.id && a.status === 'in_progress');
    if (existing) return nav(`/exam/take/${existing.id}`);
    try {
      const id = await startAttempt(exam.id, user);
      nav(`/exam/take/${id}`);
    } catch (e) { notify((e as Error).message, 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="pt-1">
        <h1 className="text-[22px] font-extrabold text-navy-900">מבחני הסמכה</h1>
        <p className="mt-0.5 text-[14px] text-ink-500">ציון מעבר: 80/100. מעבר במבחן אינו מעניק הסמכה — נדרש אישור מנהל.</p>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-bold text-ink-600">מבחנים זמינים</div>
        {exams.length === 0 ? (
          <div className="card p-8 text-center text-ink-400">אין מבחנים זמינים כרגע.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {exams.map((e) => {
              const open = attempts.find((a) => a.exam_id === e.id && a.status === 'in_progress');
              return (
                <div key={e.id} className="card flex flex-col p-4">
                  <div className="text-[15px] font-bold text-ink-900">{e.title}</div>
                  {e.description && <div className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-500">{e.description}</div>}
                  <button className="btn-primary mt-3 gap-1.5 self-start" onClick={() => start(e)}>
                    <Icon name={open ? 'refresh' : 'pen'} size={16} /> {open ? 'המשך מבחן' : 'התחל מבחן'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {attempts.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] font-bold text-ink-600">הניסיונות שלי</div>
          <div className="space-y-1.5">
            {attempts.map((a) => (
              <button key={a.id} onClick={() => nav(a.status === 'in_progress' ? `/exam/take/${a.id}` : `/exam/result/${a.id}`)}
                className="card flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-slate-50/60">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink-800">{a.exam_title}</div>
                  <div className="text-[12px] text-ink-500">{new Date(a.started_at).toLocaleString('he-IL')}</div>
                </div>
                <AttemptBadge a={a} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AttemptBadge({ a }: { a: ExamAttempt }) {
  if (a.status === 'in_progress') return <span className="rounded-full border border-pending-200 bg-pending-50 px-2.5 py-1 text-[12px] font-medium text-pending-700">בתהליך</span>;
  if (a.status === 'pending_review') return <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-700">ממתין לבדיקת מנהל</span>;
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[12px] font-bold ${a.passed ? 'border-ok-200 bg-ok-50 text-ok-700' : 'border-fault-200 bg-fault-50 text-fault-700'}`}>
      {a.passed ? 'עבר' : 'נכשל'} · {a.score}/100
    </span>
  );
}
