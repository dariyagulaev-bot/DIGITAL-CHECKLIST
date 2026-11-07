---
name: vero-reports
description: Use for VERO REPORTS and EXPORTS — the official bd"h PDF, per-form Excel, the consolidated Excel by system×rank, print layout, and keeping the printed document light regardless of UI theme. Triggers on "דוח", "PDF", "Excel", "אקסל", "הדפסה", "print", "ייצוא", "report", "מרוכז", "מסמך".
---

# vero-reports — דוחות, PDF, Excel והדפסה

מיומנות לעבודה על המסמכים הרשמיים והייצוא, בשמירה על מראה מקצועי ונכונות הנתונים.

## מתי להשתמש
- שינוי/תיקון בדוח הבד״ח הסופי, ב-PDF, ב-Excel (ליחיד או מרוכז) או בהדפסה.

## מבנה אמיתי בפרויקט
- **PDF:** `src/exports/pdf.ts` — רינדור DOM (html2canvas) ל-jsPDF, כותרת תחתונה חוזרת בכל עמוד, A4. המקור הוא אלמנט `.print-page` ב-`src/pages/FormViewPage.tsx`.
- **Excel ליחיד:** `src/exports/excel.ts` — `exportFormToExcel(formId)` (ExcelJS, RTL).
- **Excel מרוכז:** `exportConsolidatedExcel(formIds?)` — חוברת אחת, גיליון סיכום + גיליון לכל (מערכת × דרג), מטריצה חכמה של בד״חים × סעיפים/שדות/תוצאות. כפתור ב-`src/pages/HistoryPage.tsx`.
- **הדפסה:** כללי `@media print` ב-`src/index.css`; `.print-page` הוא **אי בהיר** (טוקנים מאופסים לבהיר) — כך ש-PDF/הדפסה נשארים בהירים גם ב-Dark Mode.
- תוויות/פורמט: `src/exports/labels.ts`.

## כללי ברזל
- **ה-PDF/Excel/הדפסה תמיד בהירים** — גם כש-Dark Mode פעיל. אין להכניס לרקע כהה למסמך.
- אין להדפיס כלי עריכה (Toolbar/Color Picker/כפתורי מחיקה) — רק המסמך הנקי והנתונים.
- הטבלאות חייבות להיכנס לרוחב A4 ולא להיחתך (`table-layout:fixed`/scaling).
- דיוק מעל הכול: הערכים, החישובים (פער/משך), ה-✓/✕ והסיבות חייבים להתאים למנגנון המדידה (`measurements.ts`) ול-Snapshot של הבד״ח. אין לשנות נתונים לצורך "יופי".
- RTL/עברית מלאה; מראה מקצועי ואחיד.

## תהליך עבודה (שלב-אחר-שלב)
1. זהה אם השינוי במסמך (`FormViewPage`/`.print-page`), ב-PDF (`pdf.ts`) או ב-Excel (`excel.ts`).
2. בצע את השינוי; לטבלאות — ודא התאמה ל-A4.
3. ודא ש-Dark Mode לא "דלף" למסמך: צלם בד״ח כש-Dark Mode פעיל וּודא שהמסמך בהיר.
4. השווה נתונים בדוח מול מצב הבד״ח (סעיפים, תוצאות, חתימות).

## בדיקות וקריטריוני הצלחה
- `npm run build` נקי; `excel`-ים נפתחים תקין (אפשר לפרסר עם ExcelJS ב-Node לאימות גיליונות/תאים).
- צילום של הדוח (Light, ובדיקת Dark→מסמך בהיר) נראה מקצועי ונכנס ל-A4.

## דיווח (בעברית)
- מה שונה (PDF/Excel/הדפסה), עם צילום/פלט אימות.
- אילו בדיקות **בוצעו בפועל** ואילו **נדרשות** (למשל הדפסה פיזית). אם לא בדקת PDF אמיתי — אמור זאת.
