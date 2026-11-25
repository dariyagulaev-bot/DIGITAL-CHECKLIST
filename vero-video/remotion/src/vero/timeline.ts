// Single source of truth for every timing in the VERO inspection video.
// All times are in seconds from the start of the video.

export const FPS = 30;
export const DURATION_S = 118;

// ---------- math helpers ----------
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const eio = (t: number, a: number, b: number) => easeInOut(ramp(t, a, b));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** 0→1 at [a, a+fade], 1→0 at [b-fade, b] */
export const windowIn = (t: number, a: number, b: number, fade = 0.35) =>
  Math.min(easeOut(ramp(t, a, a + fade)), 1 - easeInOut(ramp(t, b - fade, b)));

// ---------- camera: 0 = wide shot (character), 1 = tablet close-up ----------
export const ZOOM_DUR = 1.2;
export const zoomEvents: { t: number; to: 0 | 1 }[] = [
  { t: 9.0, to: 1 },
  { t: 18.0, to: 0 },
  { t: 26.0, to: 1 },
  { t: 42.5, to: 0 },
  { t: 51.0, to: 1 },
  { t: 75.0, to: 0 },
  { t: 84.0, to: 1 },
  { t: 93.5, to: 0 },
  { t: 102.0, to: 1 },
  { t: 108.5, to: 0 },
];
export const zoomAt = (t: number) => {
  let p = 0;
  for (const e of zoomEvents) {
    if (t >= e.t) {
      const k = easeInOut(ramp(t, e.t, e.t + ZOOM_DUR));
      p = e.to === 1 ? k : 1 - k;
    }
  }
  return p;
};

// ---------- narration (on-screen captions; also exported as SRT) ----------
export type Caption = { start: number; end: number; text: string };
export const captions: Caption[] = [
  { start: 0.6, end: 4.4, text: "היי! אני ורה, ואני אלווה אתכם במערכת VERO." },
  { start: 4.6, end: 8.8, text: "עכשיו נעשה ביחד בדיקה — ובואו אני אראה לכם בדיוק איך מבצעים אותה." },
  { start: 10.4, end: 17.6, text: "קודם כול מתחברים: שם משתמש, סיסמה — ולוחצים על ״כניסה״." },
  { start: 19.4, end: 22.3, text: "רגע, טיפ חשוב: VERO עובדת בלי אינטרנט בכלל." },
  { start: 22.5, end: 25.7, text: "כל פעולה שאתם עושים נשמרת מיד במכשיר." },
  { start: 27.4, end: 31.0, text: "זה מסך הבית. כדי לפתוח בדיקה — לוחצים על ״בד״ח חדש״." },
  { start: 31.4, end: 35.9, text: "עכשיו בוחרים שלב אחר שלב: סוג המערכת, מספר המערכת…" },
  { start: 36.1, end: 39.1, text: "…ודרג הבדיקה. הדרג קובע איזה בד״ח ייפתח." },
  { start: 39.3, end: 42.3, text: "יש רק בד״ח אחד שמתאים — אז הוא נפתח מיד." },
  { start: 43.9, end: 47.4, text: "שימו לב: תראו רק מערכות ודרגים שאתם מוסמכים אליהם." },
  { start: 47.6, end: 50.8, text: "ואם יש רק אפשרות אחת — המערכת מדלגת עליה בשבילכם." },
  { start: 52.4, end: 56.4, text: "בראש הבד״ח יש רשימת ציוד. מסמנים שהכול אצלכם." },
  { start: 56.6, end: 60.7, text: "בוחרים את מבצע 2 — כל בדיקה מתבצעת בזוג." },
  { start: 61.0, end: 64.2, text: "ועכשיו סעיף אחרי סעיף. מנוע — תקין." },
  { start: 64.4, end: 70.6, text: "במערכת החשמל מצאתי בעיה: ״לא תקין״, ומתארים מה נמצא." },
  { start: 70.8, end: 74.6, text: "אזור העבודה — תקין. כל הסעיפים סומנו!" },
  { start: 76.4, end: 79.8, text: "ומה אם סגרתם את הטאבלט באמצע? אין בעיה." },
  { start: 80.0, end: 83.7, text: "הכול נשמר אוטומטית, והבד״ח מחכה לכם במסך הבית." },
  { start: 85.4, end: 89.1, text: "עכשיו חותמים. קודם מבצע 1…" },
  { start: 89.5, end: 93.2, text: "…ואחריו מבצע 2." },
  { start: 94.9, end: 98.2, text: "חשוב: בלי שני מבצעים ושתי חתימות — אין העברה לאישור." },
  { start: 98.4, end: 101.8, text: "ואם חסר משהו, המערכת תראה לכם בדיוק מה." },
  { start: 103.4, end: 105.6, text: "כשהכול מוכן — לוחצים ״סיום והעברה לאישור״." },
  { start: 105.8, end: 108.3, text: "הבד״ח עובר לסטטוס ״ממתין לאישור״." },
  { start: 109.9, end: 113.6, text: "זהו! עכשיו אתם יודעים לבצע בדיקה ב־VERO." },
  { start: 113.8, end: 116.0, text: "בהצלחה בבדיקה הבאה!" },
];

