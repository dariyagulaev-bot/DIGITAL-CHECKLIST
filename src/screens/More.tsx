import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { AmountInput, AppBar, Bar, Money, MonthSwitcher } from '../components/common';
import { IncomeExpenseBars } from '../components/Charts';
import { useCategories, useHistory, useMonthSummary, useRecurring } from '../data/hooks';
import { repo } from '../data/repo';
import type { Category, Recurring } from '../data/types';
import { monthLabel, monthShort, shekels, toAgorot, shekelsExact } from '../lib/format';
import { useUI, type Route } from '../ui';
import { downloadFile, toCsv } from '../lib/export';

export function More() {
  const ui = useUI();
  const items: [Route, string, string, string][] = [
    ['more/recurring', 'repeat', 'הכנסות והוצאות קבועות', 'משכורות, שכר דירה, חשבונות'],
    ['more/summary', 'chart', 'סיכום חודשי', 'כמה נכנס, יצא, נחסך ונשאר'],
    ['more/budgets', 'tag', 'הקצבות חודשיות', 'בילויים, מסעדות, קניות ועוד'],
    ['more/backup', 'download', 'גיבוי וייצוא', 'ייצוא ל־Excel, גיבוי ושחזור']
  ];
  return (
    <div className="screen-inner">
      <AppBar title="עוד" />
      <div className="card list">
        {items.map(([route, icon, title, sub]) => (
          <button key={route} className="menu-row" onClick={() => ui.go(route)}>
            <span className="tx-ic"><Icon name={icon} size={19} /></span>
            <span className="tx-body"><span className="tx-name">{title}</span><span className="tx-meta">{sub}</span></span>
            <Icon name="chev-l" size={18} className="muted-ic" />
          </button>
        ))}
      </div>
      <StorageNote />
    </div>
  );
}

function StorageNote() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)); }, []);
  return (
    <p className="note-text center">
      הנתונים נשמרים במכשיר הזה בלבד{persisted ? ' ומוגנים ממחיקה אוטומטית' : ''}. מומלץ לגבות מדי פעם דרך "גיבוי וייצוא".
    </p>
  );
}

// ---------- Recurring ----------

export function RecurringScreen() {
  const ui = useUI();
  const list = useRecurring();
  const { byId } = useCategories();
  if (!list) return <div className="screen-inner" />;
  const income = list.filter(r => r.kind === 'income' && r.active);
  const expense = list.filter(r => r.kind === 'expense' && r.active);
  const sum = (rs: Recurring[]) => rs.reduce((s, r) => s + r.amount, 0);

  const section = (title: string, rs: Recurring[], kind: 'income' | 'expense') => (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        <span className="muted"><span className="num">{shekels(sum(rs))}</span> ₪ בחודש</span>
      </div>
      {rs.length ? (
        <div className="card list">
          {rs.map(r => {
            const c = byId.get(r.categoryId);
            return (
              <button key={r.id} className="tx" onClick={() => ui.editRecurring(r)}>
                <span className="tx-ic"><Icon name={c?.icon ?? 'dots'} size={19} /></span>
                <span className="tx-body">
                  <span className="tx-name">{r.name}</span>
                  <span className="tx-meta">{c && c.name !== r.name ? `${c.name} · ` : ''}ב־{r.day} בכל חודש</span>
                </span>
                <Money a={r.amount} className={'tx-amt ' + kind} />
              </button>
            );
          })}
        </div>
      ) : null}
      <button className="btn dashed" onClick={() => ui.editRecurring(undefined, kind)}>
        <Icon name="plus" size={18} />{kind === 'income' ? 'הוספת הכנסה קבועה' : 'הוספת הוצאה קבועה'}
      </button>
    </section>
  );

  return (
    <div className="screen-inner">
      <AppBar title="קבועות" back={ui.back} />
      <p className="muted-p">
        כל מה שכאן נכנס אוטומטית לכל חודש חדש. אפשר לשנות סכום בחודש מסוים מתוך מסך התנועות, בלי לשנות את החודשים הבאים.
      </p>
      {section('הכנסות קבועות', income, 'income')}
      {section('הוצאות קבועות', expense, 'expense')}
    </div>
  );
}

// ---------- Monthly summary ----------

