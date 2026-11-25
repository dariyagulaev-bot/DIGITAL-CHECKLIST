import React from "react";
import { C } from "./ui";
import { LoginScreen } from "./screens/Login";
import { HomeScreen } from "./screens/Home";
import { WizardScreen } from "./screens/Wizard";
import { ExecutionScreen } from "./screens/Execution";
import { T, easeOut, fingerAt, isPressing, isSigning, ramp, scrollAt, tapTimes } from "./timeline";

export const SCREEN_W = 1600;
export const SCREEN_H = 1000;
export const BEZEL = 48;

const SCREENS: { from: number; render: (t: number) => React.ReactNode }[] = [
  { from: -1, render: (t) => <LoginScreen t={t} /> },
  { from: T.toHome, render: (t) => <HomeScreen t={t} /> },
  { from: T.toWizard, render: (t) => <WizardScreen t={t} /> },
  { from: T.toExec, render: (t) => <ExecutionScreen t={t} /> },
];
const XFADE = 0.35;

const ScreenRouter: React.FC<{ t: number }> = ({ t }) => {
  let idx = 0;
  for (let i = 0; i < SCREENS.length; i++) if (t >= SCREENS[i].from) idx = i;
  const p = easeOut(ramp(t, SCREENS[idx].from, SCREENS[idx].from + XFADE));
  return (
    <>
      {p < 1 && idx > 0 ? <div style={{ position: "absolute", inset: 0 }}>{SCREENS[idx - 1].render(t)}</div> : null}
      <div style={{ position: "absolute", inset: 0, opacity: idx > 0 ? p : 1, translate: `${(1 - p) * -60}px 0px` }}>
        {SCREENS[idx].render(t)}
      </div>
    </>
  );
};

/** Cartoon hand with the index finger tip at (0,0); the arm runs off to the lower right. */
const Hand: React.FC<{ pressing: boolean }> = ({ pressing }) => (
  <svg width={520} height={520} viewBox="-60 -20 520 520" style={{ position: "absolute", left: -60, top: -20, overflow: "visible" }}>
    <g style={{ scale: pressing ? "0.93" : "1", transformOrigin: "0px 0px" }}>
      <g transform="translate(-28 -3)">
      {/* sleeve */}
      <path d="M205 272 L 600 640" stroke={C.shirt} strokeWidth={124} strokeLinecap="round" />
      <path d="M190 258 L 214 280" stroke="#e8eefc" strokeWidth={128} strokeLinecap="butt" />
      {/* palm + curled fingers */}
      <path
        d="M14 6 C 30 -4, 46 8, 44 26 L 40 110 C 60 92, 96 96, 104 118 C 124 104, 156 112, 160 136 C 182 128, 206 142, 204 168 L 196 226 C 192 262, 160 290, 118 292 L 80 290 C 50 286, 28 262, 22 232 L 4 150 C 0 128, 18 116, 30 126 L 10 24 C 8 14, 10 8, 14 6 Z"
        fill={C.skin}
        stroke={C.skinShade}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d="M44 112 L 44 150 M 104 120 L 102 160 M 160 138 L 156 176" stroke={C.skinShade} strokeWidth={4} strokeLinecap="round" />
      {/* fingernail */}
      <path d="M18 14 C 22 4, 38 4, 40 16 L 38 34 C 30 30, 24 30, 18 34 Z" fill="#f9dcc6" />
      </g>
    </g>
  </svg>
);

const Ripple: React.FC<{ t: number; scroll: number }> = ({ t, scroll }) => {
  const active = tapTimes.filter((tt) => t >= tt && t < tt + 0.5);
  return (
    <>
      {active.map((tt) => {
        const p = ramp(t, tt, tt + 0.5);
        const pos = fingerAt(tt, scrollAt(tt));
        // keep the ripple attached to content that scrolls
        const dy = scrollAt(tt) - scroll;
        return (
          <div
            key={tt}
            style={{
              position: "absolute",
              left: pos.x - 70,
              top: pos.y + dy - 70,
              width: 140,
              height: 140,
              borderRadius: "50%",
              border: `5px solid ${C.blue}`,
              background: "rgba(37,99,235,0.15)",
              opacity: 1 - p,
              scale: `${0.3 + easeOut(p) * 0.9}`,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

export const Tablet: React.FC<{ t: number; fingerOpacity: number }> = ({ t, fingerOpacity }) => {
  const scroll = scrollAt(t);
  const finger = fingerAt(t, scroll);
  const pressing = isPressing(t) || isSigning(t);
  return (
    <div
      style={{
        position: "relative",
        width: SCREEN_W + BEZEL * 2,
        height: SCREEN_H + BEZEL * 2,
        borderRadius: 72,
        background: "linear-gradient(145deg, #2b3140 0%, #12151c 60%)",
        boxShadow: "0 40px 80px rgba(0,0,0,0.45), inset 0 0 0 4px #3a4254",
      }}
    >
      {/* camera dot */}
      <div style={{ position: "absolute", left: (SCREEN_W + BEZEL * 2) / 2 - 7, top: 17, width: 14, height: 14, borderRadius: 7, background: "#3b4456" }} />
      <div
        style={{
          position: "absolute",
          left: BEZEL,
          top: BEZEL,
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: 18,
          overflow: "hidden",
          background: C.bg,
          fontFamily: "Rubik, sans-serif",
        }}
      >
        <ScreenRouter t={t} />
        <Ripple t={t} scroll={scroll} />
      </div>
      {/* finger (not clipped by the screen) */}
      {fingerOpacity > 0.01 ? (
        <div
          style={{
            position: "absolute",
            left: BEZEL + finger.x,
            top: BEZEL + finger.y,
            opacity: fingerOpacity,
            filter: "drop-shadow(10px 18px 14px rgba(0,0,0,0.28))",
          }}
        >
          <Hand pressing={pressing} />
        </div>
      ) : null}
    </div>
  );
};
