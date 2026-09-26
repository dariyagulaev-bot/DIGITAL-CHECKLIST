import type { MonthKey } from '../data/types';
import { monthShort, shekels } from '../lib/format';

/** Rounds up to a "nice" axis maximum: 1, 2, 2.5, 5 × 10^n. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Single-series monthly bars; oldest month on the right (RTL reading order). */
export function MonthBars({ points, highlight }: { points: { month: MonthKey; value: number }[]; highlight: MonthKey }) {
  const W = 320, H = 136, top = 22, base = 110;
  const max = niceMax(Math.max(...points.map(p => p.value)));
  const slot = W / points.length, bw = Math.min(28, slot * 0.5);
  const y = (v: number) => base - (v / max) * (base - top);
  const hasData = points.some(p => p.value > 0);
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="הוצאות לפי חודש">
      <line x1="0" x2={W} y1={y(max / 2)} y2={y(max / 2)} className="grid" />
      <line x1="0" x2={W} y1={y(max)} y2={y(max)} className="grid" />
      {points.map((p, i) => {
        const cx = W - slot * (i + 0.5);
        const h = Math.max(p.value > 0 ? 2 : 0, base - y(p.value));
        const hi = p.month === highlight;
        return (
          <g key={p.month}>
            <rect x={cx - bw / 2} y={base - h} width={bw} height={h} rx={Math.min(5, h / 2)} className={hi ? 'bar-hi' : 'bar-lo'} />
            <text x={cx} y={base + 18} textAnchor="middle" className={hi ? 'lbl-hi' : 'lbl'}>{monthShort(p.month)}</text>
            {hi && hasData && <text x={cx} y={base - h - 7} textAnchor="middle" className="lbl-hi">{shekels(p.value)}</text>}
          </g>
        );
      })}
      <line x1="0" x2={W} y1={base} y2={base} className="axis" />
    </svg>
  );
}

/** Income vs. expenses per month, paired bars. */
export function IncomeExpenseBars({ points, highlight }: {
  points: { month: MonthKey; income: number; expenses: number }[]; highlight: MonthKey;
}) {
  const W = 320, H = 150, top = 14, base = 124;
  const max = niceMax(Math.max(...points.flatMap(p => [p.income, p.expenses])));
  const slot = W / points.length, bw = Math.min(14, slot * 0.28);
  const y = (v: number) => base - (v / max) * (base - top);
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="הכנסות מול הוצאות לפי חודש">
      <line x1="0" x2={W} y1={y(max / 2)} y2={y(max / 2)} className="grid" />
      <line x1="0" x2={W} y1={y(max)} y2={y(max)} className="grid" />
      {points.map((p, i) => {
        const cx = W - slot * (i + 0.5);
        const hi = p.month === highlight;
        const hIn = base - y(p.income), hOut = base - y(p.expenses);
        return (
          <g key={p.month} opacity={hi ? 1 : 0.8}>
            <rect x={cx + 1} y={base - hIn} width={bw} height={hIn} rx={Math.min(3, hIn / 2)} className="bar-in" />
            <rect x={cx - bw - 1} y={base - hOut} width={bw} height={hOut} rx={Math.min(3, hOut / 2)} className="bar-hi" />
            <text x={cx} y={base + 18} textAnchor="middle" className={hi ? 'lbl-hi' : 'lbl'}>{monthShort(p.month)}</text>
          </g>
        );
      })}
      <line x1="0" x2={W} y1={base} y2={base} className="axis" />
    </svg>
  );
}
