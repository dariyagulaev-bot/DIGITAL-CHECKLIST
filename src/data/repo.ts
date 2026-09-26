import { BudgetDB, db as defaultDb } from './db';
import { DEFAULT_CATEGORIES, LOCAL_HOUSEHOLD_ID } from './defaults';
import type { Agorot, Category, DateKey, Goal, MonthKey, MonthMeta, Recurring, Transaction } from './types';
import { addMonths, currentMonth, daysInMonth, monthOfDate, pad } from '../lib/format';

export type NewTransaction = Omit<Transaction, keyof import('./types').SyncFields | 'month'>;
export type NewRecurring = Pick<Recurring, 'kind' | 'name' | 'amount' | 'categoryId' | 'day'>;
export type NewGoal = Pick<Goal, 'name' | 'target' | 'startingAmount' | 'monthly'>;

export interface BackupFile {
  app: 'home-budget';
  version: 1;
  exportedAt: string;
  householdId: string;
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
  goals: Goal[];
  months: MonthMeta[];
}

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);

const alive = <T extends { deletedAt?: number }>(r: T) => !r.deletedAt;

/**
 * The only entry point to stored data. Screens never touch the database directly.
 * To add accounts / cloud sync later, keep this API and add a sync step that
 * pushes records with a newer `updatedAt` and pulls remote changes.
 */
export class Repository {
  constructor(readonly db: BudgetDB, readonly householdId: string = LOCAL_HOUSEHOLD_ID) {}

  private stamp() {
    const now = Date.now();
    return { id: uuid(), householdId: this.householdId, createdAt: now, updatedAt: now };
  }

  // ---------- setup ----------

  async init() {
    const now = Date.now();
    await this.db.transaction('rw', this.db.households, this.db.categories, async () => {
      if (!(await this.db.households.get(this.householdId))) {
        await this.db.households.add({ id: this.householdId, name: 'הבית שלי', createdAt: now, updatedAt: now });
      }
      const existing = new Set((await this.db.categories.where('householdId').equals(this.householdId).toArray()).map(c => c.id));
      const missing = DEFAULT_CATEGORIES.filter(c => !existing.has(c.id)).map((c, i) => ({
        ...c, householdId: this.householdId, budget: 0, order: i, createdAt: now, updatedAt: now
      }));
      if (missing.length) await this.db.categories.bulkAdd(missing);
    });
  }

  // ---------- categories ----------

  async categories(): Promise<Category[]> {
    const all = await this.db.categories.where('householdId').equals(this.householdId).toArray();
    return all.filter(alive).sort((a, b) => a.order - b.order);
  }

  async setCategoryBudget(id: string, budget: Agorot) {
    await this.db.categories.update(id, { budget, updatedAt: Date.now() });
  }

  // ---------- transactions ----------

  async monthTransactions(month: MonthKey): Promise<Transaction[]> {
    const rows = await this.db.transactions.where('[householdId+month]').equals([this.householdId, month]).toArray();
    return rows.filter(alive);
  }

  async rangeTransactions(from: MonthKey, to: MonthKey): Promise<Transaction[]> {
    const rows = await this.db.transactions
      .where('[householdId+month]')
      .between([this.householdId, from], [this.householdId, to], true, true)
      .toArray();
    return rows.filter(alive);
  }

  async savingTransactions(): Promise<Transaction[]> {
    const rows = await this.db.transactions.where('[householdId+kind]').equals([this.householdId, 'saving']).toArray();
    return rows.filter(alive);
  }

  async allTransactions(): Promise<Transaction[]> {
    return (await this.db.transactions.where('householdId').equals(this.householdId).toArray()).filter(alive);
  }

  async addTransaction(t: NewTransaction): Promise<string> {
    const row: Transaction = { ...t, ...this.stamp(), month: monthOfDate(t.date) };
    await this.db.transactions.add(row);
    return row.id;
  }

