import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canPerform } from '@/services/rbac';
import { listTemplates } from '@/services/templates';
import { listSystems } from '@/services/systems';
import { listUnits } from '@/services/units';
import { listRanks } from '@/services/ranks';
import { createDraftForm } from '@/services/forms';
import { PageHeader } from '@/components/Layout';
import { EmptyState, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/context/ToastContext';
import type { Rank, System, Template, Unit } from '@/types';

type StepId = 'system' | 'unit' | 'rank' | 'template';

interface Loaded {
  systems: System[];
  units: Unit[];
  ranks: Rank[];
  templates: Template[];
}

/** Does a template apply to a rank? A null rank_id means "applies to all ranks". */
function templateFitsRank(t: Template, rankId: string | null): boolean {
  if (t.rank_id === null) return true;
  return t.rank_id === rankId;
}

export default function NewFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [data, setData] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);

  // Wizard selections. `undefined` = not yet chosen on that step.
  const [systemId, setSystemId] = useState<string | undefined>(undefined);
  const [unitId, setUnitId] = useState<string | undefined>(undefined);
  const [rankId, setRankId] = useState<string | undefined>(undefined);

  useEffect(() => {
    Promise.all([listSystems(false), listUnits(false), listRanks(false), listTemplates(false)])
      .then(([systems, units, ranks, templates]) => {
        // Only systems that actually have at least one published בד״ח are offerable.
        const usableSystems = systems.filter((s) => templates.some((t) => t.system_id === s.id));
        setData({ systems: usableSystems, units, ranks, templates });
        if (usableSystems.length === 1) setSystemId(usableSystems[0].id);
      })
      .catch(() => setData({ systems: [], units: [], ranks: [], templates: [] }));
  }, []);

  const systemName = useMemo(
    () => new Map((data?.systems ?? []).map((s) => [s.id, s.name])),
    [data]
  );

  // Units belonging to the chosen system.
  const units = useMemo(
    () => (data?.units ?? []).filter((u) => u.system_id === systemId),
    [data, systemId]
  );

  // Templates in the chosen system (before rank filtering).
  const systemTemplates = useMemo(
    () => (data?.templates ?? []).filter((t) => t.system_id === systemId),
    [data, systemId]
  );

  // Ranks that are meaningful here: those with at least one rank-specific בד״ח.
  const rankOptions = useMemo(() => {
    const ids = new Set(systemTemplates.map((t) => t.rank_id).filter((r): r is string => !!r));
    return (data?.ranks ?? []).filter((r) => ids.has(r.id));
  }, [data, systemTemplates]);

  // Effective rank once the rank step is settled (auto-picked when 0 or 1 option).
  const effectiveRankId = useMemo<string | null>(() => {
    if (rankOptions.length === 0) return null; // rank not meaningful → all templates
    if (rankOptions.length === 1) return rankOptions[0].id;
    return rankId ?? null;
  }, [rankOptions, rankId]);

  const rankChosen = rankOptions.length <= 1 || rankId !== undefined;

  const templatesForRank = useMemo(
    () => systemTemplates.filter((t) => templateFitsRank(t, effectiveRankId)),
    [systemTemplates, effectiveRankId]
  );

  if (!user || !canPerform(user)) {
    return <EmptyState icon="lock" title="אין לך הרשאת ביצוע בד״חים" />;
  }
  if (data === null) return <Spinner label="טוען…" />;
  if (data.systems.length === 0) {
    return (
      <div>
        <PageHeader title="בדיקה חדשה" />
        <EmptyState icon="file" title="אין בד״חים פעילים" hint="פנה למנהל המערכת ליצירת בד״ח" />
      </div>
    );
  }

  // Determine the current step.
  const unitStepDone = units.length === 0 || unitId !== undefined;
  const step: StepId = !systemId
    ? 'system'
    : !unitStepDone
      ? 'unit'
      : !rankChosen
        ? 'rank'
        : 'template';

  const open = async (t: Template) => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createDraftForm({
        templateId: t.id,
        performer: user,
        unitId: unitId ?? undefined,
      });
      navigate(`/form/${id}`);
    } catch (e) {
      notify((e as Error).message, 'error');
      setBusy(false);
    }
  };

  const reset = (from: StepId) => {
    // Clicking a completed step in the trail returns to it and clears later picks.
    if (from === 'system') {
      setSystemId(data.systems.length === 1 ? data.systems[0].id : undefined);
      setUnitId(undefined);
      setRankId(undefined);
    } else if (from === 'unit') {
      setUnitId(undefined);
      setRankId(undefined);
    } else if (from === 'rank') {
      setRankId(undefined);
    }
  };

  return (
    <div>
      <PageHeader title="בדיקה חדשה" subtitle="בחר את פרטי הבדיקה, שלב אחר שלב" />

      <WizardTrail
        step={step}
        systemLabel={systemId ? systemName.get(systemId) : undefined}
        unitLabel={unitId ? units.find((u) => u.id === unitId)?.name : units.length === 0 ? '—' : undefined}
        rankLabel={
          rankOptions.length === 0
            ? '—'
            : effectiveRankId
              ? data.ranks.find((r) => r.id === effectiveRankId)?.name
              : undefined
        }
        showUnit={units.length > 0}
        showRank={rankOptions.length > 1}
        onJump={reset}
      />

      {step === 'system' && (
        <StepGrid
          items={data.systems.map((s) => ({
            id: s.id,
            icon: 'database' as const,
            title: s.name,
            subtitle: `${systemTemplatesCount(data.templates, s.id)} בד״חים`,
          }))}
          onPick={(id) => {
            setSystemId(id);
            setUnitId(undefined);
            setRankId(undefined);
          }}
        />
      )}

      {step === 'unit' && (
        <StepGrid
          items={units.map((u) => ({ id: u.id, icon: 'layers' as const, title: u.name }))}
          onPick={(id) => {
            setUnitId(id);
            setRankId(undefined);
          }}
        />
      )}

      {step === 'rank' && (
        <StepGrid
          items={rankOptions.map((r) => ({
            id: r.id,
            icon: 'clipboard-check' as const,
            title: r.name,
            subtitle: `${templatesForRankCount(systemTemplates, r.id)} בד״חים`,
          }))}
          onPick={(id) => setRankId(id)}
        />
      )}

      {step === 'template' &&
        (templatesForRank.length === 0 ? (
          <EmptyState icon="file" title="אין בד״חים פעילים בבחירה זו" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templatesForRank.map((t) => (
              <button
                key={t.id}
                className="card group p-4 text-right transition-colors hover:border-slate-300 hover:bg-slate-50/60 disabled:opacity-60"
                onClick={() => open(t)}
                disabled={busy}
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-ink-600">
                  <Icon name="clipboard-check" size={20} />
                </div>
                <div className="text-[15px] font-bold text-ink-900">{t.name}</div>
                {t.description && (
                  <div className="mt-0.5 line-clamp-2 text-[13px] text-ink-500">{t.description}</div>
                )}
                <div className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                  התחל בדיקה <Icon name="chevron-start" size={15} />
                </div>
              </button>
            ))}
          </div>
        ))}
    </div>
  );
}

