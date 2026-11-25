import React from "react";
import { Abs, AppHeader, Breadcrumb, C, Card, Icon, Pill } from "../ui";
import {
  NOTE_TEXT,
  PANEL_NOTE,
  SIG1,
  SIG2,
  SIG_PAD_H,
  T,
  easeOut,
  panelExtra,
  partialPath,
  ramp,
  scrollAt,
} from "../timeline";

type Result = "none" | "ok" | "bad";

const ROWS = [
  { area: "מנוע", action: "בדיקת מפלס שמן", eq: "כפפות", at: T.row1, result: "ok" as Result },
  { area: "מערכת חשמל", action: "בדיקת חיבורים", eq: "פנס", at: T.row2bad, result: "bad" as Result },
  { area: "אזור עבודה", action: "בדיקה ויזואלית", eq: "ללא", at: T.row3, result: "ok" as Result },
];

const Checkbox: React.FC<{ x: number; y: number; label: string; checked: boolean }> = ({ x, y, label, checked }) => (
  <Abs x={x - 18} y={y - 18} style={{ display: "flex", alignItems: "center", gap: 14, direction: "rtl" }}>
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: `2px solid ${checked ? C.blue : "#94a3b8"}`,
        background: checked ? C.blue : "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      {checked ? <Icon name="check" size={26} color="#fff" stroke={3} /> : null}
    </div>
    <span style={{ fontSize: 28, color: C.text }}>{label}</span>
  </Abs>
);

const ResultButtons: React.FC<{ y: number; result: Result; t: number; at: number }> = ({ y, result, t, at }) => {
  const set = t >= at;
  const okOn = set && result === "ok";
  const badOn = set && result === "bad";
  const press = Math.abs(t - at) < 0.1;
  const base: React.CSSProperties = {
    position: "absolute",
    top: y - 24,
    height: 48,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 22,
    fontWeight: 600,
    boxSizing: "border-box",
  };
  return (
    <>
      <div
        style={{
          ...base,
          left: 430,
          width: 130,
          border: `1.5px solid ${okOn ? C.green : C.border}`,
          background: okOn ? C.green : "#fff",
          color: okOn ? "#fff" : C.text,
          scale: press && result === "ok" ? "0.94" : "1",
        }}
      >
        <Icon name="check" size={20} stroke={3} />
        תקין
      </div>
      <div
        style={{
          ...base,
          left: 260,
          width: 160,
          border: `1.5px solid ${badOn ? C.red : C.border}`,
          background: badOn ? C.red : "#fff",
          color: badOn ? "#fff" : C.text,
          scale: press && result === "bad" ? "0.94" : "1",
        }}
      >
        <Icon name="x" size={20} stroke={3} />
        לא תקין
      </div>
    </>
  );
};

