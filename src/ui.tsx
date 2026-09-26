import { createContext, useContext } from 'react';
import type { Goal, MonthKey, Recurring, Transaction, TxKind } from './data/types';
import type { ConfirmOptions } from './components/common';

export type Route = 'home' | 'tx' | 'savings' | 'more' | 'more/recurring' | 'more/summary' | 'more/budgets' | 'more/backup';

export interface TxPreset {
  kind?: TxKind;
  goalId?: string;
  amount?: number;
}

export interface UI {
  month: MonthKey;
  setMonth: (m: MonthKey) => void;
  route: Route;
  go: (r: Route) => void;
  back: () => void;
  addTx: (preset?: TxPreset) => void;
  editTx: (t: Transaction) => void;
  editGoal: (g?: Goal) => void;
  editRecurring: (r?: Recurring, kind?: 'income' | 'expense') => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (msg: string) => void;
}

export const UIContext = createContext<UI | null>(null);

export function useUI(): UI {
  const ui = useContext(UIContext);
  if (!ui) throw new Error('UIContext missing');
  return ui;
}
