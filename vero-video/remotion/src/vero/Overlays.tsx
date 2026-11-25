import React from "react";
import { C, Icon, VeroMark } from "./ui";
import { Bubble, bubbles, captions, easeOut, ramp, windowIn } from "./timeline";

const backOut = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

const BubbleCard: React.FC<{ b: Bubble; t: number }> = ({ b, t }) => {
  const k = windowIn(t, b.start, b.end, 0.3);
  if (k <= 0) return null;
  const pop = backOut(ramp(t, b.start, b.start + 0.45));
  const accent = b.kind === "tip" ? "#d97706" : C.blue;
  const accentSoft = b.kind === "tip" ? "#fef3c7" : C.blueSoft;
  return (
    <div
      dir="rtl"
      style={{
        position: "absolute",
        left: 150,
        top: 44,
        width: 1110,
        opacity: k,
        scale: `${0.86 + 0.14 * pop}`,
        transformOrigin: "100% 70%",
      }}
    >
      <div
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 36,
          padding: "30px 40px 34px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          display: "flex",
          gap: 30,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 26,
            background: accentSoft,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={b.kind === "tip" ? "bulb" : b.kind === "summary" ? "check" : "clipboard"} size={54} color={accent} stroke={2.2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: accent, letterSpacing: 0.5 }}>{b.label}</div>
          <div style={{ fontSize: 54, fontWeight: 700, color: C.navy, lineHeight: 1.15, marginTop: 4 }}>{b.title}</div>
          <div style={{ fontSize: 34, color: "#334155", lineHeight: 1.4, marginTop: 10 }}>{b.body}</div>
        </div>
        {/* tail pointing at Vera */}
        <svg width={120} height={110} style={{ position: "absolute", right: -92, bottom: 30, overflow: "visible" }}>
          <path d="M0 0 L110 70 L0 58 Z" fill="#fff" />
        </svg>
      </div>
    </div>
  );
};

export const Bubbles: React.FC<{ t: number }> = ({ t }) => (
  <>
    {bubbles.map((b) => (
      <BubbleCard key={b.start} b={b} t={t} />
    ))}
  </>
);

export const Captions: React.FC<{ t: number }> = ({ t }) => {
  const c = captions.find((x) => t >= x.start && t < x.end);
  if (!c) return null;
  const k = windowIn(t, c.start, c.end, 0.18);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, display: "flex", justifyContent: "center" }}>
      <div
        dir="rtl"
        style={{
          maxWidth: 1720,
          background: "rgba(8,15,32,0.84)",
          color: "#fff",
          fontSize: 46,
          fontWeight: 500,
          lineHeight: 1.3,
          padding: "14px 36px 16px",
          borderRadius: 20,
          textAlign: "center",
          opacity: k,
          translate: `0px ${(1 - k) * 10}px`,
        }}
      >
        {c.text}
      </div>
    </div>
  );
};

export const EndCard: React.FC<{ t: number; from: number }> = ({ t, from }) => {
  const k = easeOut(ramp(t, from, from + 0.8));
  if (k <= 0) return null;
  const k2 = easeOut(ramp(t, from + 0.4, from + 1.2));
  return (
    <div
      dir="rtl"
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(circle at 50% 40%, ${C.navy2} 0%, ${C.navy} 70%)`,
        opacity: k,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28, direction: "ltr", scale: `${0.9 + 0.1 * k2}` }}>
        <div style={{ width: 150, height: 150, borderRadius: 36, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <VeroMark size={110} />
        </div>
        <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: 6 }}>VERO</div>
      </div>
      <div style={{ fontSize: 40, color: "#b9c6e4", marginTop: 26, opacity: k2 }}>מערכת בקרה דיגיטלית · בד״ח דיגיטלי</div>
      <div style={{ fontSize: 58, fontWeight: 700, marginTop: 46, opacity: k2 }}>בהצלחה בבדיקה הבאה!</div>
    </div>
  );
};

export const Background: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: -400,
      top: -300,
      width: 2720,
      height: 1680,
      background: `radial-gradient(ellipse at 62% 45%, #24418a 0%, ${C.navy2} 35%, ${C.navy} 75%)`,
    }}
  >
    <svg width={2720} height={1680} style={{ position: "absolute", inset: 0, opacity: 0.09 }}>
      {Array.from({ length: 46 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 60} y1={0} x2={i * 60} y2={1680} stroke="#a9c1ff" strokeWidth={1.5} />
      ))}
      {Array.from({ length: 29 }).map((_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 60} x2={2720} y2={i * 60} stroke="#a9c1ff" strokeWidth={1.5} />
      ))}
    </svg>
    <svg width={2720} height={1680} style={{ position: "absolute", inset: 0, opacity: 0.07 }}>
      <path d="M380 420 L560 900 L760 380" stroke="#d6e3ff" strokeWidth={110} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M2120 1060 L2260 1420 L2460 1000" stroke="#d6e3ff" strokeWidth={90} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
    {/* floor glow */}
    <div
      style={{
        position: "absolute",
        left: 400 + 1000,
        top: 300 + 860,
        width: 1300,
        height: 380,
        borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(120,160,255,0.22) 0%, rgba(120,160,255,0) 70%)",
      }}
    />
  </div>
);
