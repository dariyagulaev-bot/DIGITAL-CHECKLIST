import { describe, expect, it } from 'vitest';
import { scoreAnswer, scoreAttempt } from './exams';
import type { ExamAnswer, ExamQuestionSnapshot } from '@/types';

const single = (id: string, points: number, correct: string): ExamQuestionSnapshot => ({
  id, sort_order: 0, type: 'single', text: 'q', points,
  config: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correct_option_ids: [correct] },
});
const multi = (id: string, points: number, correct: string[], partial = false): ExamQuestionSnapshot => ({
  id, sort_order: 0, type: 'multi', text: 'q', points,
  config: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }], correct_option_ids: correct, multi_partial: partial },
});
const image = (id: string, points: number, names: string[], partial = true): ExamQuestionSnapshot => ({
  id, sort_order: 0, type: 'image_match', text: 'q', points,
  config: { image: 'data:,x', markers: names.map((n, i) => ({ id: 'm' + i, x: 0.1 * i, y: 0.2, component_name: n })), image_partial: partial },
});
const open = (id: string, points: number): ExamQuestionSnapshot => ({ id, sort_order: 0, type: 'open', text: 'q', points, config: {} });

describe('exam scoring — single / multi', () => {
  it('single: correct → full, wrong → zero', () => {
    expect(scoreAnswer(single('q', 10, 'a'), { question_id: 'q', selected_option_ids: ['a'] }).awarded).toBe(10);
    expect(scoreAnswer(single('q', 10, 'a'), { question_id: 'q', selected_option_ids: ['b'] }).awarded).toBe(0);
    expect(scoreAnswer(single('q', 10, 'a'), undefined).awarded).toBe(0);
  });
  it('multi: default all-or-nothing', () => {
    const q = multi('q', 10, ['a', 'b']);
    expect(scoreAnswer(q, { question_id: 'q', selected_option_ids: ['a', 'b'] }).awarded).toBe(10);
    expect(scoreAnswer(q, { question_id: 'q', selected_option_ids: ['a'] }).awarded).toBe(0); // incomplete
    expect(scoreAnswer(q, { question_id: 'q', selected_option_ids: ['a', 'b', 'c'] }).awarded).toBe(0); // extra wrong
  });
  it('multi: partial credit when enabled, floored at 0', () => {
    const q = multi('q', 10, ['a', 'b'], true);
    expect(scoreAnswer(q, { question_id: 'q', selected_option_ids: ['a'] }).awarded).toBe(5); // 1/2
    expect(scoreAnswer(q, { question_id: 'q', selected_option_ids: ['a', 'c'] }).awarded).toBe(0); // 1 right - 1 wrong = 0
  });
});

describe('exam scoring — image identification', () => {
  it('partial credit by correct matches', () => {
    const q = image('q', 12, ['מתח', 'זרם', 'הארקה']); // 3 markers
    const a: ExamAnswer = { question_id: 'q', matches: { m0: 'מתח', m1: 'זרם', m2: 'שגוי' } };
    expect(scoreAnswer(q, a).awarded).toBe(8); // 2/3 * 12
    expect(scoreAnswer(q, a).correct_matches).toBe(2);
  });
  it('all-or-nothing when partial disabled', () => {
    const q = image('q', 12, ['מתח', 'זרם'], false);
    expect(scoreAnswer(q, { question_id: 'q', matches: { m0: 'מתח' } }).awarded).toBe(0);
    expect(scoreAnswer(q, { question_id: 'q', matches: { m0: 'מתח', m1: 'זרם' } }).awarded).toBe(12);
  });
});

describe('exam scoring — pass threshold & open review', () => {
  it('79 → fail, 80 → pass, 100 → pass (normalized to 100)', () => {
    // Build a 100-point exam from 10 single questions worth 10 each.
    const qs = Array.from({ length: 10 }, (_, i) => single('q' + i, 10, 'a'));
    const ans = (n: number): ExamAnswer[] => qs.map((q, i) => ({ question_id: q.id, selected_option_ids: [i < n ? 'a' : 'b'] }));
    expect(scoreAttempt(qs, ans(8)).score).toBe(80); // 8/10 correct → 80
    expect(scoreAttempt(qs, ans(8)).passed).toBe(true);
    // 79: make it a weighted case — 79/100.
    const weighted = [single('q1', 79, 'a'), single('q2', 21, 'a')];
    const s79 = scoreAttempt(weighted, [{ question_id: 'q1', selected_option_ids: ['a'] }, { question_id: 'q2', selected_option_ids: ['b'] }]);
    expect(s79.score).toBe(79);
    expect(s79.passed).toBe(false);
    expect(scoreAttempt(qs, ans(10)).score).toBe(100);
    expect(scoreAttempt(qs, ans(10)).passed).toBe(true);
  });

  it('open question keeps the attempt in review (no score/pass yet)', () => {
    const qs = [single('q1', 50, 'a'), open('q2', 50)];
    const s = scoreAttempt(qs, [{ question_id: 'q1', selected_option_ids: ['a'] }]);
    expect(s.needs_review).toBe(true);
    expect(s.score).toBeNull();
    expect(s.passed).toBeNull();
    // Once graded, it finalizes.
    const graded = scoreAttempt(qs, [{ question_id: 'q1', selected_option_ids: ['a'] }, { question_id: 'q2', manual_awarded: 30, needs_manual: true }]);
    expect(graded.needs_review).toBe(false);
    expect(graded.score).toBe(80); // (50+30)/100
    expect(graded.passed).toBe(true);
  });
});