// ---------- speech bubbles shown in the wide shots ----------
export type Bubble = {
  start: number;
  end: number;
  kind: "title" | "tip" | "summary";
  label: string;
  title: string;
  body: string;
};
export const bubbles: Bubble[] = [
  {
    start: 0.8,
    end: 8.9,
    kind: "title",
    label: "מדריך למבצע",
    title: "איך מבצעים בדיקה ב־VERO",
    body: "ביצוע בד״ח — מההתחברות ועד ההעברה לאישור",
  },
  {
    start: 19.3,
    end: 25.8,
    kind: "tip",
    label: "כדאי לדעת",
    title: "עובדת גם בלי אינטרנט",
    body: "כל פעולה נשמרת מיד במכשיר. אין צורך ברשת כדי למלא, לחתום או לאשר.",
  },
  {
    start: 43.8,
    end: 50.9,
    kind: "tip",
    label: "כדאי לדעת",
    title: "רואים רק את מה שמותר",
    body: "מוצגות רק מערכות ודרגים שאתם מוסמכים אליהם. שלב עם אפשרות אחת — מדולג אוטומטית.",
  },
  {
    start: 76.3,
    end: 83.8,
    kind: "tip",
    label: "כדאי לדעת",
    title: "שמירה אוטומטית",
    body: "אין כפתור ״שמור״. בד״ח שלא הושלם נשמר כטיוטה ומחכה במסך הבית תחת ״המשך בד״ח״.",
  },
  {
    start: 94.8,
    end: 101.9,
    kind: "tip",
    label: "כדאי לדעת",
    title: "שני מבצעים, שתי חתימות",
    body: "בלי מבצע 2 ושתי חתימות אי אפשר להעביר לאישור. חסר משהו? תוצג רשימת התיקונים.",
  },
  {
    start: 109.8,
    end: 116.0,
    kind: "summary",
    label: "סיכום",
    title: "חמישה שלבים לבדיקה",
    body: "התחברות ← בד״ח חדש ← מילוי סעיפים ← שתי חתימות ← העברה לאישור",
  },
];

// ---------- character gestures (gesture arm) ----------
export type PoseName = "rest" | "wave" | "present" | "tip";
export const poseWindows: { start: number; end: number; pose: PoseName }[] = [
  { start: 0.5, end: 3.6, pose: "wave" },
  { start: 4.6, end: 8.7, pose: "present" },
  ...bubbles.filter((b) => b.kind === "tip").map((b) => ({ start: b.start - 0.1, end: b.end, pose: "tip" as const })),
  { start: 109.8, end: 113.6, pose: "wave" },
  { start: 113.8, end: 116.2, pose: "present" },
];

