# בניית חבילות VERO ל-Windows

> הבנייה מתבצעת פעם אחת על **מכונת בנייה** (Build machine), לא על הטאבלט.
> מכונת הבנייה זקוקה לאינטרנט **פעם אחת** כדי להוריד את ה-Runtime של Electron.
> הקבצים שנוצרים (ה-.exe) עובדים אחר כך **100% אופליין** על טאבלט היעד.

## דרישות מכונת הבנייה
- Windows 10/11 64-bit (מומלץ), או Linux עם Wine (לבניית NSIS מ-Linux).
- Node.js LTS (18 ומעלה) + npm.
- אינטרנט זמני להורדת Electron 28.3.3 ו-electron-builder.

## שלבים
```powershell
# מתוך התיקייה vero-desktop/
npm install            # מוריד את Electron 28.3.3 + electron-builder (פעם אחת)
npm run build:win      # בונה את שתי החבילות
```

## תוצרים (בתיקייה dist-win/)
- `VERO-Setup-1.0.0.exe`     → אפשרות 1 (מתקין). העתיקו אל `VERO-Release/VERO-Setup/`.
- `VERO-Portable-1.0.0.exe`  → אפשרות 2 (נייד). העתיקו אל `VERO-Release/VERO-Portable/`.

## חתימה דיגיטלית (Code Signing)
כברירת מחדל התוצרים **אינם חתומים**. אל תייצרו חתימה מזויפת ואל תעקפו בדיקות.
כדי לחתום רשמית צריך **תעודת Code Signing (Authenticode) של הארגון** (OV/EV מ-CA
ציבורי, או PKI פנימי שמותקן כ-Trusted אצל תחנות הקצה), ואז אחת מהדרכים:
1. דרך electron-builder — בטלו את ההערה בשדות החתימה ב-`electron-builder.yml`.
2. ידנית לאחר הבנייה:
   ```powershell
   signtool sign /fd SHA256 /tr http://<timestamp-authority> /td SHA256 ^
     /f org-codesign.pfx /p <password> VERO-Setup-1.0.0.exe
   ```
המלצה: לאמת מול גורמי ה-IT איזו תעודה/רשות חותמת מאושרת אצלכם לפני החתימה.

## אימות תאימות ליעד (חובה לפני הפצה)
- התקינו/הריצו על מכשיר **IX101L2, Windows 10 Pro Build 18362 (1903/19H1)** אמיתי.
- ודאו: פתיחה ללא דפדפן, עברית/RTL, מגע + Stylus, שמירת נתונים לאחר הפעלה מחדש,
  בד״חים/חתימות/תמונות/משתמשים/הסמכות/מבחנים.
- חשבו מחדש SHA-256 וגודל של כל .exe (ראו תבנית ב-IT-Documentation) ועדכנו את המסמכים.
