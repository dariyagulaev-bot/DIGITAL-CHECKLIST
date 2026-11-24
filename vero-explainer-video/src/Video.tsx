import { AbsoluteFill, Sequence, Audio, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { C, FONT } from './theme';
import { Bg } from './components/Bg';
import { Device } from './components/Device';
import { Caption } from './components/Caption';
import { Character, CharState } from './components/Character';
import { Icon } from './components/Icon';
import { Chip, Card, Title, VLogo, WifiBadge, FloatIn } from './scenes/parts';

const fps = 30;
// Narration-driven scene lengths (incl. ~0.47s tail), frames @30fps.
const LENS = [322, 228, 331, 346, 384, 362, 412, 421, 353, 364];
const STARTS = LENS.reduce<number[]>((a, l, i) => { a.push(i === 0 ? 0 : a[i - 1] + LENS[i - 1]); return a; }, []);
const TOTAL = LENS.reduce((a, b) => a + b, 0);

const sh = staticFile;
const shot = (n: string) => `shots/${n}.png`;

// Character presenter schedule (one state per scene).
const SCH: CharState[] = [
  { pose: 'front', cx: 720, feetY: 1086, h: 900, tablet: true },
  { pose: 'front', cx: 610, feetY: 1086, h: 880, tablet: true },
  { pose: '3q', cx: 345, feetY: 1082, h: 720, tablet: false },
  { pose: '3q', cx: 345, feetY: 1082, h: 720, tablet: false },
  { pose: '3q', cx: 345, feetY: 1082, h: 720, tablet: false },
  { pose: 'front', cx: 540, feetY: 1086, h: 830, tablet: false },
  { pose: '3q', cx: 345, feetY: 1082, h: 720, tablet: false },
  { pose: '3q', cx: 345, feetY: 1082, h: 720, tablet: false },
  { pose: '3q', cx: 345, feetY: 1082, h: 720, tablet: false },
  { pose: 'front', cx: 560, feetY: 1086, h: 860, tablet: true },
];

const CAPTIONS = [
  'מגיעים לעבודה — מוודאים מערכת נכונה, הסמכה וציוד בטיחות',
  'VERO — מערכת דיגיטלית לניהול בדיקות, תיעוד ואישורים',
  'כל אחד נכנס בחשבון האישי — אין להעביר סיסמה או לחתום בשם אחר',
  'בוחרים מערכת ודרג, מוודאים פרטים — ובוחרים שני מבצעים',
  'מבצעים בפועל, ואז מסמנים תקין / לא תקין + הערה ברורה',
  'הבטיחות קודמת למילוי הטופס — חריג? עוצרים ומדווחים',
  'עובד גם ללא אינטרנט · נשמר מקומית — שומרים לפני היציאה',
  'שני המבצעים חותמים · רק מאשר מורשה מאשר',
  'הכול מתועד — דוח, הדפסה או ייצוא לפי ההרשאות',
  'בודקים. מתעדים. מאשרים. — גם ללא אינטרנט',
];

// Device placement for the UI-walkthrough scenes.
const DEV = { cx: 1285, cy: 452, w: 880 };

const Scene1: React.FC = () => (
  <AbsoluteFill>
    <Title main={'מתחילים נכון'} sub={'לפני הכל — מוודאים'} x={1130} y={150} at={8} />
    <Chip icon="gauge" label="מערכת נכונה" x={1170} y={330} at={24} big />
    <Chip icon="award" label="הסמכה מתאימה" x={1230} y={430} at={40} big color={C.cyan2} />
    <Chip icon="helmet" label="ציוד מגן נדרש" x={1180} y={530} at={56} big color={C.amber} />
  </AbsoluteFill>
);

const Scene2: React.FC = () => (
  <AbsoluteFill>
    <FloatIn at={6} style={{ position: 'absolute', left: 1030, top: 210 }}><VLogo size={104} at={6} /></FloatIn>
    <Title main={''} sub={'מערכת דיגיטלית לבקרה ובדיקות'} x={1055} y={340} at={22} />
    <Chip icon="check" label="ניהול בדיקות" x={1120} y={430} at={34} />
    <Chip icon="file" label="תיעוד מלא" x={1320} y={520} at={48} color={C.cyan2} />
    <Chip icon="award" label="אישורים" x={1180} y={610} at={62} color={C.ok} />
  </AbsoluteFill>
);

const Scene3: React.FC = () => (
  <AbsoluteFill>
    <Device src={shot('01_login')} cx={DEV.cx} cy={DEV.cy} w={DEV.w} appearAt={8} halo={{ x: 0.5, y: 0.78, at: 54 }} />
    <Title main={'כניסה אישית'} x={600} y={120} at={14} size={40} align="center" />
    <Chip icon="lock" label="לא להעביר סיסמה" x={600} y={250} at={30} color={C.fault} />
    <Chip icon="user" label="לא משתמש של אחר" x={600} y={340} at={44} color={C.fault} />
    <Chip icon="pen" label="לא לחתום בשם אחר" x={600} y={430} at={58} color={C.fault} />
  </AbsoluteFill>
);

const Scene4: React.FC = () => (
  <AbsoluteFill>
    <Device src={shot('03b_new_filled')} cx={DEV.cx} cy={DEV.cy} w={DEV.w} appearAt={8} halo={{ x: 0.5, y: 0.22, at: 60 }} />
    <Title main={'בדיקה חדשה'} x={600} y={120} at={14} size={40} align="center" />
    <Chip icon="gauge" label="מערכת" x={620} y={255} at={30} />
    <Chip icon="bars" label="דרג בדיקה" x={620} y={345} at={44} color={C.cyan2} />
    <Chip icon="user" label="שני מבצעים" x={620} y={435} at={60} color={C.amber} />
  </AbsoluteFill>
);

const Scene5: React.FC = () => {
  const f = useCurrentFrame();
  const SWAP = 210;
  return (
    <AbsoluteFill>
      <div style={{ opacity: interpolate(f, [SWAP - 12, SWAP], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        <Device src={shot('04_form_runner')} cx={DEV.cx} cy={DEV.cy} w={DEV.w} appearAt={8} halo={{ x: 0.12, y: 0.3, at: 70 }} />
      </div>
      <div style={{ opacity: interpolate(f, [SWAP, SWAP + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        <Device src={shot('04c_fault')} cx={DEV.cx} cy={DEV.cy} w={DEV.w} appearAt={SWAP} pushIn={false} halo={{ x: 0.5, y: 0.6, at: SWAP + 20 }} />
      </div>
      <Title main={'מבצעים ומסמנים'} x={600} y={120} at={14} size={40} align="center" />
      <Chip icon="check" label="תקין" x={650} y={280} at={40} color={C.ok} />
      <Chip icon="alert" label="לא תקין + הערה" x={610} y={380} at={SWAP + 8} color={C.fault} />
    </AbsoluteFill>
  );
};

const Scene6: React.FC = () => (
  <AbsoluteFill>
    <Title main={'הבטיחות קודמת'} x={1130} y={150} at={8} size={44} />
    <Card icon="eye" title="ריכוז מלא" sub="לא בטאבלט בזמן פעולה" x={1130} y={300} at={24} />
    <Card icon="shield" title="אזור מסוכן" sub="רק עם אישור וציוד מתאים" x={1130} y={400} at={42} color={C.cyan2} />
    <Card icon="stop" title="מצב חריג?" sub="עוצרים ומדווחים לפי הנהלים" x={1130} y={500} at={60} color={C.fault} />
  </AbsoluteFill>
);

const Scene7: React.FC = () => {
  const OFF = 120;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: DEV.cx - DEV.w / 2, top: DEV.cy - (DEV.w / (1280 / 850)) / 2, width: DEV.w, zIndex: 5 }}>
        <WifiBadge offAt={OFF} />
      </div>
      <Device src={shot('04_form_runner')} cx={DEV.cx} cy={DEV.cy} w={DEV.w} appearAt={8} halo={{ x: 0.88, y: 0.92, at: 210 }} />
      <Title main={'עובד גם ללא רשת'} x={600} y={120} at={14} size={38} align="center" />
      <Chip icon="download" label="נשמר מקומית" x={620} y={270} at={OFF + 20} color={C.cyan2} />
      <Chip icon="check" label="שומרים לפני יציאה" x={600} y={360} at={250} color={C.ok} />
    </AbsoluteFill>
  );
};

const Scene8: React.FC = () => (
  <AbsoluteFill>
    <Device src={shot('06_pending')} cx={DEV.cx} cy={DEV.cy} w={DEV.w} appearAt={8} halo={{ x: 0.85, y: 0.4, at: 150 }} />
    <Title main={'חתימה ואישור'} x={600} y={110} at={14} size={38} align="center" />
    <Chip icon="pen" label="מבצע 1 חתם" x={640} y={240} at={30} color={C.ok} />
    <Chip icon="pen" label="מבצע 2 חתם" x={640} y={330} at={46} color={C.ok} />
    <Chip icon="award" label="מאשר מורשה בלבד" x={600} y={430} at={66} color={C.cyan2} />
    <FloatIn at={90} style={{ position: 'absolute', left: 580, top: 540 }}>
      <div dir="rtl" style={{ fontFamily: FONT, fontSize: 19, fontWeight: 700, color: C.t3, background: 'rgba(12,28,54,0.7)',
        border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 16px', whiteSpace: 'nowrap' }}>
        לא תקין → החזרה → תוקן → אושר
      </div>
    </FloatIn>
  </AbsoluteFill>
);

const Scene9: React.FC = () => (
  <AbsoluteFill>
    <Device src={shot('certificate')} cx={DEV.cx} cy={DEV.cy} w={DEV.w} appearAt={8} />
    <Title main={'תיעוד מלא ודוח'} x={600} y={120} at={14} size={38} align="center" />
    <Chip icon="user" label="מי ביצע · מי אישר · מתי" x={560} y={260} at={30} />
    <FloatIn at={52} style={{ position: 'absolute', left: 560, top: 370, display: 'flex', gap: 14 }}>
      {[['file', 'PDF', C.fault], ['bars', 'Excel', C.ok], ['printer', 'הדפסה', C.cyan], ['download', 'ייצוא', C.cyan2]].map(([ic, lb, col], i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 92, padding: '16px 6px',
          borderRadius: 14, background: 'rgba(12,28,54,0.82)', border: `1px solid ${C.line}` }}>
          <Icon name={ic as string} size={28} color={col as string} />
          <span style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: C.white }}>{lb as string}</span>
        </div>
      ))}
    </FloatIn>
  </AbsoluteFill>
);

const Scene10: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <FloatIn at={20} style={{ position: 'absolute', left: 980, top: 300 }}><VLogo size={120} at={20} /></FloatIn>
      <FloatIn at={46} style={{ position: 'absolute', left: 1005, top: 440 }}>
        <div dir="rtl" style={{ fontFamily: FONT, fontSize: 40, fontWeight: 800, color: C.cyan }}>בודקים. מתעדים. מאשרים.</div>
      </FloatIn>
      <FloatIn at={66} style={{ position: 'absolute', left: 1005, top: 510 }}>
        <div dir="rtl" style={{ fontFamily: FONT, fontSize: 26, fontWeight: 600, color: C.t3 }}>גם כשאין רשת.</div>
      </FloatIn>
      <AbsoluteFill style={{ background: C.bg1, opacity: interpolate(f, [LENS[9] - 22, LENS[9] - 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} />
    </AbsoluteFill>
  );
};

const Flash: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: 'rgba(84,199,245,0.06)', opacity: interpolate(f, [0, 8, 16], [0, 1, 0]) }} />;
};

const SCENES = [Scene1, Scene2, Scene3, Scene4, Scene5, Scene6, Scene7, Scene8, Scene9, Scene10];

export const VIDEO = { fps, durationInFrames: TOTAL };

export const VeroExplainer: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg1, fontFamily: FONT }}>
      <Bg />
      {/* scene content */}
      {SCENES.map((S, i) => (
        <Sequence key={i} from={STARTS[i]} durationInFrames={LENS[i]} name={`sc${i + 1}`}><S /></Sequence>
      ))}
      {/* persistent guide */}
      <Character schedule={SCH} starts={STARTS} />
      {/* captions on top */}
      {CAPTIONS.map((t, i) => (
        <Sequence key={`c${i}`} from={STARTS[i]} durationInFrames={LENS[i]}><Caption text={t} /></Sequence>
      ))}
      {/* scene-boundary soft flashes */}
      {STARTS.slice(1).map((s, i) => (
        <Sequence key={`fl${i}`} from={s - 8} durationInFrames={16}><Flash /></Sequence>
      ))}
      {/* narration */}
      {LENS.map((_, i) => (
        <Sequence key={`a${i}`} from={STARTS[i]} durationInFrames={LENS[i]}>
          <Audio src={sh(`audio/sc${i + 1}.wav`)} />
        </Sequence>
      ))}
      {/* background music */}
      <Audio src={sh('audio/music.wav')} volume={(ff) => interpolate(ff, [0, 40, TOTAL - 60, TOTAL], [0, 0.11, 0.11, 0], { extrapolateRight: 'clamp' })} />
      {/* light SFX */}
      <Sequence from={STARTS[1] + 6} durationInFrames={60}><Audio src={sh('audio/sfx_power.wav')} volume={0.4} /></Sequence>
      <Sequence from={STARTS[2] + 54} durationInFrames={24}><Audio src={sh('audio/sfx_click.wav')} volume={0.35} /></Sequence>
      <Sequence from={STARTS[7] + 150} durationInFrames={60}><Audio src={sh('audio/sfx_approve.wav')} volume={0.4} /></Sequence>
    </AbsoluteFill>
  );
};
