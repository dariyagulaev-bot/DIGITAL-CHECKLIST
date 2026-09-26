import type { CategoryGroup } from './types';

export interface DefaultCategory {
  id: string;
  name: string;
  icon: string;
  group: CategoryGroup;
}

/** Stable ids so the default categories are identical on every device. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Income
  { id: 'inc-salary', name: 'משכורת', icon: 'briefcase', group: 'income' },
  { id: 'inc-partner', name: 'משכורת בן/בת זוג', icon: 'users', group: 'income' },
  { id: 'inc-extra', name: 'הכנסה נוספת', icon: 'plus', group: 'income' },
  { id: 'inc-refund', name: 'החזר כספי', icon: 'refund', group: 'income' },
  { id: 'inc-other', name: 'הכנסה אחרת', icon: 'dots', group: 'income' },

  // Fixed monthly expenses
  { id: 'fx-rent', name: 'שכר דירה', icon: 'key', group: 'fixed' },
  { id: 'fx-arnona', name: 'ארנונה', icon: 'building', group: 'fixed' },
  { id: 'fx-vaad', name: 'ועד בית', icon: 'house', group: 'fixed' },
  { id: 'fx-electric', name: 'חשמל', icon: 'bolt', group: 'fixed' },
  { id: 'fx-water', name: 'מים', icon: 'drop', group: 'fixed' },
  { id: 'fx-gas', name: 'גז', icon: 'flame', group: 'fixed' },
  { id: 'fx-internet', name: 'אינטרנט', icon: 'wifi', group: 'fixed' },
  { id: 'fx-phone', name: 'טלפון', icon: 'phone', group: 'fixed' },
  { id: 'fx-insurance', name: 'ביטוחים', icon: 'shield', group: 'fixed' },
  { id: 'fx-study', name: 'לימודים', icon: 'book', group: 'fixed' },
  { id: 'fx-subs', name: 'מנויים', icon: 'repeat', group: 'fixed' },
  { id: 'fx-loans', name: 'הלוואות', icon: 'bank', group: 'fixed' },
  { id: 'fx-other', name: 'קבועה אחרת', icon: 'dots', group: 'fixed' },

  // Variable expenses
  { id: 'var-food', name: 'אוכל וסופר', icon: 'cart', group: 'variable' },
  { id: 'var-rest', name: 'מסעדות', icon: 'cup', group: 'variable' },
  { id: 'var-car', name: 'דלק ורכב', icon: 'car', group: 'variable' },
  { id: 'var-shop', name: 'קניות', icon: 'bag', group: 'variable' },
  { id: 'var-fun', name: 'בילויים', icon: 'ticket', group: 'variable' },
  { id: 'var-health', name: 'בריאות', icon: 'health', group: 'variable' },
  { id: 'var-study', name: 'לימודים', icon: 'book', group: 'variable' },
  { id: 'var-home', name: 'בית', icon: 'house', group: 'variable' },
  { id: 'var-pets', name: 'חיות', icon: 'paw', group: 'variable' },
  { id: 'var-care', name: 'טיפוח', icon: 'care', group: 'variable' },
  { id: 'var-other', name: 'אחר', icon: 'dots', group: 'variable' }
];

export const LOCAL_HOUSEHOLD_ID = 'local';
