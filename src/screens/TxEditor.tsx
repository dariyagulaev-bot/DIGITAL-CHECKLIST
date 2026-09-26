import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Sheet, SheetBar, Toggle } from '../components/common';
import { useCategories, useGoals, useMonthSummary } from '../data/hooks';
import { repo, isForecast } from '../data/repo';
import type { DateKey, Transaction, TxKind } from '../data/types';
import { currentMonth, dateKey, daysInMonth, shekels, shekelsExact, todayKey, toAgorot } from '../lib/format';
import { useUI, type TxPreset } from '../ui';

type DateMode = 'today' | 'yesterday' | 'other';

const KIND_LABEL: Record<TxKind, string> = { expense: 'הוצאה', income: 'הכנסה', saving: 'לחיסכון' };

export function TxEditor({ open, tx, preset, onClose }: {
  open: boolean; tx: Transaction | null; preset: TxPreset | null; onClose: () => void;
}) {
  const ui = useUI();
  const { cats, byId } = useCategories();
  const goals = useGoals(ui.month);
  const { summary } = useMonthSummary(ui.month);

  const editing = !!tx;
  const [step, setStep] = useState<1 | 2>(1);
  const [kind, setKind] = useState<TxKind>('expense');
  const [amount, setAmount] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState<DateKey>(todayKey());
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [repeat, setRepeat] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset the form every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    if (tx) {
      setKind(tx.kind);
      setAmount(shekelsExact(tx.amount).replace(/,/g, ''));
      setSel(tx.kind === 'saving' ? tx.goalId ?? null : tx.categoryId ?? null);
      setNote(tx.note);
      setDate(tx.date);
      setDateMode(tx.date === todayKey() ? 'today' : tx.date === yesterdayKey() ? 'yesterday' : 'other');
      setRepeat(false);
      setStep(2);
      return;
    }
    const inCurrent = ui.month === currentMonth();
    setKind(preset?.kind ?? 'expense');
    setAmount(preset?.amount ? String(preset.amount / 100) : '');
    setSel(preset?.goalId ?? null);
    setNote('');
    setDate(inCurrent ? todayKey() : `${ui.month}-01`);
    setDateMode(inCurrent ? 'today' : 'other');
    setRepeat(false);
    setStep(preset?.goalId && preset.amount ? 2 : 1);
  }, [open, tx, preset, ui.month]);

  const agorot = toAgorot(amount);
  const isFixedTx = editing ? tx!.fixed : repeat;
  const group = kind === 'income' ? 'income' : isFixedTx ? 'fixed' : 'variable';
  const options = kind === 'saving'
    ? (goals ?? []).map(g => ({ id: g.goal.id, name: g.goal.name, icon: 'target' }))
    : cats.filter(c => c.group === group);

  // Physical keyboard support for the keypad step.
  useEffect(() => {
    if (!open || step !== 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9.]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter' && agorot > 0) setStep(2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function press(k: string) {
    setAmount(a => {
      if (k === 'del') return a.slice(0, -1);
      if (k === '.') return a.includes('.') ? a : (a || '0') + '.';
      const [i, d] = a.split('.');
      if (d !== undefined && d.length >= 2) return a;
      if (d === undefined && i.replace(/^0+/, '').length >= 7) return a;
      return a === '0' ? k : a + k;
    });
  }

  function pickDate(mode: DateMode) {
    setDateMode(mode);
    if (mode === 'today') setDate(todayKey());
    if (mode === 'yesterday') setDate(yesterdayKey());
  }

  async function save() {
    if (!(agorot > 0) || !sel || busy) return;
    setBusy(true);
    try {
      const catName = kind === 'saving' ? goals?.find(g => g.goal.id === sel)?.goal.name : byId.get(sel)?.name;
      if (editing) {
        await repo.updateTransaction(tx!.id, {
          kind, amount: agorot, note: note.trim(), date,
          categoryId: kind === 'saving' ? undefined : sel,
          goalId: kind === 'saving' ? sel : undefined
        });
        ui.toast('השינויים נשמרו');
      } else if (repeat && kind !== 'saving') {
        await repo.addRecurring({
          kind, amount: agorot, categoryId: sel, name: note.trim() || catName || '',
          day: Math.min(28, Number(date.slice(8, 10)))
        }, true);
        ui.toast('נשמר. יתווסף אוטומטית בכל חודש');
      } else {
        await repo.addTransaction({
          kind, amount: agorot, note: note.trim(), date, fixed: false,
          categoryId: kind === 'saving' ? undefined : sel,
          goalId: kind === 'saving' ? sel : undefined
        });
        ui.toast(kind === 'saving' ? `הופקדו ${shekels(agorot)} ₪ ל${catName}` : 'נשמר');
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!tx) return;
    const ok = await ui.confirm({
      title: 'למחוק את התנועה?',
      message: `${tx.note || byId.get(tx.categoryId ?? '')?.name || KIND_LABEL[tx.kind]} · ${shekelsExact(tx.amount)} ₪. אי אפשר לבטל את הפעולה.`,
      confirmLabel: 'מחיקה',
      danger: true
    });
    if (!ok) return;
    await repo.deleteTransaction(tx.id);
    ui.toast('התנועה נמחקה');
    onClose();
  }

  const left = summary ? summary.left : 0;
  const hint = kind === 'expense'
    ? `פנוי להוצאות החודש: ${shekels(left)} ₪`
    : kind === 'saving' && summary ? `הופקד החודש: ${shekels(summary.saved)} ₪` : '';
  const title = editing ? `עריכת ${KIND_LABEL[kind] === 'לחיסכון' ? 'הפקדה' : KIND_LABEL[kind]}` : 'הוספה';
  const monthStart = `${ui.month}-01`;

  return (
    <Sheet open={open} onClose={onClose} label={title} tall>
      {step === 1 ? (
        <div className="sheet-body">
          <SheetBar title={editing ? title : 'הוספה'} onClose={onClose} back={editing ? () => setStep(2) : undefined} />
          {!editing && (
            <div className="seg" role="group" aria-label="סוג התנועה">
              {(['expense', 'income', 'saving'] as TxKind[]).map(k => (
                <button key={k} aria-pressed={kind === k} onClick={() => { setKind(k); setSel(null); setRepeat(false); }}>{KIND_LABEL[k]}</button>
              ))}
            </div>
          )}
          <div className="amount-display">
            <div className={'amount-val' + (agorot > 0 ? '' : ' empty')}>
              <span className="num">{formatTyped(amount)}</span><span className="cur">₪</span>
            </div>
            {hint && <div className="amount-hint">{hint}</div>}
          </div>
          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map(k => (
              <button key={k} className="key" onClick={() => press(k)}>{k}</button>
            ))}
            <button className="key" aria-label="מחיקת ספרה" onClick={() => press('del')}><Icon name="del" /></button>
          </div>
          <button className="btn primary block" disabled={!(agorot > 0)} onClick={() => setStep(2)}>המשך</button>
        </div>
      ) : (
        <div className="sheet-body">
          <SheetBar
            title={editing ? title : kind === 'expense' ? 'פרטי ההוצאה' : kind === 'income' ? 'פרטי ההכנסה' : 'הפקדה לחיסכון'}
            onClose={onClose}
            back={editing ? undefined : () => setStep(1)}
            end={editing && !isForecast(tx!) ? <button className="ibtn danger" aria-label="מחיקה" onClick={remove}><Icon name="trash" size={20} /></button> : null}
          />
          <div className="details">
            <button className="amount-chip" onClick={() => setStep(1)} aria-label="שינוי הסכום">
              <span className="muted">{KIND_LABEL[kind]}</span>
              <b><span className="num">{shekelsExact(agorot)}</span> ₪</b>
            </button>

            <div>
              <span className="label">{kind === 'saving' ? 'לאיזה חיסכון' : kind === 'income' ? 'סוג ההכנסה' : 'קטגוריה'}</span>
              {options.length ? (
                <div className="cat-grid">
                  {options.map(c => (
                    <button key={c.id} className="cat-btn" aria-pressed={c.id === sel} onClick={() => setSel(c.id)}>
                      <Icon name={c.icon} /><span>{c.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="inline-empty">
                  <span>עדיין אין יעדי חיסכון.</span>
                  <button className="link" onClick={() => { onClose(); ui.editGoal(); }}>יצירת יעד חדש</button>
                </div>
              )}
            </div>

            <div className="fieldset">
              <label className="label" htmlFor="tx-note">{isFixedTx ? 'שם' : 'תיאור קצר'}</label>
              <input id="tx-note" className="field" value={note} onChange={e => setNote(e.target.value)} autoComplete="off"
                placeholder={kind === 'income' ? 'למשל: משכורת ספטמבר' : kind === 'saving' ? 'לא חובה' : isFixedTx ? 'למשל: שכר דירה' : 'למשל: שופרסל'} />
            </div>

            <div>
              <span className="label">{repeat ? 'תאריך החיוב החודשי' : 'תאריך'}</span>
              <div className="dates">
                <button className="date-btn" aria-pressed={dateMode === 'today'} onClick={() => pickDate('today')}>היום</button>
                <button className="date-btn" aria-pressed={dateMode === 'yesterday'} onClick={() => pickDate('yesterday')}>אתמול</button>
                <button className="date-btn" aria-pressed={dateMode === 'other'} onClick={() => pickDate('other')}>תאריך אחר</button>
              </div>
              {dateMode === 'other' && (
                <input className="field date-field" type="date" value={date} aria-label="בחירת תאריך"
                  min={repeat ? monthStart : undefined}
                  max={repeat ? `${ui.month}-${daysInMonth(ui.month)}` : undefined}
                  onChange={e => e.target.value && setDate(e.target.value)} />
              )}
            </div>

            {!editing && kind !== 'saving' && ui.month === currentMonth() && (
              <Toggle
                checked={repeat}
                onChange={v => { setRepeat(v); setSel(null); }}
                label={kind === 'income' ? 'הכנסה קבועה בכל חודש' : 'הוצאה קבועה בכל חודש'}
                hint="תתווסף אוטומטית לכל חודש חדש, ואפשר לשנות אותה בחודש מסוים"
              />
            )}

            {editing && tx!.recurringId && (
              <p className="note-text">
                זו הוצאה או הכנסה קבועה. שינוי כאן חל רק על החודש הזה. לשינוי קבוע: עוד ← הכנסות והוצאות קבועות.
              </p>
            )}
          </div>
          <button className="btn primary block" disabled={!(agorot > 0) || !sel || busy} onClick={save}>
            {editing ? 'שמירת שינויים' : 'שמירה'}
          </button>
        </div>
      )}
    </Sheet>
  );
}

function yesterdayKey(): DateKey {
  return dateKey(new Date(Date.now() - 864e5));
}

function formatTyped(a: string) {
  if (!a) return '0';
  const [i, d] = a.split('.');
  const int = Number(i || '0').toLocaleString('en-US');
  return d !== undefined ? `${int}.${d}` : int;
}
