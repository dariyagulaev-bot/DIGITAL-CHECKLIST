import React from "react";
import { Abs, AppHeader, Breadcrumb, C, Card, Icon } from "../ui";
import { T, easeOut, ramp } from "../timeline";

const STEPS = ["סוג מערכת", "מספר מערכת", "דרג בדיקה", "בחירת בד״ח"];

const OPTIONS: { title: string; sub?: string; icon: string }[][] = [
  [
    { title: "מערכת א׳", icon: "db" },
    { title: "מערכת ב׳", icon: "db" },
  ],
  [
    { title: "מערכת 1", sub: "A-01", icon: "layers" },
    { title: "מערכת 2", sub: "A-02", icon: "layers" },
  ],
  [
    { title: "דרג א׳", sub: "בדיקה יומית", icon: "shield" },
    { title: "דרג ב׳", sub: "בדיקה תקופתית", icon: "shield" },
  ],
];

const stepStarts = [0, T.wiz1 + 0.45, T.wiz2 + 0.45, T.wizAuto];
const tapsByStep = [T.wiz1, T.wiz2, T.wiz3];

export const WizardScreen: React.FC<{ t: number }> = ({ t }) => {
  let step = 0;
  for (let i = 0; i < stepStarts.length; i++) if (t >= stepStarts[i]) step = i;
  const enter = easeOut(ramp(t, stepStarts[step], stepStarts[step] + 0.35));

  return (
    <div dir="rtl" style={{ position: "absolute", inset: 0, background: C.bg }}>
      <AppHeader />
      <Breadcrumb current="בדיקה חדשה" />
      <Abs x={100} y={168} w={1400} style={{ textAlign: "right" }}>
        <div style={{ fontSize: 46, fontWeight: 700, color: C.text }}>בדיקה חדשה</div>
        <div style={{ fontSize: 24, color: C.muted, marginTop: 4 }}>בחרו את פרטי הבדיקה, שלב אחר שלב</div>
      </Abs>
      {/* stepper */}
      <Abs x={100} y={282} w={1400} style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-start" }}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <React.Fragment key={s}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 18px",
                  borderRadius: 999,
                  fontSize: 21,
                  fontWeight: 600,
                  border: `1.5px solid ${active ? C.blue : done ? "#86efac" : C.border}`,
                  background: active ? C.blueSoft : done ? C.greenSoft : "#fff",
                  color: active ? C.blue : done ? C.green : "#94a3b8",
                }}
              >
                {done ? <Icon name="check" size={18} stroke={3} /> : null}
                {s}
              </span>
              {i < STEPS.length - 1 ? <span style={{ color: "#94a3b8", fontSize: 22 }}>‹</span> : null}
            </React.Fragment>
          );
        })}
      </Abs>

      <div style={{ position: "absolute", inset: 0, opacity: enter, translate: `${(1 - enter) * -40}px 0px` }}>
        {step < 3 ? (
          OPTIONS[step].map((o, i) => {
            const x = i === 0 ? 940 : 360;
            const tt = tapsByStep[step];
            const active = i === 0 && t >= tt - 0.08;
            return (
              <Card
                key={o.title}
                x={x}
                y={350}
                w={560}
                h={110}
                style={{
                  borderColor: active ? C.blue : C.border,
                  background: active ? C.blueSoft : C.card,
                  scale: active && t < tt + 0.15 ? "0.98" : "1",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 20, height: "100%", padding: "0 24px" }}>
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 14,
                      border: `1.5px solid ${C.border}`,
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={o.icon} size={30} color={C.navy} />
                  </div>
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: C.text }}>{o.title}</div>
                    {o.sub ? <div style={{ fontSize: 22, color: C.muted, direction: "rtl" }}>{o.sub}</div> : null}
                  </div>
                  <Icon name="chevronLeft" size={28} color="#94a3b8" />
                </div>
              </Card>
            );
          })
        ) : (
          <Card x={360} y={350} w={1140} h={150} style={{ borderColor: C.blue, background: C.blueSoft }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22, height: 110, padding: "0 28px" }}>
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 14,
                  background: C.blue,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="clipboard" size={34} color="#fff" />
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: C.text }}>בד״ח בדיקה יומית — מערכת א׳</div>
                <div style={{ fontSize: 22, color: C.blue, fontWeight: 600 }}>בד״ח יחיד מתאים — נפתח אוטומטית</div>
              </div>
            </div>
            <div style={{ margin: "0 28px", height: 8, borderRadius: 4, background: "#c7d6fb", overflow: "hidden" }}>
              <div
                style={{
                  width: `${ramp(t, T.wizAuto + 0.2, T.toExec) * 100}%`,
                  height: "100%",
                  background: C.blue,
                  marginInlineStart: 0,
                }}
              />
            </div>
          </Card>
        )}
      </div>
      <Abs x={100} y={530} w={1400} style={{ fontSize: 20, color: "#94a3b8", textAlign: "right" }}>
        ניתן ללחוץ על שלב קודם בשובל ההתקדמות כדי לחזור אליו ולשנות בחירה.
      </Abs>
    </div>
  );
};
