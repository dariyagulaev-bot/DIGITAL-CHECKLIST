import { db } from '@/data/db';
import { newId, nowIso, getDeviceId } from './ids';
import { logAudit } from './audit';
import {
  EXAM_PASS_SCORE,
  type Exam,
  type ExamAnswer,
  type ExamAttempt,
  type ExamQuestion,
  type ExamQuestionSnapshot,
  type ExamQuestionType,
  type UserWithRoles,
} from '@/types';

/**
 * Certification exams (מבחני הסמכה). Four question types — single / multi /
 * open / image_match (equipment identification on a real photo). Scoring is
 * deterministic and local (no AI, no image recognition): the admin defines the
 * correct answers; VERO normalizes the weighted result to 0..100 with a fixed
 * 80 pass. Open questions require manual grading before a final score exists.
 * Passing an exam never grants certification on its own — an admin still
 * approves certification through the existing mechanism.
 */

// ===== scoring engine (pure, testable) =====================================

export interface QuestionScore {
  question_id: string;
  type: ExamQuestionType;
  max: number;
  awarded: number | null; // null = not yet decided (ungraded open question)
  needs_manual: boolean;
  correct_matches?: number; // image_match detail
  total_matches?: number;
}

export interface AttemptScore {
  per_question: QuestionScore[];
  raw_awarded: number;
  raw_max: number;
  score: number | null; // 0..100, null while any open question is ungraded
  passed: boolean | null;
  needs_review: boolean; // at least one open question not yet graded
}

const setEq = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === new Set([...a, ...b]).size;

/** Score a single answer against its (snapshotted) question. */
export function scoreAnswer(q: ExamQuestionSnapshot, a: ExamAnswer | undefined): QuestionScore {
  const max = Number.isFinite(q.points) && q.points > 0 ? q.points : 0;
  const base = { question_id: q.id, type: q.type, max } as const;
  switch (q.type) {
    case 'single': {
      const sel = a?.selected_option_ids?.[0];
      const correct = q.config.correct_option_ids?.[0];
      return { ...base, awarded: sel && correct && sel === correct ? max : 0, needs_manual: false };
    }
    case 'multi': {
      const sel = a?.selected_option_ids ?? [];
      const correct = q.config.correct_option_ids ?? [];
      if (q.config.multi_partial) {
        const correctSet = new Set(correct);
        const chosenCorrect = sel.filter((id) => correctSet.has(id)).length;
        const chosenWrong = sel.filter((id) => !correctSet.has(id)).length;
        const frac = correct.length ? Math.max(0, chosenCorrect - chosenWrong) / correct.length : 0;
        return { ...base, awarded: Math.round(max * frac * 100) / 100, needs_manual: false };
      }
      return { ...base, awarded: setEq(sel, correct) && correct.length > 0 ? max : 0, needs_manual: false };
    }
    case 'image_match': {
      const markers = q.config.markers ?? [];
      const matches = a?.matches ?? {};
      const correct = markers.filter((m) => (matches[m.id] ?? '') === m.component_name).length;
      const total = markers.length;
      const partial = q.config.image_partial !== false; // default: partial credit
      const awarded = total === 0 ? 0 : partial ? Math.round((max * correct) / total * 100) / 100 : correct === total ? max : 0;
      return { ...base, awarded, needs_manual: false, correct_matches: correct, total_matches: total };
    }
    case 'open':
    default:
      // Awarded only once an admin grades it; null keeps the attempt in review.
      return { ...base, awarded: a?.manual_awarded ?? null, needs_manual: true };
  }
}

/** Score a whole attempt. Normalizes to 0..100; null while any open Q is ungraded. */
export function scoreAttempt(snapshot: ExamQuestionSnapshot[], answers: ExamAnswer[]): AttemptScore {
  const byId = new Map(answers.map((a) => [a.question_id, a]));
  const per = snapshot.map((q) => scoreAnswer(q, byId.get(q.id)));
  const needs_review = per.some((p) => p.needs_manual && p.awarded === null);
  const raw_max = per.reduce((s, p) => s + p.max, 0);
  const raw_awarded = per.reduce((s, p) => s + (p.awarded ?? 0), 0);
  const score = needs_review ? null : raw_max > 0 ? Math.round((raw_awarded / raw_max) * 100) : 0;
  const passed = score === null ? null : score >= EXAM_PASS_SCORE;
  return { per_question: per, raw_awarded, raw_max, score, passed, needs_review };
}

