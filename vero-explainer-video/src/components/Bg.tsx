import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { C } from '../theme';
export const Bg: React.FC = () => {
  const f = useCurrentFrame();
  const gx = 62 + Math.sin(f / 120) * 8;
  const gy = 26 + Math.cos(f / 150) * 6;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${C.bg0}, ${C.bg1})` }}>
      <AbsoluteFill style={{ background: `radial-gradient(1100px 700px at ${gx}% ${gy}%, rgba(46,125,255,0.35), rgba(46,125,255,0) 60%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(900px 600px at 15% 88%, rgba(34,211,238,0.16), rgba(34,211,238,0) 60%)` }} />
      {/* faint dot grid */}
      <AbsoluteFill style={{ opacity: 0.06, backgroundImage: 'radial-gradient(rgba(140,180,230,0.9) 1.4px, transparent 1.4px)', backgroundSize: '46px 46px' }} />
      <AbsoluteFill style={{ opacity: interpolate(f % 300, [0, 150, 300], [0.0, 0.05, 0.0]), background: 'radial-gradient(1200px 800px at 80% 40%, rgba(84,199,245,0.12), transparent 60%)' }} />
    </AbsoluteFill>
  );
};
