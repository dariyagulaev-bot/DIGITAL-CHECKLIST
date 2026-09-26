import { Icon } from '../components/Icon';
import { AppBar, Bar, Empty, Money } from '../components/common';
import { useMonthSummary } from '../data/hooks';
import { addMonths, currentMonth, monthLabel, shekels } from '../lib/format';
import { useUI } from '../ui';

export function Savings() {
  const ui = useUI();
  const { goals, summary } = useMonthSummary(currentMonth());
  if (!goals || !summary) return <div className="screen-inner" />;

  const total = goals.reduce((s, g) => s + g.saved, 0);
  const plan = goals.filter(g => g.remaining > 0 || g.depositedThisMonth > 0).reduce((s, g) => s + g.goal.monthly, 0);

  return (
    <div className="screen-inner">
      <AppBar title="חסכונות">
        <button className="btn soft small" onClick={() => ui.editGoal()}><Icon name="plus" size={18} />יעד חדש</button>
      </AppBar>

      {goals.length === 0 ? (
        <Empty
          icon="target"
          title="עדיין אין יעדי חיסכון"
          text="אפשר ליצור כמה יעדים, למשל קרן חירום, חופשה או רכב. כל הפקדה יורדת מהתקציב של החודש."
          action={<button className="btn primary" onClick={() => ui.editGoal()}><Icon name="plus" size={18} />יצירת יעד</button>}
        />
      ) : (
        <>
          <div className="card">
            <div className="muted">סך הכל בחסכונות</div>
            <div className="sum-val"><Money a={total} /></div>
            <div className="sum-row">
              <span>הופקד ב{monthLabel(currentMonth()).split(' ')[0]}</span>
              <span><span className="num">{shekels(summary.saved)}</span> מתוך <span className="num">{shekels(plan)}</span> ₪ מתוכנן</span>
            </div>
            <Bar ratio={plan > 0 ? summary.saved / plan : summary.saved > 0 ? 1 : 0} />
          </div>

          {goals.map(g => {
            const pct = Math.round(g.pct * 100);
            const eta = g.monthsLeft === 0 ? 'היעד הושג' : g.monthsLeft === null ? 'לא נקבעה הפקדה' : monthLabel(addMonths(currentMonth(), g.monthsLeft));
            const doneThisMonth = g.goal.monthly > 0 && g.depositedThisMonth >= g.goal.monthly;
            return (
              <div className="card goal" key={g.goal.id}>
                <div className="goal-top">
                  <span className="goal-name">{g.goal.name}</span>
                  <span className={'pill' + (g.remaining === 0 ? ' pos' : '')}><span className="num">{pct}%</span></span>
                </div>
                <div className="goal-amt">
                  <Money a={g.saved} /><small>מתוך <span className="num">{shekels(g.goal.target)}</span> ₪</small>
                </div>
                <Bar ratio={g.pct} thick />
                <div className="facts">
                  <div className="fact"><span>הפקדה חודשית</span><b><span className="num">{shekels(g.goal.monthly)}</span> ₪</b></div>
                  <div className="fact"><span>נשאר ליעד</span><b><span className="num">{shekels(g.remaining)}</span> ₪</b></div>
                  <div className="fact"><span>צפי להשגה</span><b>{eta}</b></div>
                </div>
                {g.depositedThisMonth > 0 && (
                  <div className="goal-month">
                    <Icon name="check" size={16} />
                    הופקדו החודש <span className="num">{shekels(g.depositedThisMonth)}</span> ₪
                    {!doneThisMonth && g.goal.monthly > 0 && <> מתוך <span className="num">{shekels(g.goal.monthly)}</span> ₪</>}
                  </div>
                )}
                <div className="goal-actions">
                  <button className="btn soft" onClick={() => ui.addTx({
                    kind: 'saving', goalId: g.goal.id,
                    amount: Math.max(0, Math.min(g.remaining, g.goal.monthly - g.depositedThisMonth)) || undefined
                  })}>
                    <Icon name="plus" size={18} />הפקדה
                  </button>
                  <button className="btn" onClick={() => ui.editGoal(g.goal)}>עריכה</button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
