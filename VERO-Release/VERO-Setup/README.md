# אפשרות 1 — VERO Setup (חבילת התקנה)

**הקובץ שמוסרים להלבנה:** `VERO-Setup-1.0.0.exe` (ייבנה ויונח כאן — ראו מטה).

## מה היא עושה
מתקינה את VERO כאפליקציית Windows עצמאית ויוצרת:
- `VERO.exe` (בתוך `%LOCALAPPDATA%\Programs\VERO\`)
- אייקון **VERO** בשולחן העבודה + קיצור בתפריט התחלה
- תיקיית נתונים מקומית קבועה: `%APPDATA%\VERO\`
- את כל ה-Runtime וה-assets לעבודה אופליין (ללא אינטרנט)

לחיצה על האייקון פותחת את VERO כאפליקציית Windows — **לא** דרך Edge/IE/Chrome.
ללא הרשאות Administrator (התקנה per-user).

## איך משיגים את ה-exe
הקובץ **לא** מגיע בנוי (לא ניתן לבנות/לבדוק .exe של Windows בסביבת הפיתוח האופליינית).
בנו אותו על מכונת Windows לפי `../vero-desktop/BUILD.md`:
```powershell
cd ..\vero-desktop
npm install
npm run build:win
# העתיקו dist-win\VERO-Setup-1.0.0.exe לכאן
```
ואז חשבו SHA-256 + גודל ועדכנו את `../IT-Documentation/VERO-Setup--IT-Sheet.md`.

הגיליון הטכני המלא: `../IT-Documentation/VERO-Setup--IT-Sheet.md`.
