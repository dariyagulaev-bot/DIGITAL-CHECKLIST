import React from "react";
import { C } from "./ui";
import { PoseName, captions, lerp, poseWindows, windowIn } from "./timeline";

// Vera — original cartoon narrator, drawn in world coordinates (1920×1080 stage).

type P = { x: number; y: number };
const SHOULDER_R: P = { x: 1532, y: 505 }; // gesture arm (viewer's right)
const SHOULDER_L: P = { x: 1308, y: 505 }; // tablet-holding arm (viewer's left)

export const tabletBob = (t: number) => Math.sin(t * 1.3) * 4;
const breath = (t: number) => Math.sin(t * 1.7) * 2.5;

const talking = (t: number) => captions.some((c) => t >= c.start && t <= c.end - 0.1);
const mouthOpen = (t: number) => {
  if (!talking(t)) return 0;
  const v = Math.abs(Math.sin(t * 10.7) * Math.sin(t * 3.9 + 1.1));
  const gap = Math.sin(t * 2.3) < -0.8 ? 0.15 : 1; // short pauses between words
  return Math.min(1, (0.1 + v * 0.95) * gap);
};
const blink = (t: number) => {
  const ph = (t + 0.3) % 3.7;
  if (ph < 0.16) return Math.abs(ph - 0.08) / 0.08;
  const ph2 = (t + 2.1) % 9.1; // occasional extra blink
  if (ph2 < 0.16) return Math.abs(ph2 - 0.08) / 0.08;
  return 1;
};

type Pose = { e: P; h: P; hand: "fist" | "finger" | "open" };
const poseOf = (name: PoseName, t: number): Pose => {
  switch (name) {
    case "tip":
      return { e: { x: 1622, y: 590 }, h: { x: 1600, y: 448 }, hand: "finger" };
    case "wave":
      return { e: { x: 1625, y: 575 }, h: { x: 1668 + Math.sin(t * 8) * 26, y: 392 }, hand: "open" };
    case "present":
      return { e: { x: 1602, y: 615 }, h: { x: 1702, y: 560 }, hand: "open" };
    default:
      return { e: { x: 1572, y: 645 }, h: { x: 1578, y: 765 }, hand: "fist" };
  }
};

const currentPose = (t: number): { pose: Pose; tipW: number } => {
  const rest = poseOf("rest", t);
  for (const w of poseWindows) {
    if (t >= w.start && t <= w.end) {
      const k = windowIn(t, w.start, w.end, 0.45);
      const target = poseOf(w.pose, t);
      return {
        pose: {
          e: { x: lerp(rest.e.x, target.e.x, k), y: lerp(rest.e.y, target.e.y, k) },
          h: { x: lerp(rest.h.x, target.h.x, k), y: lerp(rest.h.y, target.h.y, k) },
          hand: k > 0.5 ? target.hand : "fist",
        },
        tipW: w.pose === "tip" ? k : 0,
      };
    }
  }
  return { pose: rest, tipW: 0 };
};

const Hand: React.FC<{ h: P; type: Pose["hand"] }> = ({ h, type }) => {
  if (type === "finger") {
    return (
      <g>
        <rect x={h.x - 8} y={h.y - 66} width={16} height={52} rx={8} fill={C.skin} stroke={C.skinShade} strokeWidth={3} />
        <circle cx={h.x} cy={h.y} r={26} fill={C.skin} stroke={C.skinShade} strokeWidth={3} />
        <path d={`M${h.x - 22} ${h.y - 6} q -10 -14 4 -22`} stroke={C.skinShade} strokeWidth={3} fill={C.skin} />
      </g>
    );
  }
  if (type === "open") {
    return (
      <g>
        {[-17, -6, 5, 16].map((dx, i) => (
          <line
            key={dx}
            x1={h.x + dx}
            y1={h.y - 14}
            x2={h.x + dx * 1.25}
            y2={h.y - 50 + Math.abs(i - 1.5) * 5}
            stroke={C.skinShade}
            strokeWidth={15}
            strokeLinecap="round"
          />
        ))}
        {[-17, -6, 5, 16].map((dx, i) => (
          <line
            key={`f${dx}`}
            x1={h.x + dx}
            y1={h.y - 14}
            x2={h.x + dx * 1.25}
            y2={h.y - 50 + Math.abs(i - 1.5) * 5}
            stroke={C.skin}
            strokeWidth={10}
            strokeLinecap="round"
          />
        ))}
        <ellipse cx={h.x} cy={h.y} rx={26} ry={28} fill={C.skin} stroke={C.skinShade} strokeWidth={3} />
        <line x1={h.x - 22} y1={h.y + 4} x2={h.x - 40} y2={h.y - 14} stroke={C.skin} strokeWidth={12} strokeLinecap="round" />
      </g>
    );
  }
  return <circle cx={h.x} cy={h.y} r={25} fill={C.skin} stroke={C.skinShade} strokeWidth={3} />;
};

