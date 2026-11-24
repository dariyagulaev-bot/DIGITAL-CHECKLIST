import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { C, FONT } from '../theme';
import { Icon } from '../components/Icon';

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export const FloatIn: React.FC<{ at?: number; dy?: number; children: React.ReactNode; style?: React.CSSProperties }>
  = ({ at = 0, dy = 24, children, style }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 18, mass: 0.7 } });
  const op = interpolate(f - at, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ ...style, opacity: op, transform: `translateY(${(1 - s) * dy}px)` }}>{children}</div>;
};

export const Chip: React.FC<{ icon?: string; label: string; x: number; y: number; at?: number; color?: string; big?: boolean }>
  = ({ icon, label, x, y, at = 0, color = C.cyan, big }) => (
  <FloatIn at={at} style={{ position: 'absolute', left: x, top: y }}>
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: big ? '14px 22px' : '11px 18px',
      borderRadius: 999, background: 'rgba(12,28,54,0.82)', border: `1px solid ${C.line}`,
      boxShadow: '0 10px 26px rgba(2,8,20,0.4)', backdropFilter: 'blur(3px)' }}>
      {icon && <span style={{ display: 'flex', width: big ? 30 : 26, height: big ? 30 : 26, alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, background: 'rgba(84,199,245,0.14)' }}><Icon name={icon} size={big ? 22 : 19} color={color} /></span>}
      <span style={{ fontFamily: FONT, fontSize: big ? 28 : 23, fontWeight: 700, color: C.white, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  </FloatIn>
);

export const Card: React.FC<{ icon: string; title: string; sub?: string; x: number; y: number; w?: number; at?: number; color?: string }>
  = ({ icon, title, sub, x, y, w = 380, at = 0, color = C.cyan }) => (
  <FloatIn at={at} style={{ position: 'absolute', left: x, top: y, width: w }}>
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', borderRadius: 18,
      background: 'linear-gradient(135deg, rgba(16,34,64,0.92), rgba(10,24,48,0.92))', border: `1px solid ${C.line}`,
      boxShadow: '0 16px 36px rgba(2,8,20,0.45)' }}>
      <span style={{ display: 'flex', width: 48, height: 48, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        borderRadius: 12, background: 'rgba(84,199,245,0.14)', border: `1px solid ${color}55` }}><Icon name={icon} size={26} color={color} /></span>
      <div>
        <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: C.white }}>{title}</div>
        {sub && <div style={{ fontFamily: FONT, fontSize: 19, fontWeight: 600, color: C.t3, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  </FloatIn>
);

export const Title: React.FC<{ main: string; sub?: string; x: number; y: number; at?: number; size?: number; align?: 'right' | 'center' }>
  = ({ main, sub, x, y, at = 0, size = 46, align = 'right' }) => (
  <FloatIn at={at} dy={18} style={{ position: 'absolute', left: x, top: y, textAlign: align }}>
    <div dir="rtl" style={{ fontFamily: FONT, fontSize: size, fontWeight: 800, color: C.white, lineHeight: 1.12, letterSpacing: 0.2 }}>{main}</div>
    {sub && <div dir="rtl" style={{ fontFamily: FONT, fontSize: size * 0.5, fontWeight: 600, color: C.cyan, marginTop: 10 }}>{sub}</div>}
  </FloatIn>
);

export const VLogo: React.FC<{ size?: number; at?: number }> = ({ size = 120, at = 0 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 16, mass: 0.9 } });
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 18, transform: `scale(${0.8 + 0.2 * s})`, opacity: clamp((f - at) / 12) }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        <defs>
          <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.cyan} /><stop offset="1" stopColor={C.cyan2} />
          </linearGradient>
        </defs>
        <path d="M22 26 L60 96 L98 26 L80 26 L60 62 L40 26 Z" fill="url(#vg)" />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: size * 0.78, fontWeight: 900, color: C.white, letterSpacing: 4 }}>VERO</span>
    </div>
  );
};

export const WifiBadge: React.FC<{ offAt: number }> = ({ offAt }) => {
  const f = useCurrentFrame();
  const off = f >= offAt;
  const flip = interpolate(f - offAt, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', right: 18, top: 16, display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', borderRadius: 999, background: off ? 'rgba(255,124,124,0.16)' : 'rgba(67,221,154,0.16)',
      border: `1px solid ${off ? C.fault : C.ok}66` }}>
      <Icon name={off ? 'wifioff' : 'wifi'} size={20} color={off ? C.fault : C.ok} />
      <span dir="rtl" style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: off ? C.fault : C.ok, opacity: 0.4 + 0.6 * (off ? flip : 1) }}>
        {off ? 'ללא רשת' : 'מחובר'}
      </span>
    </div>
  );
};