// ===== exam CRUD ===========================================================

export async function listExams(): Promise<Exam[]> {
  return (await db.exams.toArray()).sort((a, b) => a.title.localeCompare(b.title));
}
export async function getExam(id: string): Promise<Exam | undefined> {
  return db.exams.get(id);
}
export async function createExam(params: { title: string; description?: string; system_id?: string | null; rank_id?: string | null }): Promise<Exam> {
  const now = nowIso();
  const exam: Exam = {
    id: newId(), title: params.title.trim() || 'מבחן חדש', description: params.description ?? '',
    system_id: params.system_id ?? null, rank_id: params.rank_id ?? null,
    version: '1.0', ever_published: false, has_unpublished_changes: true, version_history: [], published: null,
    created_at: now, updated_at: now,
  };
  await db.exams.add(exam);
  return exam;
}
export async function updateExamMeta(id: string, patch: Partial<Pick<Exam, 'title' | 'description' | 'system_id' | 'rank_id'>>): Promise<void> {
  await db.exams.update(id, { ...patch, updated_at: nowIso() });
  await markExamDirty(id);
}
export async function deleteExam(id: string): Promise<void> {
  await db.exam_questions.where('exam_id').equals(id).delete();
  await db.exams.delete(id);
}
async function markExamDirty(id: string): Promise<void> {
  const e = await db.exams.get(id);
  if (e?.ever_published) await db.exams.update(id, { has_unpublished_changes: true, updated_at: nowIso() });
}

// ===== questions ===========================================================

export async function listQuestions(examId: string): Promise<ExamQuestion[]> {
  return (await db.exam_questions.where('exam_id').equals(examId).toArray()).sort((a, b) => a.sort_order - b.sort_order);
}
function defaultConfig(type: ExamQuestionType) {
  switch (type) {
    case 'single':
      return { options: [opt('תשובה 1'), opt('תשובה 2')], correct_option_ids: [] };
    case 'multi':
      return { options: [opt('תשובה 1'), opt('תשובה 2'), opt('תשובה 3')], correct_option_ids: [], multi_partial: false };
    case 'open':
      return { sample_answer: '', rubric: '' };
    case 'image_match':
      return { image: null, markers: [], distractors: [], image_partial: true };
    default:
      return {};
  }
}
function opt(text: string) { return { id: newId(), text }; }

async function nextSort(examId: string): Promise<number> {
  const qs = await listQuestions(examId);
  return qs.length ? Math.max(...qs.map((q) => q.sort_order)) + 1 : 0;
}
export async function addQuestion(examId: string, type: ExamQuestionType): Promise<ExamQuestion> {
  const now = nowIso();
  const q: ExamQuestion = { id: newId(), exam_id: examId, sort_order: await nextSort(examId), type, text: '', points: 10, config: defaultConfig(type), created_at: now, updated_at: now };
  await db.exam_questions.add(q);
  await markExamDirty(examId);
  return q;
}
export async function updateQuestion(id: string, patch: Partial<Pick<ExamQuestion, 'text' | 'points' | 'config' | 'type'>>): Promise<void> {
  await db.exam_questions.update(id, { ...patch, updated_at: nowIso() });
  const q = await db.exam_questions.get(id);
  if (q) await markExamDirty(q.exam_id);
}
export async function deleteQuestion(id: string): Promise<void> {
  const q = await db.exam_questions.get(id);
  if (!q) return;
  await db.exam_questions.delete(id);
  const rest = await listQuestions(q.exam_id);
  await Promise.all(rest.map((r, i) => db.exam_questions.update(r.id, { sort_order: i })));
  await markExamDirty(q.exam_id);
}
export async function duplicateQuestion(id: string): Promise<void> {
  const q = await db.exam_questions.get(id);
  if (!q) return;
  const now = nowIso();
  const copy: ExamQuestion = { ...q, id: newId(), sort_order: q.sort_order + 0.5, config: JSON.parse(JSON.stringify(q.config)), created_at: now, updated_at: now };
  await db.exam_questions.add(copy);
  const rest = (await listQuestions(q.exam_id)).sort((a, b) => a.sort_order - b.sort_order);
  await Promise.all(rest.map((r, i) => db.exam_questions.update(r.id, { sort_order: i })));
  await markExamDirty(q.exam_id);
}
export async function reorderQuestions(examId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) => db.exam_questions.update(id, { sort_order: i })));
  await markExamDirty(examId);
}
export async function moveQuestion(id: string, dir: 'up' | 'down'): Promise<void> {
  const q = await db.exam_questions.get(id);
  if (!q) return;
  const qs = await listQuestions(q.exam_id);
  const idx = qs.findIndex((x) => x.id === id);
  const swap = dir === 'up' ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= qs.length) return;
  const ids = qs.map((x) => x.id);
  [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
  await reorderQuestions(q.exam_id, ids);
}

