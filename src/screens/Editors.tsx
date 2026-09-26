import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { AmountInput, Field, Sheet, SheetBar, Toggle } from '../components/common';
import { useCategories, useGoals } from '../data/hooks';
import { repo } from '../data/repo';
import type { Goal, Recurring } from '../data/types';
import { currentMonth, shekelsExact, toAgorot } from '../lib/format';
import { useUI } from '../ui';

const plain = (a: number) => (a ? shekelsExact(a).replace(/,/g, '') : '');

export function GoalEditor({ open, goal, onClose }: { open: boolean; goal: Goal | null; onClose: () => void }) {
  const ui = useUI();
  const progress = useGoals(currentMonth());
  const current = goal ? progress?.find(p => p.goal.id === goal.id) : undefined;
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [monthly, setMonthly] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? '');
    setTarget(plain(goal?.target ?? 0));
    setSaved(plain(current?.saved ?? goal?.startingAmount ?? 0));
    setMonthly(plain(goal?.monthly ?? 0));
  }, [open, goal]);

  const valid = name.trim() && toAgorot(target) > 0;

  async function save() {
    if (!valid) return;
    const data = { name: name.trim(), target: toAgorot(target), monthly: toAgorot(monthly) };
    if (goal) {
      const oldSaved = current?.saved ?? goal.startingAmount;
      await repo.updateGoal(goal.id, { ...data, startingAmount: goal.startingAmount + (toAgorot(saved) - oldSaved) });
      ui.toast('היעד עודכן');
    } else {
      await repo.addGoal({ ...data, startingAmount: toAgorot(saved) });
      ui.toast('יעד החיסכון נוצר');
    }
    onClose();
  }

  async function remove() {
    if (!goal) return;
    const ok = await ui.confirm({
      title: `למחוק את היעד "${goal.name}"?`,
      message: 'היעד יוסר מהרשימה. ההפקדות שכבר נעשו יישארו בהיסטוריה של החודשים.',
      confirmLabel: 'מחיקה', danger: true
    });
    if (!ok) return;
    await repo.deleteGoal(goal.id);
    ui.toast('היעד נמחק');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} label={goal ? 'עריכת יעד' : 'יעד חיסכון חדש'}>
      <div className="sheet-body">
        <SheetBar title={goal ? 'עריכת יעד' : 'יעד חיסכון חדש'} onClose={onClose}
          end={goal ? <button className="ibtn danger" aria-label="מחיקת היעד" onClick={remove}><Icon name="trash" size={20} /></button> : null} />
        <div className="details">
          <Field label="שם החיסכון" htmlFor="g-name">
            <input id="g-name" className="field" value={name} onChange={e => setName(e.target.value)} placeholder="למשל: קרן חירום" autoComplete="off" />
          </Field>
          <Field label="יעד כספי" htmlFor="g-target"><AmountInput id="g-target" value={target} onChange={setTarget} /></Field>
          <Field label="כמה כבר חסכתי" htmlFor="g-saved"><AmountInput id="g-saved" value={saved} onChange={setSaved} /></Field>
          <Field label="כמה להעביר בכל חודש" htmlFor="g-monthly"><AmountInput id="g-monthly" value={monthly} onChange={setMonthly} /></Field>
          <p className="note-text">הסכום החודשי נשמר בצד בתקציב של כל חודש, כדי שתדעי כמה נשאר באמת להוצאות.</p>
        </div>
        <button className="btn primary block" disabled={!valid} onClick={save}>{goal ? 'שמירת שינויים' : 'יצירת יעד'}</button>
      </div>
    </Sheet>
  );
}