const SigBox: React.FC<{
  x: number;
  top: number;
  label: string;
  pts: typeof SIG1;
  win: readonly [number, number];
  saveAt: number;
  time: string;
  signer: string;
  t: number;
}> = ({ x, top, label, pts, win, saveAt, time, signer, t }) => {
  const drawing = t >= win[0];
  const saved = t >= saveAt;
  const press = Math.abs(t - saveAt) < 0.1;
  return (
    <>
      <Abs x={x} y={top + 84} w={660} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 24, fontWeight: 600, color: C.text }}>{label}</span>
        {saved ? (
          <Pill color={C.green} bg={C.greenSoft} size={19}>
            <Icon name="check" size={18} stroke={3} />
            נחתם · {signer} · {time}
          </Pill>
        ) : null}
      </Abs>
      <Abs
        x={x}
        y={top + 130}
        w={660}
        h={SIG_PAD_H}
        style={{
          border: `2px ${saved ? "solid" : "dashed"} ${saved ? "#86efac" : "#cbd5e1"}`,
          background: saved ? "#f7fef9" : "#fbfcfe",
          borderRadius: 14,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: "#94a3b8",
          fontSize: 22,
        }}
      >
        {!drawing ? (
          <>
            <Icon name="pencil" size={24} color="#94a3b8" />
            חתמו כאן באמצעות העט
          </>
        ) : null}
      </Abs>
      {/* buttons row */}
      <Abs
        x={x + 10}
        y={top + 283}
        h={44}
        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20, color: C.muted }}
      >
        <Icon name="history" size={20} color={C.muted} />
        נקה וחתום מחדש
      </Abs>
      <Abs
        x={x + 480}
        y={top + 283}
        w={170}
        h={44}
        style={{
          borderRadius: 10,
          background: saved ? C.greenSoft : t > win[1] ? C.blue : "#a9bdf5",
          color: saved ? C.green : "#fff",
          fontSize: 20,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          scale: press ? "0.94" : "1",
        }}
      >
        <Icon name="check" size={18} stroke={3} />
        {saved ? "נשמר" : "שמור חתימה"}
      </Abs>
      <svg
        width={1600}
        height={1600}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}
      >
        <polyline
          points={partialPath(pts, ramp(t, win[0], win[1]))
            .map((p) => `${p.x},${p.y}`)
            .join(" ")}
          fill="none"
          stroke={C.navy}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};

