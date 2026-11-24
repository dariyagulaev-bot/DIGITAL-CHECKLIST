import { useCurrentFrame, interpolate } from 'remotion';
import { C, FONT } from '../theme';
export const Caption: React.FC<{ text: string; appearAt?: number }> = ({ text, appearAt = 6 }) => {
  const f = useCurrentFrame();
  const op = interpolate(f - appearAt, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(f - appearAt, [0, 10], [16, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', bottom: 64, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: op }}>
      <div dir="rtl" style={{ transform: `translateY(${y}px)`, maxWidth: 1400, padding: '14px 30px', borderRadius: 16,
        background: 'rgba(8,20,40,0.6)', backdropFilter: 'blur(4px)', border: `1px solid ${C.line}`,
        fontFamily: FONT, fontSize: 32, fontWeight: 700, color: C.white, textAlign: 'center', lineHeight: 1.3 }}>
        {text}
      </div>
    </div>
  );
};
