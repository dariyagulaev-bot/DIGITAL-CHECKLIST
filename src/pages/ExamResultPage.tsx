import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { isAdmin } from '@/services/rbac';
import { getAttempt, gradeOpenAnswer, scoreAttempt } from '@/services/exams';
import type { ExamAttempt } from '@/types';

/** Exam result for the examinee, and the manual-grading surface for admins. */
export default function ExamResultPage() {
  const { attemptId = '' } = useParams();
  const { user } = useAuth();
  const { notify } = useToast();
  const [a, setA] = useState<ExamAttempt | null>(null);

  const load = useCallback(async () => { setA((await getAttempt(attemptId)) ?? null); }, [attemptId]);
  useEffect(() => { load(); }, [load]);
  if (!a) return <div className="card p-8 text-center text-ink-400">טוען…</div>;

  const admin = user && isAdmin(user);
  const sc = scoreAttempt(a.exam_snapshot, a.answers);

  const grade = async (qid: string, points: number, note: string) => {
    if (!user) return;
    await gradeOpenAnswer(attemptId, qid, points, note, user);
    notify('הניקוד נשמר', 'ok');
    await load();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/exams" className="link flex items-center gap-1 text-[13px]"><Icon name="back" size={15} /> חזרה למבחנים</Link>

      {/* Result banner */}
      <div className={`card p-5 text-center ${a.status === 'pending_review' ? 'border-brand-200 bg-brand-50/50' : a.passed ? 'border-ok-300 bg-ok-50' : 'border-fault-300 bg-fault-50'}`}>
        {a.status === 'pending_review' ? (
          <>
            <Icon name="clock" size={32} className="mx-auto text-brand-500" />
            <div className="mt-2 text-[18px] font-extrabold text-brand-800">המבחן ממתין לבדיקת מנהל</div>
            <div className="text-[13px] text-ink-500">יש שאלות פתוחות שטרם נבדקו. הציון הסופי ייקבע לאחר הבדיקה.</div>
          </>
        ) : (
          <>
            <Icon name={a.passed ? 'check' : 'alert'} size={32} className={`mx-auto ${a.passed ? 'text-ok-600' : 'text-fault-600'}`} />
            <div className={`mt-2 text-[22px] font-extrabold ${a.passed ? 'text-ok-700' : 'text-fault-700'}`}>{a.passed ? 'עברת' : 'נכשלת'}</div>
            <div className="nums text-[15px] font-bold text-ink-700">{a.score}/100</div>
            <div className="text-[12px] text-ink-400">ציון מעבר: 80 · מעבר אינו מעניק הסמכה ללא אישור מנהל</div>
          </>
        )}
      </div>

      <div className="text-[14px] font-bold text-ink-900">{a.exam_title} · {a.user_name}</div>

      {/* Per-question breakdown */}
      <div className="space-y-2.5">
        {[...a.exam_snapshot].sort((x, y) => x.sort_order - y.sort_order).map((q, i) => {
          const ans = a.answers.find((x) => x.question_id === q.id);
          const ps = sc.per_question.find((p) => p.question_id === q.id);
          return (
            <div key={q.id} className="card p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{i + 1}</span>
                <span className="text-[13.5px] font-semibold text-ink-800">{q.text || (q.type === 'image_match' ? 'זיהוי ציוד בתמונה' : '')}</span>
                <span className="ms-auto nums text-[12.5px] text-ink-500">{ps?.awarded ?? '—'}/{q.points} נק׳</span>
              </div>
              {q.type === 'image_match' && ps && <div className="mt-1 text-[12px] text-ink-500">{ps.correct_matches}/{ps.total_matches} התאמות נכונות</div>}
              {q.type === 'open' && (
                <div className="mt-2 space-y-2">
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-[13px] text-ink-700"><span className="text-ink-400">תשובת הנבחן: </span>{ans?.text || '—'}</div>
                  {admin && (
                    <OpenGrader q={q} ans={ans} onGrade={(pts, note) => grade(q.id, pts, note)} />
                  )}
                  {!admin && ans?.manual_note && <div className="text-[12px] text-ink-500">הערת בודק: {ans.manual_note}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OpenGrader({ q, ans, onGrade }: { q: { points: number; config: { sample_answer?: string; rubric?: string } }; ans: { manual_awarded?: number | null; manual_note?: string | null } | undefined; onGrade: (pts: number, note: string) => void }) {
  const [pts, setPts] = useState<number>(ans?.manual_awarded ?? 0);
  const [note, setNote] = useState<string>(ans?.manual_note ?? '');
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-2.5">
      {q.config.sample_answer && <div className="mb-1 text-[12px] text-ink-500">תשובה לדוגמה: {q.config.sample_answer}</div>}
      {q.config.rubric && <div className="mb-2 text-[12px] text-ink-500">מחוון: {q.config.rubric}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-600">ניקוד
          <input type="number" min={0} max={q.points} className="input !min-h-0 w-20 !py-1.5 nums" value={pts} onChange={(e) => setPts(Math.max(0, Math.min(q.points, Number(e.target.value))))} />
          <span className="text-ink-400">/ {q.points}</span>
        </label>
        <input className="input !min-h-0 flex-1 !py-1.5" placeholder="הערה (לא חובה)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary btn-sm" onClick={() => onGrade(pts, note)}>שמור ניקוד</button>
      </div>
      {ans?.manual_awarded != null && <div className="mt-1 text-[12px] text-ok-700">נבדק · {ans.manual_awarded}/{q.points}</div>}
    </div>
  );
}