  async updateTransaction(id: string, patch: Partial<NewTransaction>) {
    const extra: Partial<Transaction> = { updatedAt: Date.now() };
    if (patch.date) extra.month = monthOfDate(patch.date);
    await this.db.transactions.update(id, { ...patch, ...extra });
  }

  async deleteTransaction(id: string) {
    const now = Date.now();
    await this.db.transactions.update(id, { deletedAt: now, updatedAt: now });
  }

  // ---------- recurring (fixed monthly income / expenses) ----------

  async recurring(): Promise<Recurring[]> {
    const all = await this.db.recurring.where('householdId').equals(this.householdId).toArray();
    return all.filter(alive).sort((a, b) => a.day - b.day || a.createdAt - b.createdAt);
  }

  /**
   * Adds a template. With `includeCurrentMonth` it also appears in the current month;
   * otherwise it starts next month. Earlier months are never changed.
   */
  async addRecurring(r: NewRecurring, includeCurrentMonth: boolean): Promise<string> {
    const cur = currentMonth();
    const row: Recurring = {
      ...r, ...this.stamp(), active: true,
      startMonth: includeCurrentMonth ? cur : addMonths(cur, 1)
    };
    await this.db.recurring.add(row);
    if (includeCurrentMonth) await this.ensureMonth(cur);
    return row.id;
  }

  /** Updates a template. Future months use the new values; optionally also this month's entry. */
  async updateRecurring(id: string, patch: Partial<NewRecurring & { active: boolean }>, alsoCurrentMonth: boolean) {
    const now = Date.now();
    await this.db.transaction('rw', this.db.recurring, this.db.transactions, async () => {
      await this.db.recurring.update(id, { ...patch, updatedAt: now });
      if (!alsoCurrentMonth) return;
      const r = await this.db.recurring.get(id);
      if (!r) return;
      const cur = currentMonth();
      const txs = (await this.db.transactions.where('recurringId').equals(id).toArray()).filter(t => alive(t) && t.month === cur);
      for (const t of txs) {
        await this.db.transactions.update(t.id, {
          amount: r.amount, note: r.name, categoryId: r.categoryId,
          date: recurringDate(cur, r.day), updatedAt: now
        });
      }
    });
  }

  async deleteRecurring(id: string) {
    const now = Date.now();
    await this.db.recurring.update(id, { deletedAt: now, updatedAt: now, active: false });
  }

  /**
   * Adds this month's entries for every recurring template that was not yet added.
   * Runs only for months up to the current one; later months are shown as a forecast
   * (see forecastRecurring) so template changes still apply to them.
   * Entries the user deleted are not re-added.
   */
  async ensureMonth(month: MonthKey) {
    if (month > currentMonth()) return;
    await this.db.transaction('rw', this.db.recurring, this.db.transactions, this.db.months, async () => {
      const metaId = `${this.householdId}:${month}`;
      const meta: MonthMeta = (await this.db.months.get(metaId)) ??
        { id: metaId, householdId: this.householdId, month, appliedRecurring: [], updatedAt: 0 };
      const applied = new Set(meta.appliedRecurring);
      const templates = (await this.db.recurring.where('householdId').equals(this.householdId).toArray())
        .filter(r => alive(r) && r.active && r.startMonth <= month && !applied.has(r.id));
      if (!templates.length) return;
      const rows: Transaction[] = templates.map(r => ({
        ...this.stamp(), kind: r.kind, amount: r.amount, categoryId: r.categoryId,
        note: r.name, date: recurringDate(month, r.day), month, fixed: true, recurringId: r.id
      }));
      await this.db.transactions.bulkAdd(rows);
      templates.forEach(r => applied.add(r.id));
      await this.db.months.put({ ...meta, appliedRecurring: [...applied], updatedAt: Date.now() });
    });
  }

  /** Adds fixed items to every month from the earliest template up to the current month. */
  async ensureUpToCurrent() {
    const templates = (await this.recurring()).filter(r => r.active);
    if (!templates.length) return;
    const cur = currentMonth();
    let m = templates.reduce((min, r) => (r.startMonth < min ? r.startMonth : min), cur);
    for (let i = 0; m <= cur && i < 240; i++, m = addMonths(m, 1)) await this.ensureMonth(m);
  }

