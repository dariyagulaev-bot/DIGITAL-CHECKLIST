import { describe, expect, it } from 'vitest';
import { goalProgress, summarizeMonth } from './budget';
import type { Goal, Transaction } from '../data/types';

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: 't' + n++, householdId: 'h', createdAt: 0, updatedAt: 0,
  kind: 'expense', amount: 0, note: '', date: '2026-09-10', month: '2026-09', fixed: false, ...p
});
const goal = (p: Partial<Goal>): Goal => ({
  id: 'g' + n++, householdId: 'h', createdAt: 0, updatedAt: 0,
  name: 'g', target: 0, startingAmount: 0, monthly: 0, order: 0, ...p
});

describe('summarizeMonth', () => {
  it('matches the planning example: 18,000 − 7,000 − 2,000 = 9,000', () => {
    const txs = [
      tx({ kind: 'income', amount: 1_800_000, fixed: true }),
      tx({ amount: 700_000, fixed: true, categoryId: 'fx-rent' }),
      tx({ amount: 524_000, categoryId: 'var-food' })
    ];
    const goals = goalProgress([goal({ target: 4_000_000, monthly: 200_000 })], [], '2026-09');
    const s = summarizeMonth({ month: '2026-09', currentMonth: '2026-09', txs, goals });
    expect(s.freeBudget).toBe(900_000);
    expect(s.left).toBe(376_000);
    expect(s.expenses).toBe(1_224_000);
    expect(Math.round(s.usedRatio * 100)).toBe(58);
  });

  it('counts a deposit once: the planned reserve is replaced by the actual deposit', () => {
    const g = goal({ target: 1_000_000, monthly: 100_000 });
    const deposit = tx({ kind: 'saving', amount: 150_000, goalId: g.id });
    const txs = [tx({ kind: 'income', amount: 1_000_000 }), deposit];
    const s = summarizeMonth({ month: '2026-09', currentMonth: '2026-09', txs, goals: goalProgress([g], [deposit], '2026-09') });
    expect(s.saved).toBe(150_000);
    expect(s.reservedSavings).toBe(150_000);
    expect(s.left).toBe(850_000);
  });

  it('uses only actual deposits for past months', () => {
    const g = goal({ target: 1_000_000, monthly: 100_000 });
    const txs = [tx({ kind: 'income', amount: 500_000, month: '2026-08' })];
    const s = summarizeMonth({ month: '2026-08', currentMonth: '2026-09', txs, goals: goalProgress([g], [], '2026-08') });
    expect(s.reservedSavings).toBe(0);
    expect(s.net).toBe(500_000);
  });

  it('does not reserve money for a goal that is already reached', () => {
    const g = goal({ target: 100_000, startingAmount: 100_000, monthly: 50_000 });
    const s = summarizeMonth({ month: '2026-09', currentMonth: '2026-09', txs: [], goals: goalProgress([g], [], '2026-09') });
    expect(s.reservedSavings).toBe(0);
  });
});

describe('goalProgress', () => {
  it('computes saved, remaining and months left', () => {
    const g = goal({ target: 4_000_000, startingAmount: 2_350_000, monthly: 100_000 });
    const d = tx({ kind: 'saving', amount: 100_000, goalId: g.id });
    const [p] = goalProgress([g], [d], '2026-09');
    expect(p.saved).toBe(2_450_000);
    expect(p.remaining).toBe(1_550_000);
    expect(p.monthsLeft).toBe(16);
    expect(p.depositedThisMonth).toBe(100_000);
  });
});
