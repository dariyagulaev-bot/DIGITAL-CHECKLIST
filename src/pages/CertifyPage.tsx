import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { listUsersWithRoles } from '@/services/auth';
import { listSystems } from '@/services/systems';
import { listRanks } from '@/services/ranks';
import { certifierScope } from '@/services/certifiers';
import { performCertification, missingPrerequisites } from '@/services/certify';
import { issueCertificate } from '@/services/certificates';
import { effectiveRankStatus, effectiveStatusLabel } from '@/services/competency';
import type { EffectiveCertStatus, Rank, System, UserWithRoles } from '@/types';

/**
 * CERTIFIER workflow (ביצוע הסמכה / רענון). Only systems+ranks the signed-in
 * certifier is explicitly authorized for are offered. The business layer
 * re-checks authorization, the certifier's own competency (if required), and the
 * employee's prerequisites on submit — this screen just guides the flow.
 */
export default function CertifyPage() {
  const { user: certifier } = useAuth();
  const { notify } = useToast();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [scope, setScope] = useState<Map<string, Set<string>>>(new Map());

  const [employeeId, setEmployeeId] = useState('');
  const [systemId, setSystemId] = useState('');
  const [rankId, setRankId] = useState('');
  const [actionType, setActionType] = useState<'initial' | 'renewal'>('initial');

  const [status, setStatus] = useState<EffectiveCertStatus | null>(null);
  const [missingNames, setMissingNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    employee: string;
    system: string;
    rank: string;
    certificateId: string;
  } | null>(null);

  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    if (!certifier) return;
    (async () => {
      const [u, sys, rnk, sc] = await Promise.all([
        listUsersWithRoles(),
        listSystems(false),
        listRanks(false),
        certifierScope(certifier.id),
      ]);
      setUsers(u.filter((x) => x.active && x.id !== certifier.id));
      setSystems(sys);
      setRanks([...rnk].sort((a, b) => a.sort_order - b.sort_order));
      setScope(sc);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [certifier]);

  // Systems the certifier may certify in (has at least one authorized rank).
  const authorizedSystems = useMemo(
    () => systems.filter((s) => (scope.get(s.id)?.size ?? 0) > 0),
    [systems, scope]
  );
  const authorizedRanks = useMemo(() => {
    if (!systemId) return [];
    const allowed = scope.get(systemId) ?? new Set();
    return ranks.filter((r) => allowed.has(r.id));
  }, [ranks, scope, systemId]);

  const nameById = useMemo(() => new Map(ranks.map((r) => [r.id, r.name])), [ranks]);

  // Live status + missing prerequisites for the chosen employee/system/rank.
  useEffect(() => {
    setStatus(null);
    setMissingNames([]);
    if (!employeeId || !systemId || !rankId) return;
    let cancelled = false;
    (async () => {
      const [st, missing] = await Promise.all([
        effectiveRankStatus(employeeId, systemId, rankId),
        missingPrerequisites(employeeId, systemId, rankId),
      ]);
      if (cancelled) return;
      setStatus(st);
      setMissingNames(missing.map((id) => nameById.get(id) ?? id));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [employeeId, systemId, rankId, nameById]);

  const canSubmit = employeeId && systemId && rankId && missingNames.length === 0 && !busy;

  const submit = async () => {
    if (!certifier || !canSubmit) return;
    const sig = padRef.current;
    if (!sig || sig.isEmpty()) {
      notify('נדרשת חתימת המסמיך לביצוע ההסמכה', 'error');
      return;
    }
    setBusy(true);
    try {
      const { rankCertification } = await performCertification({
        employeeUserId: employeeId,
        systemId,
        rankId,
        actionType,
        certifier,
        signatureData: sig.toDataURL(),
        certificateIssued: true,
      });
      const employee = users.find((u) => u.id === employeeId);
      const empName = employee?.full_name ?? '';
      const sysName = systems.find((s) => s.id === systemId)?.name ?? '';
      const rnkName = nameById.get(rankId) ?? '';
      // Issue the certificate (snapshot of design + data). Identity is passed so
      // it can be snapshotted ONLY if the chosen design references it.
      const certificate = await issueCertificate({
        rankCertification,
        userName: empName,
        systemName: sysName,
        rankName: rnkName,
        certifier,
        idType: employee?.id_type,
        idNumber: employee?.id_number,
      });
      setDone({ employee: empName, system: sysName, rank: rnkName, certificateId: certificate.id });
      notify('ההסמכה בוצעה והתעודה הונפקה', 'ok');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDone(null);
    setEmployeeId('');
    setSystemId('');
    setRankId('');
    setActionType('initial');
    padRef.current?.clear();
  };

  if (loading) return <Spinner label="טוען…" />;

  if (done) {
    return (
      <div>
        <PageHeader title="ההסמכה בוצעה" subtitle="הרשומה נשמרה ותועדה ביומן הביקורת." />
        <div className="card space-y-2 p-5">
          <div className="flex items-center gap-2 text-ok-700">
            <Icon name="shield-check" size={20} />
            <span className="text-[15px] font-bold">
              {done.employee} — {done.system} / {done.rank} ({actionType === 'renewal' ? 'רענון' : 'הסמכה ראשונית'})
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link className="btn-primary gap-1.5" to={`/certificate/${done.certificateId}`}>
              <Icon name="printer" size={16} /> צפה בתעודה / הדפס
            </Link>
            <button className="btn-ghost" onClick={reset}>
              הסמכה נוספת
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authorizedSystems.length === 0) {
    return (
      <div>
        <PageHeader title="ביצוע הסמכה" />
        <div className="card p-8 text-center text-ink-500">
          לא הוגדרו עבורך הרשאות הסמכה (מסמיך) לאף מערכת ודרג. יש לפנות למנהל המערכת.
        </div>
      </div>
    );
  }

  const statusTone =
    status === 'valid'
      ? 'text-ok-700'
      : status === 'needs_renewal'
        ? 'text-pending-700'
        : status === 'none'
          ? 'text-ink-500'
          : 'text-fault-700';

  return (
    <div>
      <PageHeader title="ביצוע הסמכה / רענון" subtitle="בחירת עובד, מערכת ודרג וביצוע ההסמכה בחתימתך." />
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">עובד</label>
            <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">בחר עובד…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">סוג פעולה</label>
            <div className="flex gap-2">
              {(['initial', 'renewal'] as const).map((t) => (
                <label
                  key={t}
                  className={`flex-1 cursor-pointer rounded-xl border px-3 py-2 text-center text-[14px] font-medium ${
                    actionType === t
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-300 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    className="hidden"
                    checked={actionType === t}
                    onChange={() => setActionType(t)}
                  />
                  {t === 'initial' ? 'הסמכה ראשונית' : 'רענון'}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">מערכת</label>
            <select
              className="input"
              value={systemId}
              onChange={(e) => {
                setSystemId(e.target.value);
                setRankId('');
              }}
            >
              <option value="">בחר מערכת…</option>
              {authorizedSystems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">דרג</label>
            <select
              className="input"
              value={rankId}
              disabled={!systemId}
              onChange={(e) => setRankId(e.target.value)}
            >
              <option value="">בחר דרג…</option>
              {authorizedRanks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {employeeId && systemId && rankId && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[14px]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink-700">מצב נוכחי:</span>
              <span className={`font-bold ${statusTone}`}>
                {status ? effectiveStatusLabel(status) : '—'}
              </span>
            </div>
            {missingNames.length > 0 && (
              <div className="mt-2 flex items-start gap-2 text-fault-700">
                <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                <span>
                  לא ניתן להסמיך — חסרים תנאי קדם פעילים: <b>{missingNames.join(' · ')}</b>
                </span>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="label">חתימת המסמיך</label>
          <div className="rounded-xl border border-slate-300 bg-white">
            <SignaturePad ref={padRef} height={180} />
          </div>
          <p className="mt-1 text-[12px] text-ink-500">
            החתימה נשמרת כחלק מרשומת ההסמכה ומשמשת בתעודה.
          </p>
        </div>

        <div className="flex gap-3">
          <button className="btn-primary flex-1" disabled={!canSubmit} onClick={submit}>
            {actionType === 'renewal' ? 'בצע רענון' : 'בצע הסמכה'}
          </button>
          <button className="btn-ghost" type="button" onClick={() => padRef.current?.clear()}>
            נקה חתימה
          </button>
        </div>
      </div>
    </div>
  );
}
