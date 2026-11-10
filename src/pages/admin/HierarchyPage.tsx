import { useEffect, useMemo, useState } from 'react';
import { listSystems } from '@/services/systems';
import { listRanks } from '@/services/ranks';
import {
  listPrerequisites,
  setPrerequisites,
  transitivePrerequisites,
} from '@/services/prerequisites';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { Rank, System, SystemRankPrerequisite } from '@/types';

/**
 * Dynamic rank hierarchy / prerequisites (תנאי קדם) per SYSTEM. For each rank the
 * admin ticks which other ranks are required before it. The chain is enforced by
 * the effective-competency engine (a higher rank goes inactive while a
 * prerequisite lapses, and recovers when renewed). Cycles are rejected on save.
 */
export default function HierarchyPage() {
  const { user: admin } = useAuth();
  const { notify } = useToast();
  const [systems, setSystems] = useState<System[] | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [systemId, setSystemId] = useState<string>('');

  useEffect(() => {
    (async () => {
      const [sys, rnk] = await Promise.all([listSystems(false), listRanks(false)]);
      setSystems(sys);
      setRanks([...rnk].sort((a, b) => a.sort_order - b.sort_order));
      if (sys.length) setSystemId((prev) => prev || sys[0].id);
    })().catch(() => setSystems([]));
  }, []);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-ink-900">היררכיית דרגים ותנאי קדם</h2>
        <p className="text-[13px] text-ink-500">
          מגדירים לכל מערכת אילו דרגים נדרשים כתנאי קדם לדרג אחר (לדוגמה: ב׳ מצריך א׳, ד׳ מצריך ב׳).
          כאשר תנאי קדם פג — הדרג הגבוה הופך ל״לא פעיל״ עד לחידושו. לא ניתן ליצור תלות מעגלית.
        </p>
      </div>

      {systems === null ? (
        <Spinner />
      ) : systems.length === 0 ? (
        <div className="card p-8 text-center text-ink-500">יש להגדיר מערכות ודרגים תחילה.</div>
      ) : ranks.length < 2 ? (
        <div className="card p-8 text-center text-ink-500">נדרשים לפחות שני דרגים כדי להגדיר תנאי קדם.</div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <label className="label !mb-0">מערכת:</label>
            <select className="input w-64" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {systemId && (
            <HierarchyEditor
              key={systemId}
              systemId={systemId}
              ranks={ranks}
              actor={admin ? { id: admin.id, full_name: admin.full_name } : { id: '-', full_name: '-' }}
              notify={notify}
            />
          )}
        </>
      )}
    </div>
  );
}

function HierarchyEditor({
  systemId,
  ranks,
  actor,
  notify,
}: {
  systemId: string;
  ranks: Rank[];
  actor: { id: string; full_name: string };
  notify: (m: string, k?: 'ok' | 'error' | 'info') => void;
}) {
  const [edges, setEdges] = useState<SystemRankPrerequisite[] | null>(null);
  const [savingRank, setSavingRank] = useState<string | null>(null);

  const load = () => listPrerequisites(systemId).then(setEdges).catch(() => setEdges([]));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemId]);

  const prereqOf = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges ?? []) {
      if (!m.has(e.rank_id)) m.set(e.rank_id, new Set());
      m.get(e.rank_id)!.add(e.prerequisite_rank_id);
    }
    return m;
  }, [edges]);

  const toggle = async (rankId: string, prereqId: string) => {
    const current = new Set(prereqOf.get(rankId) ?? []);
    if (current.has(prereqId)) current.delete(prereqId);
    else current.add(prereqId);
    setSavingRank(rankId);
    try {
      await setPrerequisites(systemId, rankId, [...current], actor);
      await load();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingRank(null);
    }
  };

  if (edges === null) return <Spinner />;

  return (
    <div className="space-y-3">
      {ranks.map((rank) => {
        const mine = prereqOf.get(rank.id) ?? new Set<string>();
        return (
          <div key={rank.id} className="card p-4">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-ink-900">
              <Icon name="shield-check" size={16} />
              {rank.name}
              <span className="text-[12px] font-normal text-ink-500">— תנאי קדם:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ranks.filter((r) => r.id !== rank.id).length === 0 ? (
                <span className="text-[13px] text-ink-500">אין דרגים אחרים.</span>
              ) : (
                ranks
                  .filter((r) => r.id !== rank.id)
                  .map((r) => {
                    const on = mine.has(r.id);
                    return (
                      <label
                        key={r.id}
                        className={`cursor-pointer rounded-xl border px-3 py-1.5 text-[13px] font-medium ${
                          on
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-slate-300 text-slate-600'
                        } ${savingRank === rank.id ? 'opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={on}
                          disabled={savingRank === rank.id}
                          onChange={() => toggle(rank.id, r.id)}
                        />
                        {r.name}
                      </label>
                    );
                  })
              )}
            </div>
            <TransitiveHint systemId={systemId} rankId={rank.id} ranks={ranks} edgesKey={edges.length} />
          </div>
        );
      })}
    </div>
  );
}

/** Shows the full (transitive) prerequisite chain so admins see the effective requirement. */
function TransitiveHint({
  systemId,
  rankId,
  ranks,
  edgesKey,
}: {
  systemId: string;
  rankId: string;
  ranks: Rank[];
  edgesKey: number;
}) {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    transitivePrerequisites(systemId, rankId)
      .then((set) => {
        const nameById = new Map(ranks.map((r) => [r.id, r.name]));
        setNames([...set].map((id) => nameById.get(id) ?? id));
      })
      .catch(() => setNames([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemId, rankId, edgesKey]);

  if (names.length === 0) return null;
  return (
    <p className="mt-2 text-[12px] text-ink-500">
      דרישה מלאה (כולל שרשור): {names.join(' · ')}
    </p>
  );
}