export function RecurringEditor({ open, item, kind: initialKind, onClose }: {
  open: boolean; item: Recurring | null; kind: 'income' | 'expense'; onClose: () => void;
}) {
  const ui = useUI();
  const { cats, byId } = useCategories();
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [cat, setCat] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(1);
  const [thisMonth, setThisMonth] = useState(true);

  useEffect(() => {
    if (!open) return;
    setKind(item?.kind ?? initialKind);
    setCat(item?.categoryId ?? null);
    setName(item?.name ?? '');
    setAmount(plain(item?.amount ?? 0));
    setDay(item?.day ?? 1);
    setThisMonth(true);
  }, [open, item, initialKind]);

  const options = cats.filter(c => c.group === (kind === 'income' ? 'income' : 'fixed'));
  const valid = !!cat && toAgorot(amount) > 0;

  async function save() {
    if (!valid) return;
    const data = { kind, categoryId: cat!, name: name.trim() || byId.get(cat!)?.name || '', amount: toAgorot(amount), day };
    if (item) {
      await repo.updateRecurring(item.id, data, thisMonth);
      ui.toast('נשמר');
    } else {
      await repo.addRecurring(data, thisMonth);
      ui.toast(thisMonth ? 'נוסף לחודש הזה ולחודשים הבאים' : 'יתווסף החל מהחודש הבא');
    }
    onClose();
  }

  async function remove() {
    if (!item) return;
    const ok = await ui.confirm({
      title: `להפסיק את "${item.name}"?`,
      message: 'לא יתווסף יותר בחודשים הבאים. החודש הנוכחי והחודשים הקודמים לא ישתנו.',
      confirmLabel: 'הפסקה', danger: true
    });
    if (!ok) return;
    await repo.deleteRecurring(item.id);
    ui.toast('הוסר מהחודשים הבאים');
    onClose();
  }

  const title = item ? (kind === 'income' ? 'עריכת הכנסה קבועה' : 'עריכת הוצאה קבועה') : 'קבועה חדשה';

  return (
    <Sheet open={open} onClose={onClose} label={title} tall>
      <div className="sheet-body">
        <SheetBar title={title} onClose={onClose}
          end={item ? <button className="ibtn danger" aria-label="מחיקה" onClick={remove}><Icon name="trash" size={20} /></button> : null} />
        <div className="details">
          {!item && (
            <div className="seg two" role="group" aria-label="סוג">
              <button aria-pressed={kind === 'expense'} onClick={() => { setKind('expense'); setCat(null); }}>הוצאה קבועה</button>
              <button aria-pressed={kind === 'income'} onClick={() => { setKind('income'); setCat(null); }}>הכנסה קבועה</button>
            </div>
          )}
          <Field label="סכום חודשי" htmlFor="r-amount"><AmountInput id="r-amount" value={amount} onChange={setAmount} /></Field>
          <div>
            <span className="label">{kind === 'income' ? 'סוג ההכנסה' : 'קטגוריה'}</span>
            <div className="cat-grid">
              {options.map(c => (
                <button key={c.id} className="cat-btn" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                  <Icon name={c.icon} /><span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
          <Field label="שם (לא חובה)" htmlFor="r-name">
            <input id="r-name" className="field" value={name} onChange={e => setName(e.target.value)} autoComplete="off"
              placeholder={cat ? byId.get(cat)?.name : kind === 'income' ? 'למשל: משכורת' : 'למשל: שכר דירה'} />
          </Field>
          <Field label="יום בחודש" htmlFor="r-day">
            <select id="r-day" className="field select" value={day} onChange={e => setDay(Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d} בחודש</option>)}
            </select>
          </Field>
          <Toggle
            checked={thisMonth}
            onChange={setThisMonth}
            label={item ? 'לעדכן גם בחודש הנוכחי' : 'להוסיף גם לחודש הנוכחי'}
            hint={item ? 'אחרת השינוי יחול מהחודש הבא' : 'אחרת יתחיל מהחודש הבא'}
          />
        </div>
        <button className="btn primary block" disabled={!valid} onClick={save}>{item ? 'שמירת שינויים' : 'הוספה'}</button>
      </div>
    </Sheet>
  );
}
