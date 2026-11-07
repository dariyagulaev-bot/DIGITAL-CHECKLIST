---
name: vero-offline
description: Use to protect and verify VERO's OFFLINE-FIRST behavior — no network at runtime, local IndexedDB persistence, draft autosave, the single-file offline build (VERO.html) and the Electron portable package. Triggers on "אופליין", "offline", "ללא אינטרנט", "VERO.html", "IndexedDB", "שמירה", "טיוטה", "portable", "file://".
---

# vero-offline — עבודה אופליין ושימור נתונים

מיומנות לשמירה ואימות של עבודה מלאה ללא אינטרנט ושל שרידות הנתונים.

## מתי להשתמש
- כל שינוי שעלול לגעת ברשת, בטעינת משאבים, או בשמירה מקומית.
- אימות שה-build האופליין וה-Portable עובדים ונטענים.
- בדיקת שרידות בד״חים/טיוטות/חתימות/תמונות אחרי עדכון.

## מבנה אמיתי בפרויקט
- כל הנתונים מקומיים ב-IndexedDB (Dexie) — DB בשם `digital_checklist`, הגדרה ב-`src/data/db.ts`.
- בנייה אופליין: `npm run build:offline` → `dist/VERO.html` (קובץ יחיד, IIFE קלאסי שרץ מ-`file://`; `scripts/finalize-offline.mjs` מסיר `type=module`).
- אריזת Windows Portable: `VERO-Release/vero-desktop/` (Electron; החבילה הנבדקת מורכבת מהבינאריים הרשמיים של Electron, `VERO.exe` זהה ל-`electron.exe`). ה-UI = `resources/app/resources/VERO.html`.
- שמירה אוטומטית של טיוטות בזמן ביצוע בד״ח; גיבוי/שחזור ב-`src/services/backup.ts`.

## כללי ברזל
- **אסור** להוסיף תלות ברשת בזמן ריצה: אין אינטרנט, CDN, Cloud, `localhost` חיצוני, פונטים/משאבים מרוחקים, או עדכון אוטומטי.
- כל נכס (פונט/אייקון/ספרייה) חייב להיות מקומי/מוטמע.
- **אסור** לאבד נתונים: אין לאפס/למחוק IndexedDB, ואין לשנות מיגרציות קיימות בלי אישור. נתוני VERO מופרדים מקבצי התוכנה ואינם נמחקים בעדכון.
- אין להעלות קוד/נתונים לשירות חיצוני.

## תהליך עבודה (שלב-אחר-שלב)
1. בדוק שאין פנייה לרשת: חפש `fetch`/`http`/CDN/`import()` דינמי ממקור חיצוני; ודא שפונטים מקומיים.
2. בנה: `npm run build:offline` — חייב להצליח וליצור `dist/VERO.html`.
3. אמת טעינה מ-`file://`: פתח את `VERO.html` בדפדפן ללא רשת (Playwright: `page.goto('file://.../VERO.html')`) — ללא שגיאות, מגיע למסך הכניסה.
4. אמת שרידות: זרע/מלא נתונים, רענן, וּודא שהם נשמרו (IndexedDB). בדוק גיבוי מלא (`exportFullBackup`) כולל כל הטבלאות.

## בדיקות וקריטריוני הצלחה
- `npm run build:offline` יוצר `VERO.html`; הקובץ נטען מ-`file://` ללא שגיאות ומציג כניסה.
- נתונים/טיוטות שורדים רענון; הגיבוי המלא כולל בד״חים, חתימות, הסמכות, מבחנים, רענונים ותקלות במעקב.

## דיווח (בעברית)
- מה אומת (אופליין/שרידות), עם ראיה (צילום/פלט).
- הבחן בין **מה שנבדק בפועל** לבין **מה שנותר** (למשל הרצה בפועל על הטאבלט). אם לא ניתן להריץ EXE של Windows בסביבה — אמור זאת במפורש במקום להניח שעובד.
