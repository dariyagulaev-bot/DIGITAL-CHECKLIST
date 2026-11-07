---
name: vero-release
description: Use to BUILD and PACKAGE a VERO distribution for Windows — the offline single-file build, the Electron portable folder / installer, sanitization (הלבנה) readiness, SHA-256 and the IT technical sheet. Never auto-publish or ship without explicit approval. Triggers on "גרסה", "release", "חבילה", "התקנה", "installer", "portable", "הלבנה", "EXE", "הפצה", "build".
---

# vero-release — בנייה, אריזה והפצה

מיומנות להכנת חבילת הפצה תקינה ל-Windows, בשקיפות מלאה ובלי קיצורי דרך.

## מתי להשתמש
- כשצריך לבנות/לארוז גרסת הפצה (Portable/Installer) או להכין חומרים ל-IT/הלבנה.

## מבנה אמיתי בפרויקט
- בנייה אופליין: `npm run build:offline` → `dist/VERO.html` (קובץ יחיד, file://-safe).
- אריזת Windows: `VERO-Release/vero-desktop/` (Electron). **הגישה שנבדקה ועובדת:** להרכיב את החבילה מהבינאריים **הרשמיים של Electron** (electron-v28.3.3-win32-x64) — `VERO.exe` זהה בית-אחר-בית ל-`electron.exe` (שינוי שם בלבד, בלי rcedit שמשחית את ה-PE), והאפליקציה ב-`resources/app/` עם `VERO.html` מעודכן. אייקון החלון/Taskbar נקבע מ-`main.js`.
- בדיקה בפועל ללא Windows: הרצה תחת Wine + Xvfb (`xvfb-run wine VERO.exe --no-sandbox`) — אמורה לעלות עד מסך הכניסה ולטעון `ffmpeg.dll` ללא שגיאה.

## כללי ברזל
- **אין לפרסם גרסה, לתייג, או ליצור PR ללא בקשה מפורשת של המשתמש.**
- **אסור** לעקוף הלבנה/הקשחה, להסוות קבצים, לשנות סיומות, או ליצור חתימת קוד מזויפת. מספקים קובץ Windows תקין להעברה רשמית.
- אין להסיר מנגנוני חתימה/הרשאה/ביקורת כדי "לעבור" הלבנה.
- לפני שמנחים התקנה — לוודא שקובץ ההתקנה/הרצה **קיים ותקין בפועל**.
- אין להעלות את החבילה לשירות חיצוני ללא אישור. קובץ גדול שמועבר דרך GitHub — רק לבקשת המשתמש.

## תהליך עבודה (שלב-אחר-שלב)
1. `npm run build:offline` → ודא יצירת `VERO.html`.
2. הרכב את החבילה מהבינאריים הרשמיים; רענן את `VERO.html` בתוך `resources/app/resources/`.
3. ארוז (ZIP/Installer); ודא שלמות (`unzip -t`, מבנה PE תקין), חשב **SHA-256** וגודל.
4. **אמת בפועל** שהאפליקציה עולה (Wine+Xvfb → צילום מסך הכניסה). אם אי אפשר להריץ EXE — אמור זאת מפורשות, אל תטען "עובד".
5. הכן דף מידע ל-IT: שם קובץ, גרסה, גודל, SHA-256, Publisher, חתום/לא חתום, הרשאות Administrator, מיקום התקנה, מיקום נתונים, תקשורת רשת (אין), Runtime/תלויות, Minimum Windows.

## קריטריוני הצלחה
- חבילה אחת תקינה, נטענת בפועל (צילום), עם SHA-256 וגודל, ודף IT מדויק — ללא עקיפת הלבנה.

## דיווח (בעברית)
- מה נבנה, SHA-256/גודל, ואיך מתקינים — בשפה פשוטה, בלי נתיבים טכניים שהמשתמשת לא יכולה להגיע אליהם.
- הבחן בין **מה שאומת בפועל** (עלה תחת Wine) לבין **מה שנותר לאמת** (הרצה על הטאבלט/מעבר הלבנה). אל תפרסם ואל תתייג בלי אישור.
