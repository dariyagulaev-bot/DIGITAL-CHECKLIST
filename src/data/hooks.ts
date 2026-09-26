import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { forecastRecurring, repo } from './repo';
import type { Category, MonthKey, Transaction } from './types';
import { goalProgress, summarizeMonth, type GoalProgress, type MonthSummary } from '../domain/budget';
import { addMonths, currentMonth } from '../lib/format';

export function useCategories() {
  const cats = useLiveQuery(() => repo.categories(), []);
  const byId = useMemo(() => new Map((cats ?? []).map(c => [c.id, c] as [string, Category])), [cats]);
  return { cats: cats ?? [], byId, ready: !!cats };
}

export function useRecurring() {
  return useLiveQuery(() => repo.recurring(), []);
}

export function useGoals(month: MonthKey): GoalProgress[] | undefined {
  const goals = useLiveQuery(() => repo.goals(), []);
  const saving = useLiveQuery(() => repo.savingTransactions(), []);
  return useMemo(() => (goals && saving ? goalProgress(goals, saving, month) : undefined), [goals, saving, month]);
}

/** Transactions of a month, including forecast fixed items for future months. */
export function useMonthTransactions(month: MonthKey): Transaction[] | undefined {
  const cur = currentMonth();
  useEffect(() => { repo.ensureMonth(month); }, [month]);
  const txs = useLiveQuery(() => repo.monthTransactions(month), [month]);
  const templates = useLiveQuery(() => (month > cur ? repo.recurring() : Promise.resolve([])), [month, cur]);
  return useMemo(() => {
    if (!txs || !templates) return undefined;
    if (month <= cur) return txs;
    const realIds = new Set(txs.map(t => t.recurringId).filter(Boolean));
    return [...txs, ...forecastRecurring(month, templates).filter(f => !realIds.has(f.recurringId))];
  }, [txs, templates, month, cur]);
}

export function useMonthSummary(month: MonthKey) {
  const txs = useMonthTransactions(month);
  const goals = useGoals(month);
  const summary: MonthSummary | undefined = useMemo(
    () => (txs && goals ? summarizeMonth({ month, currentMonth: currentMonth(), txs, goals }) : undefined),
    [txs, goals, month]
  );
  return { txs, goals, summary };
}

export interface MonthPoint {
  month: MonthKey;
  income: number;
  expenses: number;
  saved: number;
  net: number;
}

/** Totals for the `count` months ending at `month` (oldest first). */
export function useHistory(month: MonthKey, count: number): MonthPoint[] | undefined {
  const from = addMonths(month, -(count - 1));
  const cur = currentMonth();
  const txs = useLiveQuery(() => repo.rangeTransactions(from, month), [from, month]);
  const templates = useLiveQuery(() => (month > cur ? repo.recurring() : Promise.resolve([])), [month, cur]);
  return useMemo(() => {
    if (!txs || !templates) return undefined;
    const points: MonthPoint[] = [];
    for (let i = 0; i < count; i++) {
      const m = addMonths(from, i);
      let list = txs.filter(t => t.month === m);
      if (m > cur) {
        const realIds = new Set(list.map(t => t.recurringId).filter(Boolean));
        list = [...list, ...forecastRecurring(m, templates).filter(f => !realIds.has(f.recurringId))];
      }
      let income = 0, expenses = 0, saved = 0;
      for (const t of list) {
        if (t.kind === 'income') income += t.amount;
        else if (t.kind === 'expense') expenses += t.amount;
        else saved += t.amount;
      }
      points.push({ month: m, income, expenses, saved, net: income - expenses - saved });
    }
    return points;
  }, [txs, templates, from, count, cur]);
}
