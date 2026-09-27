import { Icon } from '../components/Icon';
import { Bar, Money, MonthSwitcher } from '../components/common';
import { MonthBars } from '../components/Charts';
import { AllowanceRow } from '../components/Allowance';
import { useCategories, useHistory, useMonthSummary, useRecurring } from '../data/hooks';
import { currentMonth, daysInMonth, shekels } from '../lib/format';
import { useUI } from '../ui';

export function Home() {
  const ui = useUI();
  const { summary, goals } = useMonthSummary(ui.month);
  const { byId, cats } = useCategories();
  const history = useHistory(ui.month, 6);
  const recurring = useRecurring();

  if (!summary) return <div className="screen-inner" />;

  const cur = currentMonth();
  const isCurrent = ui.month === cur;
  const isPast = ui.month < cur;
  const days = daysInMonth(ui.month);
  const today = new Date().getDate();
  const daysLeft = days - today + 1;
  const pctUsed = Math.round(summary.usedRatio * 100);
  const over = summary.left < 0;

  const isEmpty = summary.income === 0 && summary.expenses === 0 && summary.saved === 0 && !recurring?.length && !goals?.length;

  const budgeted = cats.filter(c => c.group === 'variable' && c.budget > 0);
  const unbudgetedRows = [...summary.byCategory.entries()]
    .map(([id, spent]) => ({ cat: byId.get(id), spent }))
    .filter(r => r.cat && r.cat.group === 'variable' && !(r.cat.budget > 0))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 4);
  const maxSpent = Math.max(1, ...unbudgetedRows.map(r => r.spent));

  return (
    <div className="screen-inner">
      <header className="appbar">
        <MonthSwitcher month={ui.month} onChange={ui.setMonth} />
        <button className="ibtn" aria-label="חיפוש תנועות" onClick={() => ui.go('tx')}><Icon name="search" size={20} /></button>
      </header>

      <div className="card hero">
        <div className="hero-label">
          {isPast ? 'נשאר בסוף החודש' : isCurrent ? 'פנוי להוצאות עד סוף החודש' : 'צפוי להוצאות משתנות'}
        </div>
        <div className="hero-val"><Money a={isPast ? summary.net : summary.left} /></div>
        {isCurrent && (
          <div className="hero-sub">
            {over
              ? <>חריגה של <span className="num">{shekels(-summary.left)}</span> ₪ מהתקציב</>
              : <>כ־<span className="num">{shekels(summary.left / daysLeft)}</span> ₪ ליום · {daysLeft === 1 ? 'היום האחרון בחודש' : `עוד ${daysLeft} ימים`}</>}
          </div>
        )}
        {!isPast && summary.freeBudget > 0 && (
          <>
            <div className="hmeter" role="progressbar" aria-label="ניצול התקציב הפנוי" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctUsed}>
              <div className={'hmeter-fill' + (over ? ' over' : '')} style={{ width: `${Math.min(100, pctUsed)}%` }} />
              {isCurrent && <div className="hmeter-mark" style={{ insetInlineStart: `${(today / days) * 100}%` }} />}
            </div>
            <div className="hero-foot">
              <span>נוצלו <span className="num">{pctUsed}%</span> מ־<span className="num">{shekels(summary.freeBudget)}</span> ₪</span>
              {isCurrent && <span>יום {today} מתוך {days}</span>}
            </div>
          </>
        )}
      </div>

      <div className="stats">
        <button className="stat" onClick={() => ui.go('more/summary')}>
          <span className="stat-label"><Icon name="in" size={15} />הכנסות</span>
          <span className="stat-val"><Money a={summary.income} /></span>
        </button>
        <button className="stat" onClick={() => ui.go('tx')}>
          <span className="stat-label"><Icon name="out" size={15} />הוצאות</span>
          <span className="stat-val"><Money a={summary.expenses} /></span>
        </button>
        <button className="stat" onClick={() => ui.go('savings')}>
          <span className="stat-label"><Icon name="vault" size={15} />חיסכון</span>
          <span className="stat-val"><Money a={summary.saved} /></span>
        </button>
      </div>

      {isEmpty ? (
        <div className="card">
          <div className="card-head"><h2>בואי נתחיל</h2></div>
          <p className="muted-p">כמה צעדים קצרים, ואחר כך מספיק להוסיף הוצאות ב־+.</p>
          <div className="steps">
            <button className="step" onClick={() => ui.editRecurring(undefined, 'income')}>
              <span className="step-ic"><Icon name="briefcase" size={18} /></span>
              <span><b>הכנסות קבועות</b><small>משכורת שלך ושל בן/בת הזוג</small></span>
              <Icon name="chev-l" size={18} />
            </button>
            <button className="step" onClick={() => ui.editRecurring(undefined, 'expense')}>
              <span className="step-ic"><Icon name="key" size={18} /></span>
              <span><b>הוצאות קבועות</b><small>שכר דירה, ארנונה, חשמל, אינטרנט</small></span>
              <Icon name="chev-l" size={18} />
            </button>
            <button className="step" onClick={() => ui.editGoal()}>
              <span className="step-ic"><Icon name="target" size={18} /></span>
              <span><b>יעד חיסכון</b><small>קרן חירום, חופשה, רכב</small></span>
              <Icon name="chev-l" size={18} />
            </button>
            <button className="step" onClick={() => ui.go('more/budgets')}>
              <span className="step-ic"><Icon name="tag" size={18} /></span>
              <span><b>הקצבות חודשיות</b><small>כמה מותר לבילויים, מסעדות וקניות</small></span>
              <Icon name="chev-l" size={18} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {budgeted.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2>הקצבות החודש</h2>
                <button className="link" onClick={() => ui.go('more/budgets')}>עריכה</button>
              </div>
              <div className="cats">
                {[...budgeted]
                  .sort((a, b) => (summary.byCategory.get(b.id) ?? 0) / b.budget - (summary.byCategory.get(a.id) ?? 0) / a.budget)
                  .map(c => <AllowanceRow key={c.id} cat={c} spent={summary.byCategory.get(c.id) ?? 0} />)}
              </div>
            </div>
          )}

          {(budgeted.length === 0 || unbudgetedRows.length > 0) && (
            <div className="card">
              <div className="card-head">
                <h2>{budgeted.length ? 'הוצאות בלי הקצבה' : 'לאן הלך הכסף'}</h2>
                <button className="link" onClick={() => ui.go('more/summary')}>הכל</button>
              </div>
              {unbudgetedRows.length ? (
                <div className="cats">
                  {unbudgetedRows.map(({ cat, spent }) => (
                    <div className="cat" key={cat!.id}>
                      <span className="cat-ic"><Icon name={cat!.icon} size={18} /></span>
                      <div>
                        <div className="cat-top">
                          <span className="n">{cat!.name}</span>
                          <span className="v"><span className="num">{shekels(spent)}</span> ₪</span>
                        </div>
                        <Bar ratio={spent / maxSpent} tone="muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-p">עדיין אין הוצאות משתנות החודש.</p>
              )}
              {!budgeted.length && (
                <button className="btn soft block small-gap" onClick={() => ui.go('more/budgets')}>
                  <Icon name="tag" size={18} />הגדרת הקצבות לבילויים, מסעדות וקניות
                </button>
              )}
            </div>
          )}

          <div className="card chart">
            <div className="card-head"><h2>הוצאות בחצי השנה האחרונה</h2><span className="muted">כולל קבועות</span></div>
            {history && <MonthBars points={history.map(p => ({ month: p.month, value: p.expenses }))} highlight={ui.month} />}
          </div>
          {!isPast && (
            <button className="card plan" onClick={() => ui.go('more/summary')}>
              <div className="card-head"><h2>התכנון לחודש</h2><Icon name="chev-l" size={18} className="muted-ic" /></div>
              <div className="plan-row"><span>הכנסות</span><Money a={summary.income} /></div>
              <div className="plan-row"><span>פחות הוצאות קבועות</span><Money a={-summary.fixed} /></div>
              <div className="plan-row"><span>פחות חיסכון מתוכנן</span><Money a={-summary.reservedSavings} /></div>
              <div className="plan-row total"><span>תקציב להוצאות משתנות</span><Money a={summary.freeBudget} /></div>
            </button>
          )}

        </>
      )}
    </div>
  );
}
