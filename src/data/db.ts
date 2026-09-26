import Dexie, { type EntityTable } from 'dexie';
import type { Category, Goal, Household, MonthMeta, Recurring, Transaction } from './types';

/**
 * Local database (IndexedDB). Only the repository (repo.ts) talks to it directly,
 * so it can later be backed by, or synced with, a cloud service.
 */
export class BudgetDB extends Dexie {
  households!: EntityTable<Household, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  recurring!: EntityTable<Recurring, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  months!: EntityTable<MonthMeta, 'id'>;

  constructor(name = 'home-budget') {
    super(name);
    this.version(1).stores({
      households: 'id',
      categories: 'id, householdId, group',
      transactions: 'id, householdId, [householdId+month], [householdId+kind], goalId, recurringId, updatedAt',
      recurring: 'id, householdId',
      goals: 'id, householdId',
      months: 'id, householdId'
    });
  }
}

export const db = new BudgetDB();
