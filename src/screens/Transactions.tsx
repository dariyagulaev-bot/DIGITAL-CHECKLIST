import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../components/Icon';
import { Empty, Money, MonthSwitcher } from '../components/common';
import { useCategories, useGoals, useMonthTransactions } from '../data/hooks';
import { isForecast, repo } from '../data/repo';
import type { Transaction } from '../data/types';
import { dayLabel, monthLabel, shekels } from '../lib/format';
import { useUI } from '../ui';

type Filter = 'all' | 'expense' | 'income' | 'saving' | 'fixed';
const FILTERS: [Filter, string][] = [['all', 'הכל'], ['expense', 'הוצאות'], ['income', 'הכנסות'], ['saving', 'חיסכון'], ['fixed', 'קבועות']];

export function Transactions() {
  const ui = useUI();
  const monthTxs = useMonthTransactions(ui.month);
  const { cats, byId } = useCategories();
  const goals = useGoals(ui.month);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [cat, setCat] = useState('');
  const [everywhere, setEverywhere] = useState(false);
  const allTxs = useLiveQuery(() => (everywhere ? repo.allTransactions() : Promise.resolve(null)), [everywhere]);

  const goalName = (id?: string) => goals?.find(g => g.goal.id === id)?.goal.name ?? 'חיסכון';
  const title = (t: Transaction) => t.note || (t.kind === 'saving' ? goalName(t.goalId) : byId.get(t.categoryId ?? '')?.name) || 'ללא תיאור';

  const source = everywhere && allTxs ? allTxs : monthTxs;
  const list = useMemo(() => {
    if (!source) return [];
    const needle = q.trim().toLowerCase();
    return source
      .filter(t => filter === 'all' || (filter === 'fixed' ? t.fixed : t.kind === filter))
      .filter(t => !cat || t.categoryId === cat)
      .filter(t => {
        if (!needle) return true;
        const catName = t.kind === 'saving' ? goalName(t.goalId) : byId.get(t.categoryId ?? '')?.name ?? '';
        return `${t.note} ${catName} ${shekels(t.amount)} ${t.amount / 100}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  }, [source, q, filter, cat, byId, goals]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [list]);

  const totalOut = list.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalIn = list.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const catOptions = cats.filter(c => (filter === 'income' ? c.group === 'income' : filter === 'fixed' ? c.group === 'fixed' : c.group !== 'income'));

  function open(t: Transaction) {
    if (isForecast(t)) {
      ui.toast('זו תחזית של הוצאה קבועה. היא תתווסף בתחילת החודש');
      return;
    }
    ui.editTx(t);
  }

  return (
    <div className="screen-inner">
      <header className="appbar">
        {everywhere && q ? <h1>חיפוש</h1> : <MonthSwitcher month={ui.month} onChange={ui.setMonth} />}
      </header>

      <div className="search">
        <Icon name="search" size={19} />
        <input type="search" className="field" placeholder="חיפוש לפי תיאור, קטגוריה או סכום" value={q}
          onChange={e => setQ(e.target.value)} aria-label="חיפוש" id="tx-search" />
      </div>
      {q && (
        <div className="scope">
          <button aria-pressed={!everywhere} onClick={() => setEverywhere(false)}>{monthLabel(ui.month)}</button>
          <button aria-pressed={everywhere} onClick={() => setEverywhere(true)}>כל החודשים</button>
        </div>
      )}

      <div className="chips" role="group" aria-label="סינון">
        {FILTERS.map(([f, label]) => (
          <button key={f} className="chip" aria-pressed={filter === f} onClick={() => { setFilter(f); setCat(''); }}>{label}</button>
        ))}
      </div>
      {filter !== 'saving' && (
        <select className="field select" value={cat} onChange={e => setCat(e.target.value)} aria-label="סינון לפי קטגוריה">
          <option value="">כל הקטגוריות</option>
          {catOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {list.length > 0 && (
        <div className="list-summary">
          <span>{list.length} תנועות</span>
          {totalOut > 0 && <span>הוצאות <span className="num">{shekels(totalOut)}</span> ₪</span>}
          {totalIn > 0 && <span>הכנסות <span className="num">{shekels(totalIn)}</span> ₪</span>}
        </div>
      )}

      {!source ? null : list.length === 0 ? (
        <Empty
          icon={q ? 'search' : 'list'}
          title={q || filter !== 'all' || cat ? 'לא נמצאו תנועות' : 'אין עדיין תנועות בחודש הזה'}
          text={q || filter !== 'all' || cat ? 'נסי מילת חיפוש או סינון אחרים.' : 'לחיצה על + מוסיפה הוצאה, הכנסה או הפקדה לחיסכון.'}
          action={!q && filter === 'all' && !cat ? <button className="btn primary" onClick={() => ui.addTx()}><Icon name="plus" size={18} />הוספה</button> : undefined}
        />
      ) : (
        groups.map(([date, txs]) => {
          const dayOut = txs.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
          return (
            <section key={date} className="day">
              <div className="day-head">
                <span>{dayLabel(date)}{everywhere ? ` ${date.slice(0, 4)}` : ''}</span>
                {dayOut > 0 && <span className="num">{shekels(dayOut)} ₪</span>}
              </div>
              <div className="card list">
                {txs.map(t => {
                  const c = byId.get(t.categoryId ?? '');
                  const meta = t.kind === 'saving' ? 'הפקדה לחיסכון' : c?.name ?? '';
                  return (
                    <button key={t.id} className={'tx' + (isForecast(t) ? ' forecast' : '')} onClick={() => open(t)}>
                      <span className="tx-ic"><Icon name={t.kind === 'saving' ? 'target' : c?.icon ?? 'dots'} size={19} /></span>
                      <span className="tx-body">
                        <span className="tx-name">{title(t)}</span>
                        <span className="tx-meta">
                          {t.note && t.note !== meta ? meta : t.kind === 'income' ? 'הכנסה' : t.kind === 'saving' ? '' : 'הוצאה'}
                          {t.fixed && <span className="tag">{isForecast(t) ? 'צפוי' : 'קבוע'}</span>}
                        </span>
                      </span>
                      <Money a={t.amount} sign={t.kind === 'income'} className={'tx-amt ' + t.kind} />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
