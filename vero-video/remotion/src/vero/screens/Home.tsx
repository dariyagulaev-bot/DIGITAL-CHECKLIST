import React from "react";
import { Abs, AppHeader, C, Card, Icon } from "../ui";
import { T } from "../timeline";

const stats = [
  { label: "בד״חים פתוחים", value: 0, color: C.text },
  { label: "ממתינים לאישור", value: 0, color: C.amber },
  { label: "בוצעו היום", value: 0, color: C.text },
  { label: "עם תקלות", value: 0, color: C.red },
];

const actions = [
  { title: "בד״ח חדש", sub: "פתיחת בדיקה חדשה מתוך בד״ח מפורסם", icon: "plus", col: 0, row: 0 },
  { title: "הבד״חים שלי", sub: "טיוטות, ממתינים לאישור ומאושרים", icon: "clipboard", col: 1, row: 0 },
  { title: "היסטוריית בד״חים", sub: "חיפוש, צפייה והפקת דוחות", icon: "history", col: 0, row: 1 },
  { title: "מבחני הסמכה", sub: "מבחנים זמינים והגרסאות שלי", icon: "list", col: 1, row: 1 },
  { title: "ההסמכות שלי", sub: "מצב ההסמכות ורענון", icon: "shield", col: 0, row: 2 },
];

export const HomeScreen: React.FC<{ t: number }> = ({ t }) => {
  const pressing = t >= T.homeNew - 0.08 && t < T.toWizard;
  return (
    <div dir="rtl" style={{ position: "absolute", inset: 0, background: C.bg }}>
      <AppHeader />
      <Abs x={100} y={118} w={1400} style={{ textAlign: "right" }}>
        <div style={{ fontSize: 26, color: C.muted }}>שלום, ישראל ישראלי</div>
        <div style={{ fontSize: 46, fontWeight: 700, color: C.text, marginTop: 4 }}>מערכת בד״ח דיגיטלית</div>
      </Abs>
      {stats.map((s, i) => (
        <Card key={s.label} x={1500 - 340 - i * 353} y={240} w={340} h={120}>
          <div style={{ padding: "16px 24px", textAlign: "right" }}>
            <div style={{ fontSize: 46, fontWeight: 700, color: s.color, direction: "ltr", textAlign: "left" }}>{s.value}</div>
            <div style={{ fontSize: 22, color: C.muted, textAlign: "left" }}>{s.label}</div>
          </div>
        </Card>
      ))}
      <Abs x={100} y={392} w={1400} style={{ fontSize: 22, color: C.muted, textAlign: "right" }}>
        פעולות
      </Abs>
      {actions.map((a) => {
        const x = a.col === 0 ? 810 : 100;
        const y = 440 + a.row * 132;
        const active = a.row === 0 && a.col === 0 && pressing;
        return (
          <Card
            key={a.title}
            x={x}
            y={y}
            w={690}
            h={110}
            style={{
              borderColor: active ? C.blue : C.border,
              background: active ? C.blueSoft : C.card,
              scale: active ? "0.985" : "1",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 22, height: "100%", padding: "0 26px" }}>
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 14,
                  border: `1.5px solid ${C.border}`,
                  background: a.row === 0 && a.col === 0 ? C.blueSoft : "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={a.icon} size={32} color={a.row === 0 && a.col === 0 ? C.blue : C.navy} />
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: C.text }}>{a.title}</div>
                <div style={{ fontSize: 21, color: C.muted, marginTop: 2 }}>{a.sub}</div>
              </div>
              <Icon name="chevronLeft" size={28} color="#94a3b8" />
            </div>
          </Card>
        );
      })}
    </div>
  );
};