/** Body, head and gesture arm — drawn behind the tablet. */
export const CharacterBody: React.FC<{ t: number }> = ({ t }) => {
  const by = breath(t);
  const { pose, tipW } = currentPose(t);
  const o = mouthOpen(t);
  const b = blink(t);
  const tilt = -4 * tipW + (talking(t) ? Math.sin(t * 2.6) * 1.2 : 0);
  const brow = 7 * tipW;
  const my = 398;

  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <ellipse cx={1420} cy={1030} rx={200} ry={22} fill="rgba(0,0,0,0.28)" />
      <g transform={`translate(0 ${by})`}>
        {/* legs */}
        <path d="M1294,782 L1546,782 L1530,1000 L1442,1000 L1420,850 L1398,1000 L1310,1000 Z" fill={C.pants} />
        <ellipse cx={1352} cy={1006 - by} rx={56} ry={18} fill="#111827" />
        <ellipse cx={1488} cy={1006 - by} rx={56} ry={18} fill="#111827" />
        {/* torso */}
        <path d="M1302,530 C1306,488 1340,466 1378,462 L1462,462 C1500,466 1534,488 1538,530 L1552,786 C1480,804 1360,804 1288,786 Z" fill={C.shirt} />
        <path d="M1500,470 C1526,486 1536,506 1538,530 L1552,786 C1536,790 1520,792 1504,794 Z" fill={C.shirtShade} opacity={0.7} />
        <rect x={1290} y={772} width={262} height={22} rx={6} fill="#14203a" />
        <rect x={1407} y={774} width={26} height={18} rx={3} fill="#c8a24a" />
        {/* collar + lanyard + badge */}
        <path d="M1382,462 L1420,514 L1458,462 L1440,462 L1420,490 L1400,462 Z" fill="#fff" />
        <path d="M1400,470 L1452,592 M1442,470 L1466,592" stroke="#1e3a8a" strokeWidth={4} />
        <g transform="rotate(-6 1460 625)">
          <rect x={1430} y={588} width={62} height={80} rx={9} fill="#fff" stroke="#cbd5e1" strokeWidth={2} />
          <rect x={1442} y={600} width={38} height={26} rx={4} fill={C.navy} />
          <path d="M1453,606 l5,12 5,-12" stroke="#60a5fa" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x={1440} y={636} width={42} height={5} rx={2.5} fill="#94a3b8" />
          <rect x={1446} y={648} width={30} height={5} rx={2.5} fill="#cbd5e1" />
        </g>
        {/* gesture arm */}
        <path
          d={`M${SHOULDER_R.x} ${SHOULDER_R.y} L${pose.e.x} ${pose.e.y}`}
          stroke={C.shirt}
          strokeWidth={46}
          strokeLinecap="round"
        />
        <path d={`M${pose.e.x} ${pose.e.y} L${pose.h.x} ${pose.h.y}`} stroke={C.shirt} strokeWidth={40} strokeLinecap="round" />
        <Hand h={pose.h} type={pose.hand} />
        {/* holding arm, upper part (forearm + hand are drawn in front of the tablet) */}
        <path d={`M${SHOULDER_L.x} ${SHOULDER_L.y} L1238 655`} stroke={C.shirtShade} strokeWidth={46} strokeLinecap="round" />
        {/* head */}
        <g transform={`rotate(${tilt} 1420 450)`}>
          <rect x={1396} y={410} width={48} height={64} rx={10} fill={C.skinShade} />
          <path d="M1312,340 C1300,230 1350,182 1420,180 C1492,182 1542,230 1530,340 L1536,432 C1522,456 1494,452 1484,428 L1356,428 C1346,452 1318,456 1304,432 Z" fill={C.hair} />
          <ellipse cx={1331} cy={348} rx={15} ry={22} fill={C.skinShade} />
          <ellipse cx={1509} cy={348} rx={15} ry={22} fill={C.skinShade} />
          <ellipse cx={1420} cy={332} rx={92} ry={104} fill={C.skin} />
          <path d="M1328,318 C1326,236 1372,212 1420,212 C1474,212 1516,240 1514,316 C1496,280 1466,262 1438,270 C1420,248 1380,246 1356,268 C1344,282 1334,298 1328,318 Z" fill={C.hair} />
          {/* brows */}
          <path d={`M1366 ${306 - brow} Q1386 ${296 - brow} 1404 ${304 - brow}`} stroke={C.hair} strokeWidth={6} fill="none" strokeLinecap="round" />
          <path d={`M1436 ${304 - brow} Q1454 ${296 - brow} 1474 ${306 - brow}`} stroke={C.hair} strokeWidth={6} fill="none" strokeLinecap="round" />
          {/* eyes */}
          {[1386, 1454].map((ex) => (
            <g key={ex}>
              <ellipse cx={ex} cy={340} rx={11} ry={Math.max(1.5, 14 * b)} fill="#1f2937" />
              {b > 0.4 ? <circle cx={ex + 4} cy={334} r={3.6} fill="#fff" /> : null}
            </g>
          ))}
          {/* nose + cheeks */}
          <path d="M1421,352 Q1413,372 1425,375" stroke={C.skinShade} strokeWidth={4} fill="none" strokeLinecap="round" />
          <ellipse cx={1364} cy={380} rx={17} ry={10} fill="#f08f8f" opacity={0.35} />
          <ellipse cx={1476} cy={380} rx={17} ry={10} fill="#f08f8f" opacity={0.35} />
          {/* mouth */}
          {o < 0.12 ? (
            <path d={`M1397 ${my - 4} Q1420 ${my + 14} 1443 ${my - 4}`} stroke="#7c2d2d" strokeWidth={5} fill="none" strokeLinecap="round" />
          ) : (
            <g>
              <path
                d={`M1399 ${my - 5} Q1420 ${my - 9} 1441 ${my - 5} Q1438 ${my + 6 + o * 20} 1420 ${my + 8 + o * 22} Q1402 ${my + 6 + o * 20} 1399 ${my - 5} Z`}
                fill="#7c2d2d"
              />
              <ellipse cx={1420} cy={my + 4 + o * 16} rx={10} ry={Math.max(1, 4 * o)} fill="#e57373" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
};

/** Forearm + hand gripping the tablet's right edge — drawn in front of the tablet. */
export const HoldingArm: React.FC<{ t: number }> = ({ t }) => {
  const hy = 600 + tabletBob(t);
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <path d={`M1238 655 L1100 ${hy + 4}`} stroke={C.shirtShade} strokeWidth={40} strokeLinecap="round" />
      <ellipse cx={1090} cy={hy} rx={25} ry={34} fill={C.skin} stroke={C.skinShade} strokeWidth={3} />
      <ellipse cx={1066} cy={hy - 14} rx={11} ry={22} fill={C.skin} stroke={C.skinShade} strokeWidth={3} transform={`rotate(-18 1066 ${hy - 14})`} />
    </svg>
  );
};