// ---------- on-tablet events ----------
export const T = {
  loginUser: 11.0,
  typeUser: [11.3, 12.6] as const,
  loginPass: 13.2,
  typePass: [13.45, 14.6] as const,
  loginBtn: 15.4,
  toHome: 16.0,
  homeNew: 30.4,
  toWizard: 31.2,
  wiz1: 34.0,
  wiz2: 36.6,
  wiz3: 38.9,
  wizAuto: 39.35,
  toExec: 40.6,
  eqGloves: 54.0,
  eqTorch: 55.2,
  ddOpen: 58.0,
  ddPick: 59.3,
  scroll1: 61.0,
  row1: 62.6,
  row2bad: 65.4,
  panelTap: 66.2,
  typeNote: [66.5, 69.3] as const,
  panelSave: 70.2,
  row3: 72.6,
  scroll2: 85.3,
  sign1: [87.0, 88.8] as const,
  save1: 89.3,
  sign2: [90.2, 92.0] as const,
  save2: 92.6,
  scroll3: 103.3,
  submit: 105.0,
};

export const USERNAME = "israel.i";
export const NOTE_TEXT = "נמצא חיבור רופף במחבר הראשי";

/** Scroll offset of the inspection screen content, in screen units. */
export const scrollAt = (t: number) => {
  if (t < T.scroll2) return lerp(0, 300, eio(t, T.scroll1, T.scroll1 + 0.8));
  if (t < T.scroll3) return lerp(300, 700, eio(t, T.scroll2, T.scroll2 + 1.1));
  return lerp(700, 0, eio(t, T.scroll3, T.scroll3 + 0.9));
};

/** Extra height inserted under row 2 by the fault-details panel. */
export const PANEL_OPEN = 170;
export const PANEL_NOTE = 56;
export const panelExtra = (t: number) => {
  if (t < T.panelSave + 0.1) return PANEL_OPEN * easeOut(ramp(t, T.row2bad + 0.1, T.row2bad + 0.5));
  return lerp(PANEL_OPEN, PANEL_NOTE, easeInOut(ramp(t, T.panelSave + 0.1, T.panelSave + 0.5)));
};

