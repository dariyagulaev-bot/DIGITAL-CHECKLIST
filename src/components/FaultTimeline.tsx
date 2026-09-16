import { formatDayTime, formatTimeHM, faultEventLabel } from '@/exports/labels';
import type { FaultEvent } from '@/types';

/**
 * Compact, minimalist treatment timeline — secondary information that must never
 * dominate the row or the printed page. One flowing line, small muted text, no
 * cards / icons / frames. The date is shown once and repeated only when the day
 * changes.
 *   היסטוריית טיפול: 16.09 10:14 תקלה התגלתה › 11:06 הוחזר לתיקון › …
 */
export function FaultTimeline({
  events,
  repairDone,
  className = '',
}: {
  events?: FaultEvent[];
  repairDone?: boolean;
  className?: string;
}) {
  const evs = (events ?? []).slice().sort((a, b) => a.at.localeCompare(b.at));
  if (evs.length === 0) return null;
  let lastDay = '';
  return (
    <div className={`text-[11px] leading-relaxed text-slate-500 ${className}`}>
      <span className="font-semibold text-slate-400">היסטוריית טיפול: </span>
      {evs.map((e, i) => {
        const day = e.at.slice(0, 10);
        const stamp = day !== lastDay ? formatDayTime(e.at) : formatTimeHM(e.at);
        lastDay = day;
        return (
          <span key={i}>
            {i > 0 && <span className="mx-1 text-slate-300">›</span>}
            <span className="tabular-nums text-slate-400">{stamp}</span>{' '}
            {faultEventLabel(e.type, repairDone)}
          </span>
        );
      })}
    </div>
  );
}