  // ---------- goals ----------

  async goals(): Promise<Goal[]> {
    const all = await this.db.goals.where('householdId').equals(this.householdId).toArray();
    return all.filter(alive).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  }

  async addGoal(g: NewGoal): Promise<string> {
    const order = (await this.goals()).length;
    const row: Goal = { ...g, ...this.stamp(), order };
    await this.db.goals.add(row);
    return row.id;
  }

  async updateGoal(id: string, patch: Partial<NewGoal>) {
    await this.db.goals.update(id, { ...patch, updatedAt: Date.now() });
  }

  /** Deleting a goal keeps its past deposits in the monthly history. */
  async deleteGoal(id: string) {
    const now = Date.now();
    await this.db.goals.update(id, { deletedAt: now, updatedAt: now });
  }

  // ---------- backup ----------

  async exportAll(): Promise<BackupFile> {
    const h = this.householdId;
    const [categories, transactions, recurring, goals, months] = await Promise.all([
      this.db.categories.where('householdId').equals(h).toArray(),
      this.db.transactions.where('householdId').equals(h).toArray(),
      this.db.recurring.where('householdId').equals(h).toArray(),
      this.db.goals.where('householdId').equals(h).toArray(),
      this.db.months.where('householdId').equals(h).toArray()
    ]);
    return { app: 'home-budget', version: 1, exportedAt: new Date().toISOString(), householdId: h, categories, transactions, recurring, goals, months };
  }

  /** Replaces all data with the backup's content. */
  async importAll(data: BackupFile) {
    if (data?.app !== 'home-budget' || !Array.isArray(data.transactions)) {
      throw new Error('הקובץ אינו גיבוי של תקציב הבית');
    }
    const h = this.householdId;
    const own = <T extends { householdId: string }>(rows: T[] = []) => rows.map(r => ({ ...r, householdId: h }));
    const months = (data.months ?? []).map(m => ({ ...m, householdId: h, id: `${h}:${m.month}` }));
    await this.db.transaction('rw', [this.db.categories, this.db.transactions, this.db.recurring, this.db.goals, this.db.months], async () => {
      await this.clearTables();
      await this.db.categories.bulkPut(own(data.categories));
      await this.db.transactions.bulkPut(own(data.transactions));
      await this.db.recurring.bulkPut(own(data.recurring));
      await this.db.goals.bulkPut(own(data.goals));
      await this.db.months.bulkPut(months);
    });
    await this.init();
  }

  async clearAll() {
    await this.db.transaction('rw', [this.db.categories, this.db.transactions, this.db.recurring, this.db.goals, this.db.months], () => this.clearTables());
    await this.init();
  }

  private async clearTables() {
    const h = this.householdId;
    await Promise.all([
      this.db.categories.where('householdId').equals(h).delete(),
      this.db.transactions.where('householdId').equals(h).delete(),
      this.db.recurring.where('householdId').equals(h).delete(),
      this.db.goals.where('householdId').equals(h).delete(),
      this.db.months.where('householdId').equals(h).delete()
    ]);
  }
}

export function recurringDate(month: MonthKey, day: number): DateKey {
  return `${month}-${pad(Math.min(day, daysInMonth(month)))}`;
}

/** Forecast entries for a future month, built from the active templates. Not stored. */
export function forecastRecurring(month: MonthKey, templates: Recurring[]): Transaction[] {
  return templates
    .filter(r => r.active && !r.deletedAt && r.startMonth <= month)
    .map(r => ({
      id: `forecast:${r.id}:${month}`, householdId: r.householdId, createdAt: 0, updatedAt: 0,
      kind: r.kind, amount: r.amount, categoryId: r.categoryId, note: r.name,
      date: recurringDate(month, r.day), month, fixed: true, recurringId: r.id
    }));
}

export const isForecast = (t: Transaction) => t.id.startsWith('forecast:');

export const repo = new Repository(defaultDb);
