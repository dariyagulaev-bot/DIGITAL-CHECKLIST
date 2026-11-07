---
name: vero-design
description: Use for any VISUAL or UX work in VERO — screens, components, Tailwind styling, RTL/Hebrew layout, Dark Mode, the measurement tables and the sub-system grid, touch/tablet ergonomics, PDF/print look. Triggers on "עיצוב", "design", "UI", "RTL", "dark mode", "theme", "טבלה", "מסך", "כפתור", "צבעים", "נראות".
---

# vero-design — עיצוב וממשק VERO

מיומנות לעבודת עיצוב/UX מקצועית ב-VERO, תוך שמירה מלאה על השפה הקיימת.

## מתי להשתמש
- כל שינוי בנראות: מסך, רכיב, כפתור, טבלה, צבעים, ריווח, טיפוגרפיה.
- עבודה על Dark Mode / Light Mode או על ה-Design Tokens.
- התאמות RTL/עברית, מסכי מגע/טאבלט, או מראה ה-PDF/הדפסה.

## מבנה אמיתי בפרויקט (לעבוד מולו)
- Tailwind + מחלקות רכיב ב-`src/index.css` (`.card`, `.btn-*`, `.input`, `.label`, `.eyebrow`, `.pro-mtbl`, `.grid-mtbl`).
- **Design Tokens מרכזיים** ב-`src/index.css`: צבעים נייטרליים (`slate`,`ink`) מגובים במשתני CSS (`--c-*`) ב-`tailwind.config.js`; טוקנים סמנטיים (`--bg,--surface,--surface-2,--border,--text,--text-soft`), טוקני סטטוס (`--ok-*,--fail-*,--warn-*`) וטוקני טבלת מדידה (`--mt-*`).
- Dark Mode: `:root[data-theme="dark"]` מחליף את הטוקנים. מתג ב-`src/components/Layout.tsx` (`ThemeToggle`), נשמר ב-`localStorage` דרך `src/theme.ts`.
- פונט Heebo מקומי; כיוון RTL נאכף ב-`src/main.tsx`.
- טבלאות מדידה: `src/components/MeasurementTable.tsx` (טבלה מקצועית), `src/components/SubsystemGrid.tsx` (רשת תתי־מערכות), עורך ADMIN ב-`src/pages/admin/SubsystemGridEditor.tsx`.

## כללי ברזל (אסור לפגוע בהם)
- עברית מלאה ו-RTL; מראה מקצועי, מודרני ואחיד בכל המסכים.
- התאמה לטאבלט, מחשב ומסכי מגע (שדות/כפתורים ≥ ~40px, אזורי מגע נוחים).
- לעולם לא לקבוע צבע ישירות (hex) בקומפוננטה כשקיים טוקן — להשתמש בטוקנים כדי ש-Dark/Light יישארו עקביים.
- **ה-PDF/הדפסה נשארים בהירים תמיד** — העיצוב הכהה הוא לממשק העבודה בלבד. אין לשנות את `.print-page` לכהה.
- אין לשנות פונקציונליות של בד״חים, הרשאות, חתימות או שמירה בעקבות שינוי עיצובי.

## תהליך עבודה (שלב-אחר-שלב)
1. זהה את הקובץ/רכיב המדויק ואת הטוקנים הרלוונטיים לפני שינוי.
2. בצע את השינוי דרך מחלקות רכיב/טוקנים קיימים; הוסף טוקן חדש רק אם אין מתאים.
3. ודא התנהגות זהה ב-Light וב-Dark (אם רלוונטי) וב-RTL.
4. ודא שהשינוי אינו חותך תוכן ברוחב A4 (לטבלאות: `table-layout:fixed`/`overflow-x-auto`).

## בדיקות וקריטריוני הצלחה
- `npm run build` עובר נקי (טייפים + build).
- בדיקה חזותית בפועל: הגש `dist/` מקומית (`python3 -m http.server 8099 --directory dist`) והסתכל במסך הרלוונטי ב-Light וב-Dark (Playwright/Chromium `--no-sandbox`, screenshot ב-deviceScaleFactor:2).
- אם נגעת במסמך המודפס — צלם מסך בד״ח כש-Dark Mode פעיל וּודא שהמסמך עצמו נשאר בהיר.

## דיווח (בעברית)
- מה שונה (קבצים + אזור), ולמה.
- אילו בדיקות **בוצעו בפועל** (עם צילומי מסך) ואילו **עדיין נדרשות** (למשל בדיקה על טאבלט אמיתי).
- אם זוהתה בעיית ניגודיות/קריאות — דווח והצע תיקון, אל תתעלם.
