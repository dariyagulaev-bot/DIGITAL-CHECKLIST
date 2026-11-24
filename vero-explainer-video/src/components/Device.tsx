import { Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { C } from '../theme';
export const Device: React.FC<{
  src: string; cx: number; cy: number; w: number; appearAt?: number;
  pushIn?: boolean; halo?: { x: number; y: number; at: number } | null; glow?: boolean;
}> = ({ src, cx, cy, w, appearAt = 0, pushIn = true, halo = null, glow = true }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const t = f - appearAt;
  const s = spring({ frame: t, fps, config: { damping: 18, mass: 0.7 } });
  const ps = pushIn ? interpolate(t, [0, 160], [1, 1.05], { extrapolateRight: 'clamp' }) : 1;
  const op = interpolate(t, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const ar = 1280 / 850;
  const h = w / ar;
  const pad = 14;
  return (
    <div style={{ position: 'absolute', left: cx - w / 2, top: cy - h / 2, width: w, height: h,
      transform: `translateY(${(1 - s) * 40}px) scale(${(0.96 + 0.04 * s) * ps})`, opacity: op }}>
      {glow && <div style={{ position: 'absolute', inset: -60, background: 'radial-gradient(closest-side, rgba(84,199,245,0.25), transparent 70%)' }} />}
      <div style={{ position: 'absolute', inset: -pad, borderRadius: 26, background: '#0A1A33',
        boxShadow: '0 30px 70px rgba(2,8,20,0.55)', border: '1px solid rgba(120,160,210,0.25)' }} />
      <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 14, objectFit: 'cover' }} />
      {halo && t >= halo.at && (
        <Halo x={halo.x * w} y={halo.y * h} t={f - (appearAt + halo.at)} />
      )}
    </div>
  );
};
const Halo: React.FC<{ x: number; y: number; t: number }> = ({ x, y, t }) => {
  const pulse = (t % 40) / 40;
  const r = interpolate(pulse, [0, 1], [10, 46]);
  const op = interpolate(pulse, [0, 1], [0.55, 0]);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)' }}>
      <div style={{ position: 'absolute', left: -r, top: -r, width: r * 2, height: r * 2, borderRadius: '50%', border: `3px solid rgba(84,199,245,${op})` }} />
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(84,199,245,0.9)', transform: 'translate(-50%,-50%)', boxShadow: '0 0 14px rgba(84,199,245,0.9)' }} />
    </div>
  );
};
