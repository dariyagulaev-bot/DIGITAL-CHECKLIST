import { useMemo } from 'react';
import { ImageMatchTaker } from './ImageMarker';
import type { ExamAnswer, ExamQuestionSnapshot } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  single: 'בחירה יחידה', multi: 'בחירה מרובה', open: 'שאלה פתוחה', image_match: 'זיהוי ציוד בתמונה',
};

/** Deterministic shuffle (seeded by the question id) so the option/pool order is
 * stable across re-renders within an attempt. */
function shuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One question as the examinee sees it (answers editable, or read-only review). */
export function ExamQuestionView({ index, question, answer, onChange, editable = true }: {
  index: number;
  question: ExamQuestionSnapshot;
  answer: ExamAnswer | undefined;
  onChange?: (a: ExamAnswer) => void;
  editable?: boolean;
}) {
  const set = (patch: Partial<ExamAnswer>) => onChange?.({ question_id: question.id, ...answer, ...patch });
  const pool = useMemo(() => {
    if (question.type !== 'image_match') return [];
    const names = Array.from(new Set([...(question.config.markers ?? []).map((m) => m.component_name), ...(question.config.distractors ?? [])])).filter(Boolean);
    return shuffle(names, question.id);
  }, [question]);
  const options = useMemo(() => (question.type === 'single' || question.type === 'multi' ? shuffle(question.config.options ?? [], question.id) : []), [question]);

  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{index}</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-ink-500">{TYPE_LABEL[question.type]}</span>
        <span className="ms-auto text-[12px] text-ink-400 nums">{question.points} נק׳</span>
      </div>
      {question.text && <p className="mb-3 text-[14px] font-semibold text-ink-800">{question.text}</p>}
      {question.type !== 'image_match' && question.config.image && (
        <img src={question.config.image} alt="" className="mb-3 max-h-64 w-auto rounded-lg border border-slate-200" />
      )}

      {question.type === 'single' && (
        <div className="space-y-2">
          {options.map((o) => (
            <label key={o.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[14px] ${answer?.selected_option_ids?.[0] === o.id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" className="h-4 w-4" disabled={!editable} checked={answer?.selected_option_ids?.[0] === o.id} onChange={() => set({ selected_option_ids: [o.id] })} />
              <span className="text-ink-800">{o.text}</span>
              {o.image && <img src={o.image} alt="" className="ms-auto h-12 w-12 rounded border border-slate-200 object-cover" />}
            </label>
          ))}
        </div>
      )}

      {question.type === 'multi' && (
        <div className="space-y-2">
          {options.map((o) => {
            const sel = new Set(answer?.selected_option_ids ?? []);
            const on = sel.has(o.id);
            return (
              <label key={o.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[14px] ${on ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="checkbox" className="h-4 w-4" disabled={!editable} checked={on} onChange={() => { on ? sel.delete(o.id) : sel.add(o.id); set({ selected_option_ids: [...sel] }); }} />
                <span className="text-ink-800">{o.text}</span>
              </label>
            );
          })}
          <p className="text-[12px] text-ink-400">יש לסמן את כל התשובות הנכונות.</p>
        </div>
      )}

      {question.type === 'open' && (
        <textarea className="input min-h-[96px]" disabled={!editable} value={answer?.text ?? ''} placeholder="הקלידו את תשובתכם…" onChange={(e) => set({ text: e.target.value })} />
      )}

      {question.type === 'image_match' && question.config.image && (
        <ImageMatchTaker
          image={question.config.image}
          markers={question.config.markers ?? []}
          pool={pool}
          value={answer?.matches ?? {}}
          editable={editable}
          onChange={(matches) => set({ matches })}
        />
      )}
    </div>
  );
}

/** Full examinee view of an exam snapshot (used by the taking page & preview). */
export function ExamRunner({ snapshot, answers, onChange, editable = true }: {
  snapshot: ExamQuestionSnapshot[];
  answers: ExamAnswer[];
  onChange?: (a: ExamAnswer[]) => void;
  editable?: boolean;
}) {
  const byId = new Map(answers.map((a) => [a.question_id, a]));
  const update = (a: ExamAnswer) => {
    const next = answers.some((x) => x.question_id === a.question_id) ? answers.map((x) => (x.question_id === a.question_id ? a : x)) : [...answers, a];
    onChange?.(next);
  };
  return (
    <div className="space-y-4">
      {[...snapshot].sort((a, b) => a.sort_order - b.sort_order).map((q, i) => (
        <ExamQuestionView key={q.id} index={i + 1} question={q} answer={byId.get(q.id)} editable={editable} onChange={update} />
      ))}
    </div>
  );
}
