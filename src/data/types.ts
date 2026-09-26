/**
 * Data model.
 *
 * Every stored record carries the fields a future sync layer needs:
 * - `id`          a globally unique id (UUID), safe to create offline on any device
 * - `householdId` the budget the record belongs to (a shared budget = one household, many users)
 * - `updatedAt`   last-write timestamp, used for conflict resolution when syncing
 * - `deletedAt`   soft delete, so deletions can be synced to other devices
 *
 * Amounts are stored as integer agorot (1 ₪ = 100) to avoid floating-point errors.
 */

export type Agorot = number;

/** 'YYYY-MM' */
export type MonthKey = string;
/** 'YYYY-MM-DD' */
export type DateKey = string;

export interface SyncFields {
  id: string;
  householdId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export type TxKind = 'income' | 'expense' | 'saving';
export type CategoryGroup = 'income' | 'fixed' | 'variable';

export interface Category extends SyncFields {
  name: string;
  icon: string;
  group: CategoryGroup;
  /** Monthly budget for variable categories. 0 = no budget set. */
  budget: Agorot;
  order: number;
}

export interface Transaction extends SyncFields {
  kind: TxKind;
  amount: Agorot;
  /** Category for income/expense. */
  categoryId?: string;
  /** Savings goal for kind === 'saving'. */
  goalId?: string;
  note: string;
  date: DateKey;
  /** Derived from `date`, indexed for fast month queries. */
  month: MonthKey;
  /** Fixed monthly item (rent, salary...). */
  fixed: boolean;
  /** Set when the transaction was generated from a recurring template. */
  recurringId?: string;
}

export interface Recurring extends SyncFields {
  kind: 'income' | 'expense';
  name: string;
  amount: Agorot;
  categoryId: string;
  /** Day of month, 1-28. */
  day: number;
  /** First month this template applies to. */
  startMonth: MonthKey;
  active: boolean;
}

export interface Goal extends SyncFields {
  name: string;
  target: Agorot;
  /** Amount saved before the goal was tracked in the app (or manual corrections). */
  startingAmount: Agorot;
  /** Planned monthly deposit. */
  monthly: Agorot;
  order: number;
}

/** Per-month bookkeeping: which recurring templates were already added to this month. */
export interface MonthMeta {
  /** `${householdId}:${month}` */
  id: string;
  householdId: string;
  month: MonthKey;
  appliedRecurring: string[];
  updatedAt: number;
}

export interface Household {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}