// ---------- signatures (content coordinates of the inspection screen) ----------
export type Pt = { x: number; y: number };
const sigPoints = (x0: number, y0: number, w: number, h: number, seed: number): Pt[] => {
  const pts: Pt[] = [];
  const N = 70;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // Hebrew signatures run right-to-left.
    const x = x0 + (1 - u) * w;
    const y =
      y0 +
      h * 0.5 +
      Math.sin(u * Math.PI * 6 + seed) * h * 0.32 * (1 - 0.4 * u) +
      Math.sin(u * Math.PI * 15 + seed * 2) * h * 0.09 -
      (u > 0.85 ? (u - 0.85) * h * 1.4 : 0);
    pts.push({ x, y });
  }
  return pts;
};
// Signature card layout (see Execution.tsx)
export const TABLE_END = 918;
export const SIG_CARD_TOP = 990 + PANEL_NOTE; // 1046
export const SIG_PAD_TOP = SIG_CARD_TOP + 130; // 1176
export const SIG_PAD_H = 140;
export const SIG_BTN_Y = SIG_CARD_TOP + 305; // center of buttons row
export const SIG1 = sigPoints(900, SIG_PAD_TOP + 14, 480, 104, 0.3);
export const SIG2 = sigPoints(200, SIG_PAD_TOP + 14, 480, 104, 1.9);
export const partialPath = (pts: Pt[], p: number): Pt[] => {
  if (p <= 0) return [];
  const f = p * (pts.length - 1);
  const i = Math.floor(f);
  const out = pts.slice(0, i + 1);
  if (i < pts.length - 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const k = f - i;
    out.push({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
  }
  return out;
};

// ---------- the narrator's tapping finger ----------
type KF = { t: number; x: number; y: number; fixed?: boolean; linear?: boolean };
const REST: Pt = { x: 1540, y: 1150 };
const rest = (t: number): KF => ({ t, ...REST, fixed: true });
const tap = (t: number, x: number, y: number, fixed = false): KF[] => [
  { t: t - 0.12, x, y, fixed },
  { t: t + 0.18, x, y, fixed },
];
const sign = (pts: Pt[], a: number, b: number): KF[] =>
  pts.map((p, i) => ({ t: a + ((b - a) * i) / (pts.length - 1), x: p.x, y: p.y, linear: true }));

const ROW_Y = (i: number) => 690 + 38 + i * 76; // row centers (content coords)

export const fingerKF: KF[] = [
  rest(10.2),
  ...tap(T.loginUser, 1180, 465),
  ...tap(T.loginPass, 1180, 595),
  ...tap(T.loginBtn, 1180, 707),
  rest(16.5),
  rest(27.2),
  ...tap(T.homeNew, 1155, 495),
  ...tap(T.wiz1, 1220, 405),
  ...tap(T.wiz2, 1220, 405),
  ...tap(T.wiz3, 1220, 405),
  rest(40.0),
  rest(52.2),
  ...tap(T.eqGloves, 1458, 425),
  ...tap(T.eqTorch, 1058, 425),
  ...tap(T.ddOpen, 800, 572),
  ...tap(T.ddPick, 800, 635),
  ...tap(T.row1, 495, ROW_Y(0)),
  ...tap(T.row2bad, 340, ROW_Y(1)),
  ...tap(T.panelTap, 1020, 910),
  { t: 69.5, x: 1060, y: 935 },
  ...tap(T.panelSave, 215, 910),
  ...tap(T.row3, 495, ROW_Y(2) + PANEL_NOTE),
  rest(73.8),
  rest(85.2),
  ...sign(SIG1, T.sign1[0], T.sign1[1]),
  ...tap(T.save1, 1385, SIG_BTN_Y),
  ...sign(SIG2, T.sign2[0], T.sign2[1]),
  ...tap(T.save2, 685, SIG_BTN_Y),
  rest(93.4),
  rest(103.2),
  ...tap(T.submit, 290, 955, true),
  rest(106.2),
];

export const tapTimes = [
  T.loginUser, T.loginPass, T.loginBtn, T.homeNew, T.wiz1, T.wiz2, T.wiz3,
  T.eqGloves, T.eqTorch, T.ddOpen, T.ddPick, T.row1, T.row2bad, T.panelTap,
  T.panelSave, T.row3, T.save1, T.save2, T.submit,
];

/** Finger tip position in tablet-screen coordinates. */
export const fingerAt = (t: number, scroll: number): Pt => {
  const k = fingerKF;
  const toScreen = (f: KF): Pt => ({ x: f.x, y: f.fixed ? f.y : f.y - scroll });
  if (t <= k[0].t) return toScreen(k[0]);
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i];
    const b = k[i + 1];
    if (t >= a.t && t < b.t) {
      const raw = (t - a.t) / (b.t - a.t);
      const p = a.linear && b.linear ? raw : easeInOut(raw);
      const A = toScreen(a);
      const B = toScreen(b);
      // lift the finger a little while travelling between distant points
      const dist = Math.hypot(B.x - A.x, B.y - A.y);
      const lift = a.linear && b.linear ? 0 : Math.sin(Math.PI * p) * Math.min(40, dist * 0.08);
      return { x: lerp(A.x, B.x, p), y: lerp(A.y, B.y, p) - lift };
    }
  }
  return toScreen(k[k.length - 1]);
};

export const isPressing = (t: number) => tapTimes.some((tt) => Math.abs(t - tt) < 0.09);
export const isSigning = (t: number) =>
  (t >= T.sign1[0] && t <= T.sign1[1]) || (t >= T.sign2[0] && t <= T.sign2[1]);

// ---------- sound effects ----------
export type Sfx = { t: number; file: string; volume: number; dur?: number };
export const sfx: Sfx[] = [
  ...tapTimes.map((t) => ({ t: t - 0.03, file: "click-soft.mp3", volume: 0.7 })),
  ...zoomEvents.map((e) => ({ t: e.t, file: "whoosh-short.mp3", volume: 0.35 })),
  ...bubbles.map((b) => ({ t: b.start, file: "pop.mp3", volume: 0.45 })),
  { t: T.typeUser[0], file: "typing.mp3", volume: 0.4, dur: T.typeUser[1] - T.typeUser[0] },
  { t: T.typePass[0], file: "typing.mp3", volume: 0.4, dur: T.typePass[1] - T.typePass[0] },
  { t: T.typeNote[0], file: "typing.mp3", volume: 0.4, dur: T.typeNote[1] - T.typeNote[0] },
  { t: T.submit + 0.15, file: "chime.mp3", volume: 0.5 },
  { t: 116.0, file: "sparkle.mp3", volume: 0.45 },
];
