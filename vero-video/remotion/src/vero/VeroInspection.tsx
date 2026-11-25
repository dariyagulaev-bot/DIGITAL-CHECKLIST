import "@fontsource/rubik/hebrew-400.css";
import "@fontsource/rubik/hebrew-500.css";
import "@fontsource/rubik/hebrew-700.css";
import "@fontsource/rubik/latin-400.css";
import "@fontsource/rubik/latin-500.css";
import "@fontsource/rubik/latin-700.css";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { Background, Bubbles, Captions, EndCard } from "./Overlays";
import { CharacterBody, HoldingArm, tabletBob } from "./Character";
import { Tablet, BEZEL, SCREEN_H, SCREEN_W } from "./Tablet";
import { lerp, ramp, sfx, zoomAt } from "./timeline";
import { FONT } from "./ui";

// Where the tablet sits in the wide shot (world coordinates).
const TABLET_CX = 700;
const TABLET_CY = 560;
const TABLET_SCALE = 0.46;
// Close-up camera: zoom factor and where the tablet centre lands on screen.
const ZOOM = 1.865;
const CLOSE_ANCHOR = { x: 960, y: 478 };

const Camera: React.FC<{ p: number; children: React.ReactNode }> = ({ p, children }) => {
  const z = Math.exp(lerp(0, Math.log(ZOOM), p));
  const fx = lerp(960, TABLET_CX, p);
  const fy = lerp(540, TABLET_CY, p);
  const ax = lerp(960, CLOSE_ANCHOR.x, p);
  const ay = lerp(540, CLOSE_ANCHOR.y, p);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        transformOrigin: "0 0",
        transform: `translate(${ax}px, ${ay}px) scale(${z}) translate(${-fx}px, ${-fy}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const VeroInspection: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const p = zoomAt(t);
  const W = SCREEN_W + BEZEL * 2;
  const H = SCREEN_H + BEZEL * 2;
  const endFrom = durationInFrames / fps - 2.2;

  return (
    <AbsoluteFill style={{ background: "#0b1630", fontFamily: FONT, overflow: "hidden" }}>
      <Camera p={p}>
        <Background />
        <CharacterBody t={t} />
        {/* dim the room while we are looking at the tablet */}
        <div style={{ position: "absolute", left: -400, top: -300, width: 2720, height: 1680, background: "#050b1a", opacity: 0.5 * p }} />
        <div
          style={{
            position: "absolute",
            left: TABLET_CX - W / 2,
            top: TABLET_CY - H / 2 + tabletBob(t),
            width: W,
            height: H,
            scale: `${TABLET_SCALE}`,
          }}
        >
          <Tablet t={t} fingerOpacity={ramp(p, 0.85, 1)} />
        </div>
        <HoldingArm t={t} />
      </Camera>

      <Bubbles t={t} />
      <Captions t={t} />
      <EndCard t={t} from={endFrom} />
      {/* fade in from black */}
      <AbsoluteFill style={{ background: "#000", opacity: 1 - ramp(t, 0, 0.7), pointerEvents: "none" }} />

      {sfx.map((s, i) => (
        <Sequence
          key={i}
          name={`sfx ${s.file}`}
          from={Math.round(s.t * fps)}
          durationInFrames={s.dur ? Math.round(s.dur * fps) : undefined}
          layout="none"
        >
          <Audio src={staticFile(`sfx/${s.file}`)} volume={s.volume} loop={Boolean(s.dur)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