function systemTemplatesCount(templates: Template[], systemId: string): number {
  return templates.filter((t) => t.system_id === systemId).length;
}
function templatesForRankCount(systemTemplates: Template[], rankId: string): number {
  return systemTemplates.filter((t) => templateFitsRank(t, rankId)).length;
}

/** Compact horizontal trail of the hierarchy choices for the wizard. */
function WizardTrail({
  step,
  systemLabel,
  unitLabel,
  rankLabel,
  showUnit,
  showRank,
  onJump,
}: {
  step: StepId;
  systemLabel?: string;
  unitLabel?: string;
  rankLabel?: string;
  showUnit: boolean;
  showRank: boolean;
  onJump: (from: StepId) => void;
}) {
  const nodes: { id: StepId; label: string; value?: string; show: boolean }[] = [
    { id: 'system', label: 'סוג מערכת', value: systemLabel, show: true },
    { id: 'unit', label: 'יחידה', value: unitLabel, show: showUnit },
    { id: 'rank', label: 'דרג בדיקה', value: rankLabel, show: showRank },
    { id: 'template', label: 'סוג בדיקה', value: undefined, show: true },
  ].filter((n) => n.show);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px]">
      {nodes.map((n, i) => {
        const isCurrent = n.id === step;
        const isDone = !!n.value && !isCurrent;
        return (
          <div key={n.id} className="flex items-center gap-2">
            {i > 0 && <Icon name="chevron-start" size={13} className="text-ink-300" />}
            <button
              type="button"
              disabled={!isDone}
              onClick={() => onJump(n.id)}
              className={[
                'flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors',
                isCurrent
                  ? 'border-brand-300 bg-brand-50 font-semibold text-brand-700'
                  : isDone
                    ? 'border-slate-200 bg-white text-ink-700 hover:border-slate-300'
                    : 'border-transparent bg-transparent text-ink-400',
              ].join(' ')}
            >
              <span className="text-[11px] text-ink-400">{n.label}</span>
              {n.value && <span className="font-semibold">{n.value}</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** A grid of large tappable choice cards used for the system/unit/rank steps. */
function StepGrid({
  items,
  onPick,
}: {
  items: { id: string; icon: 'database' | 'layers' | 'clipboard-check'; title: string; subtitle?: string }[];
  onPick: (id: string) => void;
}) {
  if (items.length === 0) {
    return <EmptyState icon="file" title="אין אפשרויות זמינות בבחירה זו" />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <button
          key={it.id}
          className="card group flex items-center gap-3 p-4 text-right transition-colors hover:border-slate-300 hover:bg-slate-50/60"
          onClick={() => onPick(it.id)}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-ink-600">
            <Icon name={it.icon} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-ink-900">{it.title}</div>
            {it.subtitle && <div className="text-[13px] text-ink-500">{it.subtitle}</div>}
          </div>
          <Icon name="chevron-start" size={16} className="text-ink-300 group-hover:text-brand-600" />
        </button>
      ))}
    </div>
  );
}
