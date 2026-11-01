import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useToast } from '@/context/ToastContext';
import { ExamRunner } from '@/components/ExamTaker';
import { getAttempt, saveAttemptAnswers, submitAttempt } from '@/services/exams';
import type { ExamAnswer, ExamAttempt } from '@/types';

/** Tablet exam-taking page. Autosaves answers; locks on submit. */
export default function ExamTakePage() {
  const { attemptId = '' } = useParams();
  const { notify } = useToast();
  const nav = useNavigate();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    const a = await getAttempt(attemptId);
    if (!a) return;
    if (a.status !== 'in_progress') { nav(`/exam/result/${a.id}`, { replace: true }); return; }
    setAttempt(a);
    setAnswers(a.answers);
  }, [attemptId, nav]);
  useEffect(() => { load(); }, [load]);

  const onChange = (next: ExamAnswer[]) => {
    setAnswers(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveAttemptAnswers(attemptId, next).catch(() => {}); }, 300);
  };

  const submit = async () => {
    const total = attempt?.exam_snapshot.length ?? 0;
    const answered = answers.filter((a) => a.selected_option_ids?.length || a.text?.trim() || (a.matches && Object.keys(a.matches).length)).length;
    if (answered < total && !confirm(`ענית על ${answered} מתוך ${total} שאלות. להגיש בכל זאת?`)) return;
    if (!confirm('לאחר ההגשה לא ניתן לשנות את התשובות. להגיש את המבחן?')) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await saveAttemptAnswers(attemptId, answers);
    const res = await submitAttempt(attemptId);
    notify(res.status === 'pending_review' ? 'המבחן הוגש וממתין לבדיקת מנהל' : res.passed ? 'המבחן הוגש — עברת!' : 'המבחן הוגש', res.passed === false ? 'info' : 'ok');
    nav(`/exam/result/${attemptId}`, { replace: true });
  };

  if (!attempt) return <div className="card p-8 text-center text-ink-400">טוען…</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <div className="pt-1">
        <h1 className="text-[20px] font-extrabold text-navy-900">{attempt.exam_title}</h1>
        <p className="text-[13px] text-ink-500">גרסה {attempt.exam_version} · ציון מעבר 80/100 · התשובות נשמרות אוטומטית</p>
      </div>

      <ExamRunner snapshot={attempt.exam_snapshot} answers={answers} onChange={onChange} editable />

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <span className="text-[13px] text-ink-500">{answers.filter((a) => a.selected_option_ids?.length || a.text?.trim() || (a.matches && Object.keys(a.matches).length)).length} / {attempt.exam_snapshot.length} נענו</span>
          <button className="btn-primary gap-1.5" onClick={submit}><Icon name="check" size={17} /> הגש מבחן</button>
        </div>
      </div>
    </div>
  );
}
