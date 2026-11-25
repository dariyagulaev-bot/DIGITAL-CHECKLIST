import React from "react";

export const C = {
  navy: "#0f1f3d",
  navy2: "#1a3266",
  blue: "#2563eb",
  blueSoft: "#e8efff",
  blueLine: "#bcd0fb",
  bg: "#f3f5f9",
  card: "#ffffff",
  border: "#dfe4ee",
  text: "#0f172a",
  muted: "#64748b",
  green: "#16a34a",
  greenSoft: "#dcfce7",
  red: "#dc2626",
  redSoft: "#fee2e2",
  amber: "#b45309",
  amberSoft: "#fef3c7",
  skin: "#f4c7a1",
  skinShade: "#e2a884",
  hair: "#2a1a12",
  shirt: "#2f6fe4",
  shirtShade: "#2458c0",
  pants: "#1c2740",
};

export const FONT = "Rubik, sans-serif";

// ---------- icons (24×24, stroke) ----------
const paths: Record<string, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 13l4 4L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 13l2 2 4-4" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7" />
      <path d="M4 4v4.7h4.7M12 8v4l3 2" />
    </>
  ),
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .8 3.2 2.6 3.8 5.2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  pencil: <path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3" />,
  alert: <path d="M12 4l9 16H3zM12 10v4M12 17v.5" />,
  db: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3 3 7 3s7-1.3 7-3" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </>
  ),
  layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.5M4 12h.5M4 18h.5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </>
  ),
};

export const Icon: React.FC<{ name: keyof typeof paths | string; size?: number; color?: string; stroke?: number; style?: React.CSSProperties }> = ({
  name,
  size = 28,
  color = "currentColor",
  stroke = 2,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
  >
    {paths[name]}
  </svg>
);

/** Absolutely-positioned box in screen units. */
export const Abs: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ x, y, w, h, style, children }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }}>{children}</div>
);

export const VeroMark: React.FC<{ size?: number; color?: string }> = ({ size = 40, color = C.blue }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <defs>
      <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#60a5fa" />
        <stop offset="1" stopColor={color} />
      </linearGradient>
    </defs>
    <path d="M5 8h8l7 17 7-17h8L24 33h-8z" fill="url(#vg)" />
  </svg>
);

export const Logo: React.FC<{ size?: number; dark?: boolean }> = ({ size = 34, dark }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, direction: "ltr" }}>
    <VeroMark size={size * 1.15} />
    <span style={{ fontWeight: 700, fontSize: size, letterSpacing: 1, color: dark ? C.navy : "#fff" }}>VERO</span>
  </div>
);

/** Navy app bar shown on every inner screen. */
export const AppHeader: React.FC = () => (
  <div
    dir="rtl"
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: 1600,
      height: 84,
      background: C.navy,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 56px",
      boxSizing: "border-box",
      color: "#fff",
      zIndex: 20,
    }}
  >
    <Logo size={30} />
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      <Icon name="moon" size={26} color="#cbd5e1" />
      <div style={{ textAlign: "right", lineHeight: 1.15 }}>
        <div style={{ fontSize: 24, fontWeight: 600 }}>ישראל ישראלי</div>
        <div style={{ fontSize: 18, color: "#94a3b8" }}>מבצע</div>
      </div>
      <div style={{ width: 1, height: 40, background: "#334766" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, color: "#cbd5e1" }}>
        <Icon name="logout" size={24} color="#cbd5e1" />
        יציאה
      </div>
    </div>
  </div>
);

export const Breadcrumb: React.FC<{ current: string }> = ({ current }) => (
  <div
    dir="rtl"
    style={{
      position: "absolute",
      left: 0,
      top: 84,
      width: 1600,
      height: 56,
      background: "#fff",
      borderBottom: `1px solid ${C.border}`,
      display: "flex",
      alignItems: "center",
      gap: 18,
      padding: "0 100px",
      boxSizing: "border-box",
      fontSize: 22,
      color: C.muted,
      zIndex: 19,
    }}
  >
    <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.text, fontWeight: 600 }}>
      <Icon name="arrowRight" size={22} />
      חזרה
    </span>
    <span style={{ color: C.border }}>|</span>
    <span>ראשי</span>
    <span>›</span>
    <span style={{ color: C.text, fontWeight: 600 }}>{current}</span>
  </div>
);

export const Card: React.FC<{ x: number; y: number; w: number; h: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  style,
  children,
}) => (
  <Abs
    x={x}
    y={y}
    w={w}
    h={h}
    style={{
      background: C.card,
      border: `1.5px solid ${C.border}`,
      borderRadius: 18,
      boxShadow: "0 2px 6px rgba(15,23,42,0.05)",
      boxSizing: "border-box",
      ...style,
    }}
  >
    {children}
  </Abs>
);

export const Pill: React.FC<{ color: string; bg: string; children: React.ReactNode; size?: number }> = ({ color, bg, children, size = 20 }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 14px",
      borderRadius: 999,
      background: bg,
      color,
      fontSize: size,
      fontWeight: 600,
    }}
  >
    {children}
  </span>
);
