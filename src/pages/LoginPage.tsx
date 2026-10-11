import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { VeroLogo, VeroMark } from '@/components/VeroLogo';
import { Icon } from '@/components/Icon';

const APP_VERSION = 'v1.0.0';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(username, password);
      if (!u) {
        setError('שם משתמש או סיסמה שגויים, או שהמשתמש אינו פעיל.');
        return;
      }
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col-reverse lg:flex-row">
      {/* ── Login (right in RTL) ───────────────────────────────── */}
      <section className="relative flex flex-1 items-center justify-center bg-[#f5f6f8] px-5 py-10 sm:px-8 lg:w-[46%] lg:flex-none">
        <span className="pointer-events-none absolute left-5 top-4 text-[12px] font-medium text-ink-300">
          {APP_VERSION}
        </span>

        <div className="w-full max-w-[420px] animate-rise-in">
          <div className="mb-2.5 flex justify-center">
            <VeroLogo variant="compact" tone="light" scale={1.25} />
          </div>
          <p className="mb-8 text-center text-[14px] font-semibold tracking-wide text-ink-500">
            מערכת בקרה דיגיטלית
          </p>

          <div className="mb-7 text-center">
            <h1 className="text-[24px] font-extrabold tracking-tight text-ink-900">
              התחברות למערכת
            </h1>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field
              icon="users"
              label="שם משתמש"
              placeholder="שם משתמש"
              value={username}
              autoComplete="username"
              onChange={setUsername}
            />

            <Field
              icon="lock"
              label="סיסמה"
              placeholder="סיסמה"
              type={showPw ? 'text' : 'password'}
              value={password}
              autoComplete="current-password"
              onChange={setPassword}
              trailing={
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-ink-400 transition-colors hover:text-ink-700"
                >
                  <Icon name="eye" size={20} />
                </button>
              }
            />

            {error && (
              <div className="animate-fade-in rounded-lg border border-fault-200 bg-fault-50 px-4 py-3 text-[14px] font-medium text-fault-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="login-cta group flex min-h-[58px] w-full items-center justify-center gap-3 rounded-xl text-[17px] font-bold text-white disabled:opacity-70"
            >
              {busy ? 'מתחבר…' : 'כניסה'}
              {!busy && (
                <Icon
                  name="back"
                  size={20}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              )}
            </button>
          </form>

          <div className="mt-10 border-t border-slate-200 pt-4 text-center text-[11.5px] leading-relaxed text-ink-400">
            © 2026 VERO <span className="mx-1 text-slate-300">|</span> פיתוח המערכת: דריה ג.
            <span className="mx-1 text-slate-300">|</span> כל הזכויות שמורות
          </div>
        </div>
      </section>

      {/* ── Branding (left in RTL) ─────────────────────────────── */}
      <BrandingPanel />
    </div>
  );
}

/* Large, comfortable touch input with a leading icon and optional trailing slot. */
function Field({
  icon,
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  autoComplete,
  trailing,
}: {
  icon: 'users' | 'lock';
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-600">{label}</span>
      <div className="login-field flex min-h-[56px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 transition-all">
        <span className="flex h-9 w-9 items-center justify-center text-ink-400">
          <Icon name={icon} size={20} />
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-1 text-[16px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
        />
        {trailing}
      </div>
    </label>
  );
}

/* Navy visual/branding panel with the ambient VERO "V", feature list and a
   vector checklist illustration. All vector — nothing loaded from the network. */
function BrandingPanel() {
  return (
    <section className="relative hidden overflow-hidden bg-navy-900 lg:flex lg:w-[54%] lg:flex-none">
      {/* Layered navy gradient ground */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 120% at 85% 15%, #1c3a6b 0%, #132646 42%, #0b1a33 100%)',
        }}
      />
      {/* Ambient VERO "V" marks (based on the brand shape) */}
      <BackgroundV className="absolute -left-24 top-8 h-[440px] w-[440px] animate-float-slow opacity-[0.10]" />
      <BackgroundV className="absolute -right-16 bottom-[-60px] h-[360px] w-[360px] animate-float-slower opacity-[0.07]" />
      {/* Faint grid texture for the "technical environment" feel */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />

      <div className="relative z-10 flex w-full flex-col justify-between px-12 py-14 xl:px-16">
        <div className="animate-rise-in" style={{ animationDelay: '0.05s' }}>
          <h2 className="text-[44px] font-extrabold leading-[1.12] text-white xl:text-[52px]">
            בקרה מדויקת.
            <br />
            תיעוד מלא.
          </h2>
          <p className="mt-5 max-w-md text-[18px] leading-relaxed text-navy-100">
            מהבדיקה ועד האישור – כל שלב מתועד.
          </p>

          <ul className="mt-10 flex flex-wrap items-center gap-3">
            <Chip icon={<IconShield />} title="בדיקה" />
            <Chip icon={<IconBars />} title="בקרה" />
            <Chip icon={<IconGear />} title="עקיבות" />
          </ul>
        </div>

        <div
          className="mt-10 flex items-end justify-end animate-rise-in"
          style={{ animationDelay: '0.12s' }}
        >
          <ChecklistIllustration />
        </div>
      </div>
    </section>
  );
}

/* Outline-icon chip: בדיקה • בקרה • עקיבות. */
function Chip({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <li className="flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 text-white">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="text-[15px] font-semibold">{title}</span>
    </li>
  );
}

/* Big brand "V" derived from VeroMark — decorative, not the logo. */
function BackgroundV({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 40" fill="none" aria-hidden="true" className={className}>
      <path d="M14 8 L24 31" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
      <path d="M24 31 L38 6" stroke="#4f9bff" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

function ChecklistIllustration() {
  return (
    <div className="w-[220px] rounded-xl border border-white/12 bg-white/[0.06] p-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.7)] backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <VeroMark size={18} tone="dark" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-navy-200">
          Checklist
        </span>
      </div>
      <div className="space-y-2.5">
        {[100, 82, 92, 68].map((w, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-[#4f9bff]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path
                  d="m5 12.5 4.5 4.5L19 7"
                  stroke="#0b1a33"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              className="h-2 rounded-full bg-white/20"
              style={{ width: `${w}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Inline feature icons (vector, offline). */
function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 5.5 6v5.2c0 4 2.8 6.9 6.5 8.3 3.7-1.4 6.5-4.3 6.5-8.3V6L12 3.5Z" />
      <path d="m9.3 12 1.9 1.9 3.6-3.9" />
    </svg>
  );
}
function IconBars() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16" />
      <rect x="5.5" y="12" width="3.2" height="5" rx="0.6" />
      <rect x="10.4" y="8" width="3.2" height="9" rx="0.6" />
      <rect x="15.3" y="5" width="3.2" height="12" rx="0.6" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l1.9-1.4-2-3.4-2.2.9a7 7 0 0 0-2-1.2L16.2 3H8l-.4 2.5a7 7 0 0 0-2 1.2l-2.2-.9-2 3.4 1.9 1.4A7 7 0 0 0 3.2 12c0 .4 0 .8.1 1.2l-1.9 1.4 2 3.4 2.2-.9a7 7 0 0 0 2 1.2L8 21h8l.4-2.5a7 7 0 0 0 2-1.2l2.2.9 2-3.4-1.9-1.4c.1-.4.1-.8.1-1.2Z" />
    </svg>
  );
}
