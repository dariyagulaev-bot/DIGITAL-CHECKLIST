import { Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
const POSES: Record<string, { src: string; w: number; h: number }> = {
  front: { src: 'character/pose_front.png', w: 280, h: 946 },
  '3q': { src: 'character/pose_3q.png', w: 262, h: 949 },
  side: { src: 'character/pose_side.png', w: 190, h: 942 },
  back: { src: 'character/pose_back.png', w: 278, h: 944 },
};
export type CharState = { pose: string; cx: number; feetY: number; h: number; tablet?: boolean };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export const Character: React.FC<{ schedule: CharState[]; starts: number[] }> = ({ schedule, starts }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  let i = 0; for (let k = 0; k < schedule.length; k++) if (f >= starts[k]) i = k;
  const local = f - starts[i];
  const cur = schedule[i]; const prev = schedule[Math.max(0, i - 1)];
  const e = ease(clamp(local / 20));
  const cx = i > 0 ? lerp(prev.cx, cur.cx, e) : cur.cx;
  const h = i > 0 ? lerp(prev.h, cur.h, e) : cur.h;
  const feetY = i > 0 ? lerp(prev.feetY, cur.feetY, e) : cur.feetY;
  const bob = Math.sin(f / 15) * 5 + Math.sin(f / 7) * 1.2;
  const sway = Math.sin(f / 95) * 1.1;
  const intro = spring({ frame: f, fps, config: { damping: 20, mass: 1.1 } });
  const introY = i === 0 ? (1 - intro) * 70 : 0;
  const introOp = i === 0 ? intro : 1;
  const poseChanged = i > 0 && prev.pose !== cur.pose;
  const blend = poseChanged ? clamp(local / 12) : 1;
  const draw = (pose: string, op: number) => {
    const P = POSES[pose]; const w = h * (P.w / P.h);
    return (
      <div style={{ position: 'absolute', left: cx - w / 2, top: feetY - h, width: w, height: h, opacity: op }}>
        <Img src={staticFile(P.src)} style={{ width: '100%', height: '100%' }} />
        {pose === 'front' && cur.tablet && (
          <div style={{ position: 'absolute', left: '34%', top: '27.5%', width: '39%', height: '9%',
            borderRadius: 6, background: 'linear-gradient(135deg, rgba(84,199,245,0.55), rgba(34,211,238,0.25))',
            boxShadow: '0 0 22px rgba(84,199,245,0.6)', opacity: 0.55 + 0.25 * Math.sin(f / 10) }} />
        )}
      </div>
    );
  };
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${sway}px, ${bob + introY}px)`, opacity: introOp }}>
      {/* soft contact shadow */}
      <div style={{ position: 'absolute', left: cx - h * 0.14, top: feetY - 18, width: h * 0.28, height: 30,
        borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(2,8,18,0.5), transparent)' }} />
      {poseChanged && draw(prev.pose, 1 - blend)}
      {draw(cur.pose, blend)}
    </div>
  );
};
