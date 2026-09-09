/**
 * VERO brand mark — a reusable, resolution-independent logo (inline SVG + text),
 * so it stays crisp everywhere including PDF export and print.
 *
 * variant: 'full' (mark + VERO + tagline) · 'compact' (mark + VERO) · 'mark'.
 * tone:    'light' (on white — navy text) · 'dark' (on navy header — white text).
 */
export function VeroMark({ size = 30, tone = 'light' }: { size?: number; tone?: 'light' | 'dark' }) {
  // Left blade + right (taller) blade forming a V / checkmark.
  const left = tone === 'dark' ? '#ffffff' : '#0f2b52';
  const right = tone === 'dark' ? '#4f9bff' : '#2f7df6';
  const w = size;
  const h = size * 0.84;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 48 40"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path
        d="M14 8 L24 31"
        stroke={left}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 31 L38 6"
        stroke={right}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface Props {
  variant?: 'full' | 'compact' | 'mark';
  tone?: 'light' | 'dark';
  className?: string;
}

export function VeroLogo({ variant = 'compact', tone = 'light', className = '' }: Props) {
  const wordColor = tone === 'dark' ? '#ffffff' : '#0f2b52';
  const tagColor = tone === 'dark' ? 'rgba(255,255,255,0.62)' : '#64748b';
  const dividerColor = tone === 'dark' ? 'rgba(255,255,255,0.28)' : '#cbd5e1';

  const markSize = variant === 'full' ? 46 : 28;
  const wordSize = variant === 'full' ? 30 : 19;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} dir="ltr">
      <VeroMark size={markSize} tone={tone} />
      {variant !== 'mark' && (
        <span
          style={{
            fontWeight: 800,
            fontSize: wordSize,
            letterSpacing: '0.06em',
            color: wordColor,
            lineHeight: 1,
          }}
        >
          VERO
        </span>
      )}
      {variant === 'full' && (
        <>
          <span
            style={{ width: 1, height: markSize * 0.7, background: dividerColor, margin: '0 4px' }}
          />
          <span
            dir="rtl"
            style={{ fontWeight: 500, fontSize: wordSize * 0.52, color: tagColor, lineHeight: 1.1 }}
          >
            מערכת בקרה דיגיטלית
          </span>
        </>
      )}
    </span>
  );
}
