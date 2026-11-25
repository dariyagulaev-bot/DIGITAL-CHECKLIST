import React from "react";
import { Abs, C, Icon, Logo } from "../ui";
import { T, USERNAME, ramp } from "../timeline";

const Field: React.FC<{ y: number; label: string; icon: string; focused: boolean; children: React.ReactNode }> = ({
  y,
  label,
  icon,
  focused,
  children,
}) => (
  <>
    <Abs x={900} y={y} w={560} style={{ fontSize: 24, fontWeight: 600, color: C.text, textAlign: "right" }}>
      {label}
    </Abs>
    <Abs
      x={900}
      y={y + 32}
      w={560}
      h={70}
      style={{
        background: "#fff",
        border: `2px solid ${focused ? C.blue : C.border}`,
        boxShadow: focused ? `0 0 0 5px ${C.blueSoft}` : "none",
        borderRadius: 14,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 20px",
        fontSize: 28,
      }}
    >
      <Icon name={icon} size={26} color={C.muted} />
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>{children}</div>
    </Abs>
  </>
);

const Caret: React.FC<{ t: number }> = ({ t }) =>
  Math.floor(t * 2.2) % 2 === 0 ? <span style={{ display: "inline-block", width: 2, height: 32, background: C.blue, marginInline: 2 }} /> : null;

export const LoginScreen: React.FC<{ t: number }> = ({ t }) => {
  const userChars = Math.round(ramp(t, T.typeUser[0], T.typeUser[1]) * USERNAME.length);
  const passChars = Math.round(ramp(t, T.typePass[0], T.typePass[1]) * 8);
  const focusUser = t >= T.loginUser && t < T.loginPass;
  const focusPass = t >= T.loginPass && t < T.loginBtn;
  const pressed = Math.abs(t - T.loginBtn) < 0.12;
  const loading = t > T.loginBtn + 0.1;

  return (
    <div dir="rtl" style={{ position: "absolute", inset: 0, background: C.bg }}>
      {/* brand panel */}
      <Abs
        x={0}
        y={0}
        w={760}
        h={1000}
        style={{
          background: `linear-gradient(160deg, ${C.navy2} 0%, ${C.navy} 75%)`,
          overflow: "hidden",
        }}
      >
        <svg width={760} height={1000} style={{ position: "absolute", inset: 0, opacity: 0.12 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={1000} stroke="#9db7ff" strokeWidth={1} />
          ))}
          {Array.from({ length: 26 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 40} x2={760} y2={i * 40} stroke="#9db7ff" strokeWidth={1} />
          ))}
        </svg>
        <svg width={760} height={1000} style={{ position: "absolute", inset: 0, opacity: 0.1 }}>
          <path d="M40 160 L160 470 L300 140" stroke="#cfe0ff" strokeWidth={70} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M470 720 L560 960 L720 700" stroke="#cfe0ff" strokeWidth={60} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <Abs x={80} y={130} w={600} style={{ color: "#fff", textAlign: "right" }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
            בקרה מדויקת.
            <br />
            תיעוד מלא.
          </div>
          <div style={{ fontSize: 26, color: "#b9c6e4", marginTop: 22 }}>מהבדיקה ועד האישור — כל שלב מתועד.</div>
          <div style={{ display: "flex", gap: 12, marginTop: 30, justifyContent: "flex-start" }}>
            {["בדיקה", "בקרה", "עקיבות"].map((c) => (
              <span
                key={c}
                style={{
                  border: "1.5px solid #4a6296",
                  borderRadius: 999,
                  padding: "6px 20px",
                  fontSize: 22,
                  color: "#dbe5ff",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </Abs>
        {/* small checklist illustration */}
        <Abs
          x={90}
          y={700}
          w={250}
          h={180}
          style={{ border: "1.5px solid #4a6296", borderRadius: 16, background: "rgba(255,255,255,0.06)", padding: 22, boxSizing: "border-box" }}
        >
          <div style={{ color: "#dbe5ff", fontSize: 16, letterSpacing: 3, textAlign: "left", direction: "ltr" }}>CHECKLIST</div>
          {[150, 110, 140, 90].map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, direction: "ltr" }}>
              <div style={{ width: w, height: 8, borderRadius: 4, background: "#6d84b8" }} />
              <div style={{ width: 18, height: 18, borderRadius: 4, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="check" size={14} color="#fff" stroke={3} />
              </div>
            </div>
          ))}
        </Abs>
      </Abs>

      {/* form */}
      <Abs x={900} y={180} w={560} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Logo size={40} dark />
        <div style={{ fontSize: 22, color: C.muted, marginTop: 8 }}>מערכת בקרה דיגיטלית</div>
        <div style={{ fontSize: 40, fontWeight: 700, color: C.text, marginTop: 30 }}>התחברות למערכת</div>
      </Abs>
      <Field y={398} label="שם משתמש" icon="user" focused={focusUser}>
        {userChars === 0 && !focusUser ? (
          <span style={{ color: "#a0aec0" }}>שם משתמש</span>
        ) : (
          <span style={{ direction: "ltr", color: C.text, display: "flex", alignItems: "center" }}>
            {USERNAME.slice(0, userChars)}
            {focusUser ? <Caret t={t} /> : null}
          </span>
        )}
      </Field>
      <Field y={528} label="סיסמה" icon="lock" focused={focusPass}>
        {passChars === 0 && !focusPass ? (
          <span style={{ color: "#a0aec0" }}>סיסמה</span>
        ) : (
          <span style={{ color: C.text, letterSpacing: 6, display: "flex", alignItems: "center" }}>
            {"•".repeat(passChars)}
            {focusPass ? <Caret t={t} /> : null}
          </span>
        )}
      </Field>
      <Abs
        x={900}
        y={670}
        w={560}
        h={76}
        style={{
          background: pressed ? "#1d4ed8" : C.blue,
          borderRadius: 14,
          color: "#fff",
          fontSize: 30,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          boxShadow: "0 8px 20px rgba(37,99,235,0.35)",
          scale: pressed ? "0.97" : "1",
        }}
      >
        {loading ? "מתחבר…" : "כניסה"}
        <Icon name="arrowLeft" size={28} color="#fff" />
      </Abs>
      <Abs x={900} y={800} w={560} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18, textAlign: "center", fontSize: 18, color: "#94a3b8" }}>
        VERO 2026 © · מערכת בד״ח דיגיטלית · v1.0.0
      </Abs>
    </div>
  );
};
