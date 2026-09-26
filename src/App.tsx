import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { ConfirmDialog, type ConfirmOptions } from './components/common';
import { repo } from './data/repo';
import type { Goal, Recurring, Transaction } from './data/types';
import { currentMonth } from './lib/format';
import { UIContext, type Route, type TxPreset, type UI } from './ui';
import { Home } from './screens/Home';
import { Transactions } from './screens/Transactions';
import { Savings } from './screens/Savings';
import { BackupScreen, BudgetsScreen, More, RecurringScreen, SummaryScreen } from './screens/More';
import { TxEditor } from './screens/TxEditor';
import { GoalEditor, RecurringEditor } from './screens/Editors';

const ROUTES: Route[] = ['home', 'tx', 'savings', 'more', 'more/recurring', 'more/summary', 'more/budgets', 'more/backup'];
const readRoute = (): Route => {
  const r = location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(r) ? r : 'home';
};

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [month, setMonth] = useState(currentMonth);
  const [txSheet, setTxSheet] = useState<{ open: boolean; tx: Transaction | null; preset: TxPreset | null }>({ open: false, tx: null, preset: null });
  const [goalSheet, setGoalSheet] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });
  const [recSheet, setRecSheet] = useState<{ open: boolean; item: Recurring | null; kind: 'income' | 'expense' }>({ open: false, item: null, kind: 'expense' });
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const confirmResolve = useRef<((ok: boolean) => void) | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [route]);

  // Fill in fixed items for new months, also when the app comes back from the background.
  useEffect(() => {
    let lastMonth = currentMonth();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      repo.ensureUpToCurrent();
      const m = currentMonth();
      if (m !== lastMonth) { setMonth(m); lastMonth = m; }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const go = useCallback((r: Route) => {
    if (r === readRoute()) return;
    const isTab = !r.includes('/');
    if (isTab) history.replaceState(null, '', '#/' + r);
    else history.pushState({ sub: true }, '', '#/' + r);
    setRoute(r);
  }, []);

  const back = useCallback(() => {
    if (history.state?.sub) history.back();
    else go('more');
  }, [go]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2400);
  }, []);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>(resolve => {
    confirmResolve.current = resolve;
    setConfirmOpts(o);
  }), []);

  const ui: UI = useMemo(() => ({
    month, setMonth, route, go, back, toast, confirm,
    addTx: (preset?: TxPreset) => setTxSheet({ open: true, tx: null, preset: preset ?? null }),
    editTx: (tx: Transaction) => setTxSheet({ open: true, tx, preset: null }),
    editGoal: (goal?: Goal) => setGoalSheet({ open: true, goal: goal ?? null }),
    editRecurring: (item?: Recurring, kind?: 'income' | 'expense') =>
      setRecSheet({ open: true, item: item ?? null, kind: item?.kind ?? kind ?? 'expense' })
  }), [month, route, go, back, toast, confirm]);

  const tab = route.split('/')[0];
  const closeTx = useCallback(() => setTxSheet(s => ({ ...s, open: false })), []);
  const closeGoal = useCallback(() => setGoalSheet(s => ({ ...s, open: false })), []);
  const closeRec = useCallback(() => setRecSheet(s => ({ ...s, open: false })), []);

  return (
    <UIContext.Provider value={ui}>
      <div className="app">
        <main className="screen" ref={scrollRef}>
          {route === 'home' && <Home />}
          {route === 'tx' && <Transactions />}
          {route === 'savings' && <Savings />}
          {route === 'more' && <More />}
          {route === 'more/recurring' && <RecurringScreen />}
          {route === 'more/summary' && <SummaryScreen />}
          {route === 'more/budgets' && <BudgetsScreen />}
          {route === 'more/backup' && <BackupScreen />}
        </main>

        <nav className="tabbar" aria-label="ניווט ראשי">
          <TabButton icon="home" label="בית" active={tab === 'home'} onClick={() => go('home')} />
          <TabButton icon="list" label="תנועות" active={tab === 'tx'} onClick={() => go('tx')} />
          <div className="tab-add">
            <button aria-label="הוספת הכנסה או הוצאה" onClick={() => ui.addTx()}><Icon name="plus" size={26} /></button>
          </div>
          <TabButton icon="target" label="חסכונות" active={tab === 'savings'} onClick={() => go('savings')} />
          <TabButton icon="grid" label="עוד" active={tab === 'more'} onClick={() => go('more')} />
        </nav>

        <TxEditor open={txSheet.open} tx={txSheet.tx} preset={txSheet.preset} onClose={closeTx} />
        <GoalEditor open={goalSheet.open} goal={goalSheet.goal} onClose={closeGoal} />
        <RecurringEditor open={recSheet.open} item={recSheet.item} kind={recSheet.kind} onClose={closeRec} />
        <ConfirmDialog opts={confirmOpts} onResult={ok => { confirmResolve.current?.(ok); confirmResolve.current = null; setConfirmOpts(null); }} />
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </UIContext.Provider>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className="tab" aria-current={active ? 'page' : undefined} onClick={onClick}>
      <Icon name={icon} />
      {label}
    </button>
  );
}