// ===== validation & publish ================================================

export async function validateExam(examId: string): Promise<string[]> {
  const errs: string[] = [];
  const qs = await listQuestions(examId);
  if (!qs.length) errs.push('המבחן חייב לפחות שאלה אחת.');
  qs.forEach((q, i) => {
    const n = i + 1;
    if (!q.text.trim() && q.type !== 'image_match') errs.push(`שאלה ${n}: חסר נוסח שאלה.`);
    if (!(q.points > 0)) errs.push(`שאלה ${n}: הניקוד חייב להיות גדול מאפס.`);
    if (q.type === 'single') {
      const opts = q.config.options ?? [];
      if (opts.filter((o) => o.text.trim()).length < 2) errs.push(`שאלה ${n}: נדרשות לפחות שתי תשובות.`);
      if ((q.config.correct_option_ids ?? []).length !== 1) errs.push(`שאלה ${n}: יש לסמן תשובה נכונה אחת.`);
    }
    if (q.type === 'multi') {
      const opts = q.config.options ?? [];
      if (opts.filter((o) => o.text.trim()).length < 2) errs.push(`שאלה ${n}: נדרשות לפחות שתי תשובות.`);
      if ((q.config.correct_option_ids ?? []).length < 1) errs.push(`שאלה ${n}: יש לסמן לפחות תשובה נכונה אחת.`);
    }
    if (q.type === 'image_match') {
      if (!q.config.image) errs.push(`שאלה ${n}: יש להעלות תמונת ציוד.`);
      if ((q.config.markers ?? []).length < 1) errs.push(`שאלה ${n}: יש לסמן לפחות רכיב אחד על התמונה.`);
      if ((q.config.markers ?? []).some((m) => !m.component_name.trim())) errs.push(`שאלה ${n}: לכל סימון חייב להיות שם רכיב.`);
    }
  });
  return errs;
}

function bumpVersion(current: string, kind: 'minor' | 'major'): string {
  const [x, y] = current.split('.').map((n) => parseInt(n, 10) || 0);
  return kind === 'major' ? `${x + 1}.0` : `${x}.${y + 1}`;
}

export async function snapshotQuestions(examId: string): Promise<ExamQuestionSnapshot[]> {
  const qs = await listQuestions(examId);
  return qs.map((q) => ({ id: q.id, sort_order: q.sort_order, type: q.type, text: q.text, points: q.points, config: JSON.parse(JSON.stringify(q.config)) }));
}

export async function publishExam(examId: string, admin: UserWithRoles, opts?: { bump?: 'minor' | 'major' }): Promise<string> {
  const exam = await db.exams.get(examId);
  if (!exam) throw new Error('המבחן לא נמצא');
  const errs = await validateExam(examId);
  if (errs.length) throw new Error(errs[0]);
  const version = !exam.ever_published ? '1.0' : bumpVersion(exam.version, opts?.bump ?? 'minor');
  const now = nowIso();
  const published = { version, published_at: now, questions: await snapshotQuestions(examId) };
  const history = [...(exam.version_history ?? []), { version, published_at: now, published_by_id: admin.id, published_by_name: admin.full_name }];
  await db.exams.update(examId, { version, ever_published: true, has_unpublished_changes: false, published, version_history: history, updated_at: now });
  await logAudit({ user_id: admin.id, user_name: admin.full_name, action: 'EXAM_PUBLISH', entity_type: 'exam', entity_id: examId, new_value: version });
  return version;
}

// ===== attempts (taking, submit, grade) ====================================

export async function listAttempts(filter?: { examId?: string; userId?: string; status?: ExamAttempt['status'] }): Promise<ExamAttempt[]> {
  let rows = await db.exam_attempts.toArray();
  if (filter?.examId) rows = rows.filter((a) => a.exam_id === filter.examId);
  if (filter?.userId) rows = rows.filter((a) => a.user_id === filter.userId);
  if (filter?.status) rows = rows.filter((a) => a.status === filter.status);
  return rows.sort((a, b) => b.started_at.localeCompare(a.started_at));
}
export async function getAttempt(id: string): Promise<ExamAttempt | undefined> {
  return db.exam_attempts.get(id);
}

