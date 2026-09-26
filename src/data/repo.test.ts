import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BudgetDB } from './db';
import { Repository, forecastRecurring } from './repo';
import { addMonths, currentMonth } from '../lib/format';

let repo: Repository;
beforeEach(async () => {
  repo = new Repository(new BudgetDB('test-' + Math.random()));
  await repo.init();
});

describe('recurring items', () => {
  it('adds a fixed item to the current month once, and not again after it is deleted', async () => {
    const cur = currentMonth();
    await repo.addRecurring({ kind: 'expense', name: 'שכר דירה', amount: 500_000, categoryId: 'fx-rent', day: 1 }, true);
    await repo.ensureMonth(cur);
    let txs = await repo.monthTransactions(cur);
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ fixed: true, amount: 500_000, date: `${cur}-01` });

    await repo.deleteTransaction(txs[0].id);
    await repo.ensureMonth(cur);
    txs = await repo.monthTransactions(cur);
    expect(txs).toHaveLength(0);
  });

  it('editing one month does not change the template', async () => {
    const cur = currentMonth();
    const id = await repo.addRecurring({ kind: 'expense', name: 'חשמל', amount: 40_000, categoryId: 'fx-electric', day: 15 }, true);
    const [t] = await repo.monthTransactions(cur);
    await repo.updateTransaction(t.id, { amount: 61_000 });
    const [r] = await repo.recurring();
    expect(r.id).toBe(id);
    expect(r.amount).toBe(40_000);
    expect(forecastRecurring(addMonths(cur, 1), [r])[0].amount).toBe(40_000);
  });

  it('starts next month when not included in the current month', async () => {
    await repo.addRecurring({ kind: 'income', name: 'משכורת', amount: 1_000_000, categoryId: 'inc-salary', day: 10 }, false);
    await repo.ensureMonth(currentMonth());
    expect(await repo.monthTransactions(currentMonth())).toHaveLength(0);
    const [r] = await repo.recurring();
    expect(forecastRecurring(addMonths(currentMonth(), 1), [r])).toHaveLength(1);
  });
});

describe('backup', () => {
  it('restores exactly what was exported', async () => {
    await repo.addTransaction({ kind: 'expense', amount: 31_200, note: 'שופרסל', date: `${currentMonth()}-05`, fixed: false, categoryId: 'var-food' });
    await repo.addGoal({ name: 'חופשה', target: 1_200_000, startingAmount: 620_000, monthly: 50_000 });
    const backup = await repo.exportAll();
    await repo.clearAll();
    expect(await repo.allTransactions()).toHaveLength(0);
    await repo.importAll(JSON.parse(JSON.stringify(backup)));
    expect(await repo.allTransactions()).toHaveLength(1);
    expect((await repo.goals())[0].name).toBe('חופשה');
    expect((await repo.categories()).length).toBeGreaterThan(20);
  });

  it('rejects files that are not a backup', async () => {
    await expect(repo.importAll({} as never)).rejects.toThrow();
  });
});