export const ExecutionScreen: React.FC<{ t: number }> = ({ t }) => {
  const scroll = scrollAt(t);
  const extra = panelExtra(t);
  const rowsDone = ROWS.filter((r) => t >= r.at).length;
  const faults = t >= T.row2bad ? 1 : 0;
  const submitted = t >= T.submit + 0.15;
  const ddOpen = t >= T.ddOpen && t < T.ddPick + 0.2;
  const picked = t >= T.ddPick;

  const status = submitted
    ? { label: "ממתין לאישור", color: C.amber, bg: C.amberSoft, icon: "clock" }
    : t >= T.eqGloves
      ? { label: "בביצוע", color: C.blue, bg: C.blueSoft, icon: "pencil" }
      : { label: "טיוטה", color: C.muted, bg: "#eef1f6", icon: "clipboard" };

  const noteChars = Math.round(ramp(t, T.typeNote[0], T.typeNote[1]) * NOTE_TEXT.length);
  const panelEditing = t < T.panelSave + 0.1;
  const sigTop = 990 + extra;
  const toast = Math.min(easeOut(ramp(t, T.submit + 0.2, T.submit + 0.5)), 1 - ramp(t, T.submit + 3.0, T.submit + 3.4));

  return (
    <div dir="rtl" style={{ position: "absolute", inset: 0, background: C.bg, overflow: "hidden" }}>
      {/* scrolling content */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1600, height: 1600, translate: `0px ${-scroll}px` }}>
        {/* header card */}
        <Card x={100} y={160} w={1400} h={170}>
          <div style={{ position: "absolute", right: 28, top: 18 }}>
            <Pill color={status.color} bg={status.bg}>
              <Icon name={status.icon} size={18} />
              {status.label}
            </Pill>
          </div>
          <div style={{ position: "absolute", right: 28, top: 58, fontSize: 32, fontWeight: 700, color: C.text }}>
            מערכת א׳ <span style={{ color: C.border }}>|</span> מספר מערכת A-01{" "}
            <span style={{ color: C.border }}>|</span> 25.11.2026
          </div>
          <div style={{ position: "absolute", right: 28, top: 102, fontSize: 21, color: C.muted, display: "flex", gap: 6, alignItems: "center" }}>
            <Icon name="shield" size={20} color={C.muted} />
            דרג א׳ · בדיקה יומית
          </div>
          <div style={{ position: "absolute", left: 24, top: 22, display: "flex", gap: 12 }}>
            <span style={{ border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "6px 16px", fontSize: 20, display: "flex", gap: 8, alignItems: "center" }}>
              <Icon name="eye" size={20} />
              צפייה / הדפסה
            </span>
            <span style={{ border: `1.5px solid #fca5a5`, color: C.red, borderRadius: 10, padding: "6px 16px", fontSize: 20, display: "flex", gap: 8, alignItems: "center" }}>
              <Icon name="trash" size={20} />
              מחק
            </span>
          </div>
          <div style={{ position: "absolute", left: 24, right: 28, top: 128, display: "flex", justifyContent: "space-between", fontSize: 19, color: C.muted }}>
            <span>התקדמות הבדיקה</span>
            <span>
              {rowsDone}/3 סעיפים{faults ? <span style={{ color: C.red }}> · {faults} תקלות</span> : null}
            </span>
          </div>
          <div style={{ position: "absolute", left: 24, right: 28, top: 156, height: 6, borderRadius: 3, background: "#e5e9f2" }}>
            <div style={{ position: "absolute", right: 0, top: 0, height: 6, borderRadius: 3, width: `${(rowsDone / 3) * 100}%`, background: C.blue }} />
          </div>
        </Card>

        {/* equipment */}
        <Card x={100} y={350} w={1400} h={120}>
          <div style={{ position: "absolute", right: 28, top: 16, fontSize: 26, fontWeight: 700, color: C.text }}>ציוד נדרש לבדיקה</div>
          <div style={{ position: "absolute", left: 28, top: 20, fontSize: 19, color: "#94a3b8" }}>רשימת ריכוז — לוודא לפני התחלה</div>
        </Card>
        <Checkbox x={1458} y={425} label="כפפות" checked={t >= T.eqGloves} />
        <Checkbox x={1058} y={425} label="פנס" checked={t >= T.eqTorch} />

        {/* details */}
        <Card x={100} y={486} w={1400} h={134}>
          <div style={{ position: "absolute", right: 28, top: 4, fontSize: 23, fontWeight: 700, color: C.text }}>פרטי הבד״ח</div>
        </Card>
        {[
          { x: 1040, label: "מבצע 1" },
          { x: 580, label: "מבצע 2" },
          { x: 120, label: "סיווג" },
        ].map((f) => (
          <Abs key={f.label} x={f.x} y={524} w={440} style={{ fontSize: 17, color: C.muted, textAlign: "right" }}>
            {f.label}
          </Abs>
        ))}
        <Abs x={1040} y={545} w={440} h={56} style={fieldStyle("#f8fafc")}>
          <Icon name="user" size={22} color={C.muted} />
          <span style={{ flex: 1 }}>ישראל ישראלי</span>
          <Icon name="lock" size={20} color="#94a3b8" />
        </Abs>
        <Abs
          x={580}
          y={545}
          w={440}
          h={56}
          style={{
            ...fieldStyle("#fff"),
            borderColor: ddOpen ? C.blue : picked ? "#86efac" : C.border,
            boxShadow: ddOpen ? `0 0 0 4px ${C.blueSoft}` : "none",
          }}
        >
          <Icon name={picked ? "user" : "users"} size={22} color={C.muted} />
          <span style={{ flex: 1, color: picked ? C.text : "#94a3b8" }}>{picked ? "דנה כהן" : "חפש או בחר מבצע"}</span>
          <Icon name="chevronDown" size={22} color={C.muted} />
        </Abs>
        <Abs x={120} y={545} w={440} h={56} style={fieldStyle("#f8fafc")}>
          <Icon name="lock" size={20} color="#94a3b8" />
          <span style={{ flex: 1 }}>בלמ״ס</span>
        </Abs>

        {/* items table */}
        <Card x={100} y={640} w={1400} h={278 + extra} style={{ overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, top: 0, height: 50, background: "#f8fafc", borderBottom: `1px solid ${C.border}` }} />
        </Card>
        {[
          { x: 1300, w: 180, l: "שם האזור" },
          { x: 1020, w: 270, l: "פעולה" },
          { x: 790, w: 220, l: "ציוד נדרש" },
          { x: 620, w: 160, l: "תמונה" },
          { x: 260, w: 300, l: "תוצאה" },
        ].map((c) => (
          <Abs key={c.l} x={c.x} y={652} w={c.w} style={{ fontSize: 20, color: C.muted, fontWeight: 600, textAlign: "right" }}>
            {c.l}
          </Abs>
        ))}
        {ROWS.map((r, i) => {
          const top = 690 + i * 76 + (i === 2 ? extra : 0);
          const set = t >= r.at;
          const tint = set ? (r.result === "ok" ? "#f0fdf4" : "#fef2f2") : "transparent";
          return (
            <React.Fragment key={r.area}>
              <Abs x={102} y={top} w={1396} h={76} style={{ background: tint, borderTop: `1px solid ${C.border}` }} />
              <Abs x={1300} y={top + 22} w={180} style={{ fontSize: 26, fontWeight: 700, color: C.text, textAlign: "right" }}>
                {r.area}
              </Abs>
              <Abs x={1020} y={top + 24} w={270} style={{ fontSize: 23, color: C.text, textAlign: "right" }}>
                {r.action}
              </Abs>
              <Abs x={790} y={top + 24} w={220} style={{ fontSize: 23, color: C.muted, textAlign: "right" }}>
                {r.eq}
              </Abs>
              <Abs x={620} y={top + 24} w={160} style={{ fontSize: 23, color: "#cbd5e1", textAlign: "right" }}>
                —
              </Abs>
              <ResultButtons y={top + 38} result={r.result} t={t} at={r.at} />
            </React.Fragment>
          );
        })}
        {/* fault details panel / note, inserted under row 2 */}
        <Abs x={102} y={842} w={1396} h={extra} style={{ overflow: "hidden", background: "#fff7f7", borderTop: `1px solid #fecaca` }}>
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, background: C.red }} />
          {panelEditing ? (
            <>
              <div style={{ position: "absolute", right: 28, top: 8, fontSize: 22, fontWeight: 700, color: C.red, display: "flex", gap: 8, alignItems: "center" }}>
                <Icon name="alert" size={22} color={C.red} />
                פירוט אי-תקינות
              </div>
              <div
                style={{
                  position: "absolute",
                  right: 20,
                  top: 38,
                  width: 920,
                  height: 70,
                  background: "#fff",
                  border: `2px solid ${t >= T.panelTap ? C.blue : C.border}`,
                  borderRadius: 12,
                  boxSizing: "border-box",
                  padding: "0 18px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: 26,
                  color: noteChars ? C.text : "#94a3b8",
                }}
              >
                {noteChars ? NOTE_TEXT.slice(0, noteChars) : "תארו את אי-התקינות…"}
                {t >= T.panelTap && Math.floor(t * 2.2) % 2 === 0 ? (
                  <span style={{ display: "inline-block", width: 2, height: 30, background: C.blue, marginInline: 3 }} />
                ) : null}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 218,
                  top: 43,
                  width: 220,
                  height: 60,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 10,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 20,
                  color: C.text,
                }}
              >
                <Icon name="camera" size={22} />
                צלם / צרף תמונה
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 28,
                  top: 43,
                  width: 170,
                  height: 60,
                  borderRadius: 10,
                  background: C.blue,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 600,
                  scale: Math.abs(t - T.panelSave) < 0.1 ? "0.94" : "1",
                }}
              >
                שמור
              </div>
            </>
          ) : (
            <div
              style={{
                position: "absolute",
                right: 28,
                top: (PANEL_NOTE - 30) / 2,
                fontSize: 22,
                color: C.red,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <Icon name="alert" size={22} color={C.red} />
              <b>יש פירוט תקלה:</b> {NOTE_TEXT}
            </div>
          )}
        </Abs>

        {/* dropdown */}
        {ddOpen ? (
          <Abs
            x={580}
            y={605}
            w={440}
            h={124}
            style={{
              background: "#fff",
              border: `1.5px solid ${C.border}`,
              borderRadius: 12,
              boxShadow: "0 12px 30px rgba(15,23,42,0.18)",
              overflow: "hidden",
              zIndex: 5,
              opacity: easeOut(ramp(t, T.ddOpen, T.ddOpen + 0.15)),
            }}
          >
            {["דנה כהן", "אבי לוי"].map((n, i) => (
              <div
                key={n}
                style={{
                  height: 60,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 18px",
                  fontSize: 24,
                  background: i === 0 && t >= T.ddPick - 0.1 ? C.blueSoft : "#fff",
                  borderBottom: i === 0 ? `1px solid ${C.border}` : "none",
                }}
              >
                <Icon name="user" size={22} color={C.muted} />
                {n}
              </div>
            ))}
          </Abs>
        ) : null}

        {/* signatures */}
        <Card x={100} y={sigTop} w={1400} h={350}>
          <div style={{ position: "absolute", right: 28, top: 18, fontSize: 26, fontWeight: 700, color: C.text }}>חתימות</div>
          <div style={{ position: "absolute", left: 28, top: 22, fontSize: 19, color: "#94a3b8" }}>החתימה נעשית בציור ישיר על המסך</div>
        </Card>
        <SigBox x={820} top={sigTop} label="מבצע 1 · ישראל ישראלי" pts={SIG1} win={T.sign1} saveAt={T.save1} time="10:42" signer="ישראל ישראלי" t={t} />
        <SigBox x={120} top={sigTop} label="מבצע 2 · דנה כהן" pts={SIG2} win={T.sign2} saveAt={T.save2} time="10:43" signer="דנה כהן" t={t} />
      </div>

      <AppHeader />
      <Breadcrumb current="ביצוע בד״ח" />

      {/* sticky footer */}
      <Abs
        x={0}
        y={910}
        w={1600}
        h={90}
        style={{ background: "#fff", borderTop: `1px solid ${C.border}`, boxShadow: "0 -6px 18px rgba(15,23,42,0.06)", zIndex: 10 }}
      >
        <div style={{ position: "absolute", right: 100, top: 26, fontSize: 24, display: "flex", gap: 10, alignItems: "center", color: rowsDone === 3 ? C.green : C.muted, fontWeight: rowsDone === 3 ? 600 : 400 }}>
          <Icon name={rowsDone === 3 ? "check" : "clock"} size={24} stroke={rowsDone === 3 ? 3 : 2} />
          {submitted ? "הבד״ח הועבר לאישור" : rowsDone === 3 ? "כל הסעיפים סומנו" : `נותרו ${3 - rowsDone} סעיפים לסיום`}
        </div>
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 15,
            width: 380,
            height: 60,
            borderRadius: 12,
            background: submitted ? "#cbd5e1" : C.blue,
            color: "#fff",
            fontSize: 24,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            boxShadow: submitted ? "none" : "0 6px 16px rgba(37,99,235,0.35)",
            scale: Math.abs(t - T.submit) < 0.1 ? "0.95" : "1",
          }}
        >
          {submitted ? "הועבר לאישור" : "סיום והעברה לאישור"}
          <Icon name="arrowLeft" size={24} color="#fff" />
        </div>
      </Abs>

      {/* toast */}
      {toast > 0 ? (
        <Abs
          x={460}
          y={162}
          w={680}
          h={70}
          style={{
            background: "#fff",
            border: `2px solid #86efac`,
            borderRadius: 16,
            boxShadow: "0 14px 34px rgba(15,23,42,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            fontSize: 26,
            fontWeight: 600,
            color: C.green,
            opacity: toast,
            translate: `0px ${(1 - toast) * -20}px`,
            zIndex: 30,
          }}
        >
          <Icon name="check" size={28} stroke={3} />
          הבד״ח הועבר לגורם מאשר
        </Abs>
      ) : null}
    </div>
  );
};

function fieldStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: `1.5px solid ${C.border}`,
    borderRadius: 12,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 16px",
    fontSize: 24,
    color: C.text,
  };
}