/** Start a real attempt from the exam's PUBLISHED version (snapshot frozen). */
export async function startAttempt(examId: string, user: UserWithRoles): Promise<string> {
  const exam = await db.exams.get(examId);
  if (!exam) throw new Error('המבחן לא נמצא');
  if (!exam.published) throw new Error('המבחן טרם פורסם');
  const now = nowIso();
  const attempt: ExamAttempt = {
    id: newId(), exam_id: examId, exam_version: exam.published.version, exam_title: exam.title,
    exam_snapshot: exam.published.questions, user_id: user.id, user_name: user.full_name, device_id: getDeviceId(),
    status: 'in_progress', answers: [], score: null, passed: null, started_at: now, updated_at: now,
  };
  await db.exam_attempts.add(attempt);
  return attempt.id;
}

/** Autosave answers during the exam (locked after submit). */
export async function saveAttemptAnswers(attemptId: string, answers: ExamAnswer[]): Promise<void> {
  const a = await db.exam_attempts.get(attemptId);
  if (!a) throw new Error('הניסיון לא נמצא');
  if (a.status !== 'in_progress') return; // locked
  await db.exam_attempts.update(attemptId, { answers, updated_at: nowIso() });
}

/** Submit: compute auto score; open questions move the attempt to review. */
export async function submitAttempt(attemptId: string): Promise<ExamAttempt> {
  const a = await db.exam_attempts.get(attemptId);
  if (!a) throw new Error('הניסיון לא נמצא');
  if (a.status !== 'in_progress') return a;
  const sc = scoreAttempt(a.exam_snapshot, a.answers);
  // Persist the computed auto awards back onto the answers.
  const answers = a.exam_snapshot.map((q) => {
    const ans = a.answers.find((x) => x.question_id === q.id) ?? { question_id: q.id };
    const ps = sc.per_question.find((p) => p.question_id === q.id)!;
    return { ...ans, auto_awarded: ps.needs_manual ? null : ps.awarded, needs_manual: ps.needs_manual };
  });
  const now = nowIso();
  const status: ExamAttempt['status'] = sc.needs_review ? 'pending_review' : 'graded';
  const patch = { answers, status, score: sc.score, passed: sc.passed, submitted_at: now, updated_at: now, graded_at: sc.needs_review ? null : now };
  await db.exam_attempts.update(attemptId, patch);
  return { ...a, ...patch } as ExamAttempt;
}

/** Grade one open question; finalizes the attempt once all open Qs are graded. */
export async function gradeOpenAnswer(attemptId: string, questionId: string, points: number, note: string, admin: UserWithRoles): Promise<ExamAttempt> {
  const a = await db.exam_attempts.get(attemptId);
  if (!a) throw new Error('הניסיון לא נמצא');
  const q = a.exam_snapshot.find((x) => x.id === questionId);
  if (!q || q.type !== 'open') throw new Error('שאלה פתוחה לא נמצאה');
  const capped = Math.max(0, Math.min(points, q.points));
  const answers = a.answers.map((x) => (x.question_id === questionId ? { ...x, manual_awarded: capped, manual_note: note, needs_manual: true } : x));
  // Ensure an answer row exists even if the examinee left it blank.
  if (!answers.some((x) => x.question_id === questionId)) answers.push({ question_id: questionId, manual_awarded: capped, manual_note: note, needs_manual: true });
  const sc = scoreAttempt(a.exam_snapshot, answers);
  const now = nowIso();
  const done = !sc.needs_review;
  const patch = { answers, score: sc.score, passed: sc.passed, status: done ? 'graded' : 'pending_review', graded_at: done ? now : null, graded_by_id: admin.id, graded_by_name: admin.full_name, updated_at: now } as Partial<ExamAttempt>;
  await db.exam_attempts.update(attemptId, patch);
  await logAudit({ user_id: admin.id, user_name: admin.full_name, action: 'EXAM_GRADE', entity_type: 'exam_attempt', entity_id: attemptId, field: questionId, new_value: String(capped) });
  return { ...a, ...patch } as ExamAttempt;
}
