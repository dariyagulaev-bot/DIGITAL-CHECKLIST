# אפשרות 2 — VERO Portable (גרסה ניידת)

**הקובץ שמוסרים להלבנה:** `VERO-Portable-1.0.0.exe` (ייבנה ויונח כאן — ראו מטה).

## מה היא עושה
גרסת Windows שאינה דורשת תהליך התקנה. פתיחה ישירה של `VERO-Portable.exe` פותחת את
VERO כאפליקציה עצמאית, ללא דפדפן וללא אינטרנט. כל קבצי ההרצה וה-assets בתוך הקובץ.
נתונים נשמרים לצמיתות ב-`%APPDATA%\VERO\`. ללא הרשאות Administrator.

> **הערה:** גם גרסה ניידת היא קובץ הרצה (.exe), ולכן ייתכן שההלבנה תחסום אותה.
> לא בוצעה כל הסוואה כ-PDF/HTML/קובץ אחר.

## איך משיגים את ה-exe
בנו על מכונת Windows לפי `../vero-desktop/BUILD.md`:
```powershell
cd ..\vero-desktop
npm install
npm run build:win
# העתיקו dist-win\VERO-Portable-1.0.0.exe לכאן
```
ואז חשבו SHA-256 + גודל ועדכנו את `../IT-Documentation/VERO-Portable--IT-Sheet.md`.

הגיליון הטכני המלא: `../IT-Documentation/VERO-Portable--IT-Sheet.md`.