export function SummaryScreen() {
  const ui = useUI();
  const { summary } = useMonthSummary(ui.month);
  const { byId } = useCategories();
  const history = useHistory(ui.month, 6);
  const [scope, setScope] = useState<'all' | 'variable'>('all');
  if (!summary) return <div className="screen-inner" />;

  const rows = [...summary.byCategory.entries()]
    .map(([id, amount]) => ({ cat: byId.get(id), amount }))
    .filter(r => r.cat && (scope === 'all' || r.cat.group === 'variable'))
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const top = rows[0];

  return (
    <div className="screen-inner">
      <AppBar title="סיכום חודשי" back={ui.back} />
      <div className="month-row"><MonthSwitcher month={ui.month} onChange={ui.setMonth} /></div>

      <div className="summary-grid">
        <div className="card mini"><span className="muted">נכנס</span><Money a={summary.income} className="big" /></div>
        <div className="card mini"><span className="muted">יצא</span><Money a={summary.expenses} className="big" /></div>
        <div className="card mini"><span className="muted">נחסך</span><Money a={summary.saved} className="big" /></div>
        <div className="card mini"><span className="muted">נשאר</span><Money a={summary.left} className={'big ' + (summary.left < 0 ? 'neg' : summary.left > 0 ? 'pos' : '')} /></div>
      </div>

      <div className="card">
        <div className="card-head"><h2>התכנון מול הביצוע</h2></div>
        <div className="plan-row"><span>הכנסות</span><Money a={summary.income} /></div>
        <div className="plan-row"><span>פחות הוצאות קבועות</span><Money a={-summary.fixed} /></div>
        <div className="plan-row"><span>פחות חיסכון</span><Money a={-summary.reservedSavings} /></div>
        <div className="plan-row total"><span>תקציב להוצאות משתנות</span><Money a={summary.freeBudget} /></div>
        <div className="plan-row"><span>הוצאות משתנות בפועל</span><Money a={-summary.variable} /></div>
        <div className="plan-row total"><span>{summary.left >= 0 ? 'נשאר מהתקציב' : 'חריגה מהתקציב'}</span><Money a={summary.left} className={summary.left < 0 ? 'neg' : ''} /></div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>הוצאות לפי קטגוריה</h2>
          <div className="mini-seg">
            <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>הכל</button>
            <button aria-pressed={scope === 'variable'} onClick={() => setScope('variable')}>משתנות</button>
          </div>
        </div>
        {top && <p className="muted-p">הכי הרבה הלך על <b>{top.cat!.name}</b>: <span className="num">{Math.round((top.amount / total) * 100)}%</span> מההוצאות.</p>}
        {rows.length ? (
          <div className="cats">
            {rows.map(({ cat, amount }, i) => (
              <div className="cat" key={cat!.id}>
                <span className="cat-ic"><Icon name={cat!.icon} size={18} /></span>
                <div>
                  <div className="cat-top">
                    <span className="n">{cat!.name}</span>
                    <span className="v"><span className="num">{shekels(amount)}</span> ₪ · <span className="num">{Math.round((amount / total) * 100)}%</span></span>
                  </div>
                  <Bar ratio={amount / rows[0].amount} tone={i === 0 ? undefined : 'muted'} />
                </div>
              </div>
            ))}
          </div>
        ) : <p className="muted-p">אין הוצאות בחודש הזה.</p>}
      </div>

      {history && (
        <div className="card chart">
          <div className="card-head"><h2>השוואה בין חודשים</h2></div>
          <div className="legend"><span><i className="dot in" />הכנסות</span><span><i className="dot out" />הוצאות</span></div>
          <IncomeExpenseBars points={history} highlight={ui.month} />
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>חודש</th><th>נכנס</th><th>יצא</th><th>נחסך</th><th>נשאר</th></tr></thead>
              <tbody>
                {[...history].reverse().filter((p, i, all) => p.month === ui.month || p.income || p.expenses || p.saved || all.slice(i + 1).some(q => q.income || q.expenses)).map(p => ({ ...p, net: p.month === ui.month ? summary.left : p.net })).map(p => (
                  <tr key={p.month} className={p.month === ui.month ? 'hi' : ''} onClick={() => ui.setMonth(p.month)}>
                    <td>{monthShort(p.month)} {p.month.slice(2, 4)}</td>
                    <td className="num">{shekels(p.income)}</td>
                    <td className="num">{shekels(p.expenses)}</td>
                    <td className="num">{shekels(p.saved)}</td>
                    <td className={'num ' + (p.net < 0 ? 'neg' : '')}>{p.net < 0 ? '−' : ''}{shekels(Math.abs(p.net))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Category budgets ----------

export function BudgetsScreen() {
  const ui = useUI();
  const { cats } = useCategories();
  const { summary } = useMonthSummary(ui.month);
  const variable = cats.filter(c => c.group === 'variable');
  const withBudget = variable.filter(c => c.budget > 0);
  const without = variable.filter(c => !(c.budget > 0));
  const totalBudget = withBudget.reduce((s, c) => s + c.budget, 0);
  const free = summary?.freeBudget ?? 0;
  const spent = (id: string) => summary?.byCategory.get(id) ?? 0;

  return (
    <div className="screen-inner">
      <AppBar title="הקצבות חודשיות" back={ui.back} />
      <p className="muted-p">
        כמה מותר להוציא בכל חודש על כל קטגוריה. ההקצבה מתחדשת אוטומטית בתחילת כל חודש, ובמסך הבית רואים כמה נשאר בכל אחת.
      </p>

      {free > 0 && (
        <div className="card">
          <div className="muted">חולקו להקצבות</div>
          <div className="sum-val"><Money a={totalBudget} /></div>
          <div className="sum-row">
            <span>מתוך <span className="num">{shekels(free)}</span> ₪ פנויים להוצאות משתנות</span>
            {totalBudget <= free
              ? <span>נשארו <span className="num">{shekels(free - totalBudget)}</span> ₪ לחלק</span>
              : <span className="neg-text">יותר מהפנוי ב־<span className="num">{shekels(totalBudget - free)}</span> ₪</span>}
          </div>
          <Bar ratio={totalBudget / free} tone={totalBudget > free ? 'neg' : undefined} />
        </div>
      )}

      {withBudget.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>ההקצבות שלי</h2><span className="muted">{monthLabel(ui.month)}</span></div>
          <div className="card list">
            {withBudget.map(c => <BudgetRow key={c.id} cat={c} spent={spent(c.id)} />)}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>{withBudget.length ? 'קטגוריות בלי הקצבה' : 'הגדרת הקצבה'}</h2>
        </div>
        {!withBudget.length && <p className="muted-p">רושמים סכום ליד כל קטגוריה, למשל בילויים 600, מסעדות 800, קניות 1,000.</p>}
        <div className="card list">
          {without.map(c => <BudgetRow key={c.id} cat={c} spent={spent(c.id)} />)}
        </div>
      </section>
    </div>
  );
}

function BudgetRow({ cat, spent }: { cat: Category; spent: number }) {
  const ui = useUI();
  const [v, setV] = useState(cat.budget ? shekelsExact(cat.budget).replace(/,/g, '') : '');
  useEffect(() => { setV(cat.budget ? shekelsExact(cat.budget).replace(/,/g, '') : ''); }, [cat.budget]);
  const commit = () => {
    const a = toAgorot(v);
    if (a === cat.budget) return;
    repo.setCategoryBudget(cat.id, a);
    ui.toast(a > 0 ? `הקצבה ל${cat.name}: ${shekels(a)} ₪ בחודש` : `ההקצבה ל${cat.name} הוסרה`);
  };
  const left = cat.budget - spent;
  return (
    <div className="budget-row">
      <span className="tx-ic"><Icon name={cat.icon} size={19} /></span>
      <span className="tx-body">
        <span className="tx-name">{cat.name}</span>
        {cat.budget > 0 ? (
          <>
            <span className={'tx-meta' + (left < 0 ? ' neg-text' : '')}>
              {left < 0
                ? <>חריגה של <span className="num">{shekels(-left)}</span> ₪</>
                : <>נשארו <span className="num">{shekels(left)}</span> ₪ · הוצאו <span className="num">{shekels(spent)}</span></>}
            </span>
            <Bar ratio={spent / cat.budget} tone={left < 0 ? 'neg' : undefined} />
          </>
        ) : (
          <span className="tx-meta">{spent > 0 ? <>הוצאו החודש <span className="num">{shekels(spent)}</span> ₪</> : 'ללא הקצבה'}</span>
        )}
      </span>
      <div className="budget-input">
        <AmountInput id={`b-${cat.id}`} value={v} onChange={setV} onBlur={commit} placeholder="ללא" />
      </div>
    </div>
  );
}

// ---------- Backup & export ----------

export function BackupScreen() {
  const ui = useUI();
  const { byId } = useCategories();
  const [busy, setBusy] = useState(false);

  async function exportCsv(scope: 'month' | 'all') {
    const [txs, goals] = await Promise.all([scope === 'month' ? repo.monthTransactions(ui.month) : repo.allTransactions(), repo.goals()]);
    if (!txs.length) { ui.toast('אין תנועות לייצוא'); return; }
    const goalName = new Map(goals.map(g => [g.id, g.name]));
    const csv = toCsv(txs, byId, goalName);
    const name = scope === 'month' ? `תקציב-${ui.month}.csv` : `תקציב-כל-התנועות.csv`;
    await downloadFile(name, csv, 'text/csv;charset=utf-8');
  }

  async function backup() {
    const data = await repo.exportAll();
    const d = new Date().toISOString().slice(0, 10);
    await downloadFile(`גיבוי-תקציב-${d}.json`, JSON.stringify(data), 'application/json');
  }

  async function restore(file: File) {
    try {
      const data = JSON.parse(await file.text());
      const count = Array.isArray(data?.transactions) ? data.transactions.filter((t: { deletedAt?: number }) => !t.deletedAt).length : 0;
      const ok = await ui.confirm({
        title: 'לשחזר מהגיבוי?',
        message: `הנתונים הנוכחיים במכשיר יוחלפו בתוכן הגיבוי (${count} תנועות). מומלץ לגבות קודם את המצב הנוכחי.`,
        confirmLabel: 'שחזור', danger: true
      });
      if (!ok) return;
      setBusy(true);
      await repo.importAll(data);
      await repo.ensureUpToCurrent();
      ui.toast('הנתונים שוחזרו מהגיבוי');
    } catch (e) {
      ui.toast(e instanceof Error && e.message.includes('גיבוי') ? e.message : 'לא ניתן לקרוא את הקובץ. בחרי קובץ גיבוי ‎.json‎ של האפליקציה');
    } finally {
      setBusy(false);
    }
  }

  async function wipe() {
    const ok = await ui.confirm({
      title: 'למחוק את כל הנתונים?',
      message: 'כל ההכנסות, ההוצאות, הקבועות ויעדי החיסכון יימחקו מהמכשיר. אי אפשר לבטל את הפעולה.',
      confirmLabel: 'מחיקת הכל', danger: true
    });
    if (!ok) return;
    await repo.clearAll();
    ui.toast('כל הנתונים נמחקו');
  }

  return (
    <div className="screen-inner">
      <AppBar title="גיבוי וייצוא" back={ui.back} />

      <section className="section">
        <div className="section-head"><h2>ייצוא ל־Excel</h2></div>
        <p className="muted-p">קובץ CSV שנפתח ב־Excel וב־Google Sheets, עם תאריך, סוג, קטגוריה, תיאור וסכום.</p>
        <div className="btn-col">
          <button className="btn" onClick={() => exportCsv('month')}><Icon name="download" size={18} />ייצוא {monthLabel(ui.month)}</button>
          <button className="btn" onClick={() => exportCsv('all')}><Icon name="download" size={18} />ייצוא כל התנועות</button>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>גיבוי ושחזור</h2></div>
        <p className="muted-p">קובץ גיבוי מלא של כל הנתונים. אפשר לשמור אותו ב־iCloud, ב־Google Drive או לשלוח לעצמך, ולשחזר ממנו במכשיר אחר.</p>
        <div className="btn-col">
          <button className="btn primary" onClick={backup}><Icon name="download" size={18} />יצירת קובץ גיבוי</button>
          <label className={'btn' + (busy ? ' disabled' : '')}>
            <Icon name="upload" size={18} />שחזור מקובץ גיבוי
            <input type="file" accept="application/json,.json" hidden disabled={busy}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) restore(f); }} />
          </label>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>מחיקת נתונים</h2></div>
        <button className="btn danger-outline" onClick={wipe}><Icon name="trash" size={18} />מחיקת כל הנתונים</button>
      </section>
    </div>
  );
}

