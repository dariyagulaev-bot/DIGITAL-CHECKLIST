import type { Agorot, Goal, MonthKey, Transaction } from '../data/types';

export interface GoalProgress {
  goal: Goal;
  saved: Agorot;
  remaining: Agorot;
  pct: number;
  depositedThisMonth: Agorot;
  /** Months until the target at the planned monthly deposit; null if no plan, 0 if reached. */
  monthsLeft: number | null;
}

export interface MonthSummary {
  income: Agorot;
  fixed: Agorot;
  variable: Agorot;
  expenses: Agorot;
  /** Actually moved to savings this month. */
  saved: Agorot;
  /** Planned monthly deposits of the active goals. */
  plannedSavings: Agorot;
  /**
   * Money set aside for savings this month: for each goal the larger of the plan
   * and what was deposited. For past months this equals `saved`.
   */
  reservedSavings: Agorot;
  /** income − fixed − reserved savings: what is available for variable spending. */
  freeBudget: Agorot;
  /** freeBudget − variable spending. */
  left: Agorot;
  /** 0..n share of the free budget already spent (can exceed 1). */
  usedRatio: number;
  byCategory: Map<string, Agorot>;
  /** Actual result: income − expenses − saved. */
  net: Agorot;
}

export function goalProgress(goals: Goal[], savingTxs: Transaction[], month: MonthKey): GoalProgress[] {
  return goals.map(goal => {
    const txs = savingTxs.filter(t => t.goalId === goal.id);
    const saved = goal.startingAmount + txs.reduce((s, t) => s + t.amount, 0);
    const depositedThisMonth = txs.filter(t => t.month === month).reduce((s, t) => s + t.amount, 0);
    const remaining = Math.max(0, goal.target - saved);
    const pct = goal.target > 0 ? Math.min(1, saved / goal.target) : 0;
    const monthsLeft = remaining === 0 ? 0 : goal.monthly > 0 ? Math.ceil(remaining / goal.monthly) : null;
    return { goal, saved, remaining, pct, depositedThisMonth, monthsLeft };
  });
}

export function summarizeMonth(opts: {
  month: MonthKey;
  currentMonth: MonthKey;
  txs: Transaction[];
  goals: GoalProgress[];
}): MonthSummary {
  const { month, currentMonth, txs, goals } = opts;
  let income = 0, fixed = 0, variable = 0, saved = 0;
  const byCategory = new Map<string, Agorot>();
  for (const t of txs) {
    if (t.kind === 'income') income += t.amount;
    else if (t.kind === 'saving') saved += t.amount;
    else {
      if (t.fixed) fixed += t.amount; else variable += t.amount;
      const k = t.categoryId ?? 'unknown';
      byCategory.set(k, (byCategory.get(k) ?? 0) + t.amount);
    }
  }

  const monthEnd = monthEndTime(month);
  const activeGoals = goals.filter(g => g.goal.createdAt <= monthEnd);
  const plannedSavings = activeGoals
    .filter(g => g.remaining > 0 || g.depositedThisMonth > 0)
    .reduce((s, g) => s + g.goal.monthly, 0);

  let reservedSavings = saved;
  if (month >= currentMonth) {
    const goalIds = new Set(activeGoals.map(g => g.goal.id));
    const planned = activeGoals.reduce((s, g) => {
      // A goal reached before this month's deposit needs no reserve.
      const plan = g.remaining + g.depositedThisMonth > 0 ? Math.min(g.goal.monthly, g.remaining + g.depositedThisMonth) : 0;
      return s + Math.max(plan, g.depositedThisMonth);
    }, 0);
    const other = txs.filter(t => t.kind === 'saving' && (!t.goalId || !goalIds.has(t.goalId))).reduce((s, t) => s + t.amount, 0);
    reservedSavings = planned + other;
  }

  const expenses = fixed + variable;
  const freeBudget = income - fixed - reservedSavings;
  const left = freeBudget - variable;
  const usedRatio = freeBudget > 0 ? variable / freeBudget : variable > 0 ? 1 : 0;
  return {
    income, fixed, variable, expenses, saved, plannedSavings, reservedSavings,
    freeBudget, left, usedRatio, byCategory, net: income - expenses - saved
  };
}

function monthEndTime(month: MonthKey) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 1).getTime() - 1;
}
