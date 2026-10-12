const fs = require('fs');
const path = require('path');
const struct = require('zlib'); // unused; keep node happy
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  ImageRun, BorderStyle, PageBreak, TableOfContents, Footer, PageNumber,
} = require('docx');

const SP = '/tmp/claude-0/-home-user-DIGITAL-CHECKLIST/d50a27c8-971b-5f20-8147-84157f169a4c/scratchpad';
const OUT = '/home/user/DIGITAL-CHECKLIST/docs/ספר-מערכת-VERO.docx';
const FONT = 'Arial';
const NAVY = '0F2B52';
const BLUE = '2F7DF6';
const GREY = '64748B';

function pngSize(p) {
  const b = fs.readFileSync(p);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// RTL paragraph helpers --------------------------------------------------
function P(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, font: FONT, size: opts.size || 22, rightToLeft: true, color: opts.color, bold: opts.bold })];
  return new Paragraph({ bidirectional: true, alignment: opts.align || AlignmentType.RIGHT, spacing: { after: opts.after ?? 120, line: 276 }, children: runs });
}
function run(text, o = {}) { return new TextRun({ text, font: FONT, size: o.size || 22, rightToLeft: true, bold: o.bold, color: o.color, italics: o.italics }); }
function H1(text) {
  return new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 140 }, children: [new TextRun({ text, font: FONT, size: 34, bold: true, color: NAVY, rightToLeft: true })] });
}
function H2(text) {
  return new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 }, children: [new TextRun({ text, font: FONT, size: 27, bold: true, color: BLUE, rightToLeft: true })] });
}
function H3(text) {
  return new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 }, children: [new TextRun({ text, font: FONT, size: 23, bold: true, color: NAVY, rightToLeft: true })] });
}
function BULLETS(items) {
  return items.map((t) => new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, bullet: { level: 0 }, spacing: { after: 60, line: 264 }, children: [run(t)] }));
}
function IMG(file, caption) {
  const p = path.join(SP, file);
  const { w, h } = pngSize(p);
  const width = 560;
  const height = Math.round(width * (h / w));
  const img = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 20 }, children: [
    new ImageRun({ type: 'png', data: fs.readFileSync(p), transformation: { width, height }, }),
  ] });
  const cap = new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: caption, font: FONT, size: 18, italics: true, color: GREY, rightToLeft: true })] });
  return [img, cap];
}
function rule() {
  return new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' } }, children: [] });
}
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

const children = [];

// ---- Cover ----
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 80 }, children: [new TextRun({ text: 'VERO', font: FONT, size: 96, bold: true, color: NAVY })] }));
children.push(new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: 'מערכת בקרה דיגיטלית', font: FONT, size: 32, color: BLUE, rightToLeft: true })] }));
children.push(new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'ספר מערכת', font: FONT, size: 44, bold: true, color: NAVY, rightToLeft: true })] }));
children.push(new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'מסמך ייחוס מלא — תפעול, ניהול ובקרה', font: FONT, size: 22, color: GREY, rightToLeft: true })] }));
children.push(new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 2600 }, children: [new TextRun({ text: '© 2026 VERO · פיתוח המערכת: דריה ג. · כל הזכויות שמורות', font: FONT, size: 18, color: GREY, rightToLeft: true })] }));
children.push(pageBreak());

// ---- TOC ----
children.push(H1('תוכן העניינים'));
children.push(new TableOfContents('תוכן', { hyperlink: true, headingStyleRange: '1-2' }));
children.push(pageBreak());

// ---- 1. Overview ----
children.push(H1('1. סקירה כללית'));
children.push(P('VERO היא מערכת בקרה דיגיטלית לניהול, ביצוע ואישור בד״חים (בדיקות ביצוע), הפועלת 100% ללא אינטרנט. כל הנתונים נשמרים במסד נתונים מקומי ומתמיד (IndexedDB) במכשיר, ומסונכרנים בין מכשירים באמצעות קבצים (ייצוא/ייבוא), ללא שרת, ללא ענן וללא שירות חיצוני.'));
children.push(H2('עקרונות מרכזיים'));
children.push(...BULLETS([
  'עבודה מלאה אופליין — כל חישוב, אימות והרשאה מתבצעים מקומית.',
  'תיעוד מלא ועקיבות — כל אירוע משמעותי נשמר עם משתמש, תאריך ושעה מדויקים (יומן ביקורת).',
  'Snapshot והיסטוריה בלתי-משתנה — בד״ח שנוצר מקפיא את כל נתוני התבנית, ההרשאות וההגדרות שהיו בזמן הביצוע; שינוי עתידי אינו משנה מסמכים קיימים.',
  'התאמה לטאבלט ומסך מגע (עט/אצבע/עכבר), RTL מלא ועיצוב אחיד.',
]));
children.push(H2('תפקידים והרשאות'));
children.push(...BULLETS([
  'מבצע (PERFORMER) — מבצע בד״חים וממלא נתונים.',
  'מאשר (APPROVER) — חותם, מאשר, מחזיר לתיקון ומעביר לדרג מטפל.',
  'מנהל (ADMIN) — מנהל מערכות, דרגים, משתמשים, הסמכות ותבניות; מפרסם גרסאות.',
]));
children.push(pageBreak());

// ---- 2. Login ----
children.push(H1('2. כניסה למערכת'));
children.push(P('מסך הכניסה הוא שער ארגוני ב-Split-Screen (RTL): בצד ימין אזור ההתחברות (לוגו VERO, שם משתמש, סיסמה, כפתור "כניסה"), ובצד שמאל אזור מיתוג כהה. היציאה מחזירה למסך זה ואינה מוחקת נתונים.'));
children.push(...IMG('login-desktop.png', 'מסך הכניסה — Split-Screen RTL, 100% אופליין.'));
children.push(pageBreak());

// ---- 3. Home ----
children.push(H1('3. מסך הבית'));
children.push(P('לאחר הכניסה מוצג מסך הבית עם סטטיסטיקות מהירות, המשך בד״ח שלא הושלם, ופעולות עיקריות. חיוויים חשובים (כגון נדרש רענון הסמכה) מוצגים כאן בצורה קבועה.'));
children.push(...IMG('cert-2-home.png', 'מסך הבית, כולל חיווי "נדרש רענון הסמכה" (אם רלוונטי).'));
children.push(pageBreak());

// ---- 4. Certifications ----
children.push(H1('4. הסמכות — שיוך למערכות ודרגים'));
children.push(P('הסמכה נקבעת לכל (משתמש + מערכת), כדרג ההסמכה המרבי. הדרגים היררכיים: דרג א׳ → דרג ב׳ → דרג ד׳. דרג מרבי כולל אוטומטית את כל הדרגים שתחתיו, ולכן לא ניתן ליצור מצב לא-הגיוני (למשל ד׳ ללא ב׳).'));
children.push(H2('עריכת הסמכות (בכרטיס המשתמש)'));
children.push(P('בניהול המשתמשים, לכל משתמש מוגדר "דרג הסמכה מרבי" לכל מערכת, עם אפשרות "ללא הסמכה".'));
children.push(...IMG('admin-cert.png', 'עורך ההסמכות בכרטיס המשתמש — דרג מרבי לכל מערכת.'));
children.push(H2('אכיפה עסקית'));
children.push(...BULLETS([
  'פתיחת בד״ח חדש אפשרית רק למערכת ולדרג שהמשתמש מוסמך להם; אפשרויות לא-מורשות אינן מוצגות כלל.',
  'מבצע 2 חייב להיות משתמש פעיל, בעל הרשאת מבצע, שאינו מבצע 1, ומוסמך בתוקף לדרג הנבחר.',
  'האכיפה מתבצעת בלוגיקה העסקית — לא רק בהסתרה בממשק.',
]));
children.push(pageBreak());

// ---- 5. Certification validity ----
children.push(H1('5. תוקף הסמכה ורענון'));
children.push(P('לכל הסמכה ניתן להגדיר משך תוקף (בחודשים, לפי הגדרת המנהל — ללא קיבוע). תאריך התפוגה מחושב אוטומטית: תאריך הסמכה/רענון + משך התוקף. החישוב מבוסס-תאריך (חודשים קלנדריים), ועובד אופליין.'));
children.push(H2('סטטוסים'));
children.push(...BULLETS([
  'בתוקף (ירוק) — יותר מ-3 חודשים עד התפוגה.',
  'נדרש רענון (כתום) — 3 חודשים או פחות עד התפוגה, אך התוקף לא פג.',
  'פג תוקף (אדום) — תאריך התפוגה עבר. הסמכה שפגה אינה זמינה לעבודה חדשה (בד״ח/מבצע 2/מבצע תיקון), אך אינה נמחקת — ניתן לחדשה.',
]));
children.push(H2('מסך "ניהול הסמכות" למנהל'));
children.push(P('מרכז ניהול: ספירות (בתוקף / דורשות רענון / פגות תוקף) כקיצורי סינון, "הסמכות הקרובות לפקיעה", סינון לפי משתמש/מערכת/דרג/סטטוס, ועריכה הכוללת דרג, תאריך הסמכה, משך תוקף ותצוגת-תפוגה מחושבת, וכן "חדש להיום".'));
children.push(...IMG('cert-3-admin.png', 'מסך ניהול הסמכות — ספירות, סינון, והקרובות לפקיעה.'));
children.push(H2('התראות רענון'));
children.push(P('בכניסת משתמש שיש לו הסמכה המתקרבת לתפוגה או שפגה, מוצג Popup אחד מרכז לכל ההסמכות. סגירתו מדחה אותו ל-Session הנוכחי בלבד; הוא יופיע שוב בכניסה הבאה עד שהמנהל יזין תאריך רענון חדש.'));
children.push(...IMG('cert-1-popup.png', 'Popup רענון הסמכה — מרוכז, חוזר עד חידוש.'));
children.push(pageBreak());

// ---- 6. Template builder ----
children.push(H1('6. בונה הבד״חים הדינמי'));
children.push(P('תבנית בד״ח מורכבת מרכיבים (Blocks) בסדר שהמנהל קובע. ניתן להוסיף סעיף בדיקה, כותרת/Section, הוראה/טקסט, טבלת מדידה, תמונה, ציוד נדרש ומפריד — ולשנות סדר, לשכפל ולמחוק. אין צורך בשינוי קוד כדי להוסיף תוכן מקצועי.'));
children.push(...IMG('pub-4-published.png', 'עורך התבנית — רשימת רכיבים, סרגל גרסה/פרסום, "הוסף רכיב".'));
children.push(H2('טבלת מדידה'));
children.push(P('טבלה נבנית במלואה ע״י המנהל: שם, הוראה, שורות ועמודות, סוגי שדות (טקסט/מספר/עשרוני/שעה/תאריך/תאריך ושעה/כן-לא/בחירה/בחירה מרובה/אחוז), יחידות מידה, רשימות בחירה, ושדות חובה.'));
children.push(...IMG('editor-3-table.png', 'בונה הטבלה — פרטים, זמן, מבנה (עמודות/שורות) והגדרות פער.'));
children.push(H3('חוק פער ±X'));
children.push(P('למדידה ניתן להגדיר שדה התחלתי, שדה סופי ופער מספרי מותר ±X. החישוב: Difference = Final − Initial; הבדיקה תקינה כאשר |Difference| ≤ Allowed. ערכי הגבול נחשבים תקינים, וכיוון השינוי נשמר (למשל 10-).'));
children.push(...IMG('editor-4-rule.png', 'הגדרת חוק פער ±X — שדה התחלתי/סופי, פער מותר, כישלון בחריגה.'));
children.push(H3('משך מדידה מינימלי'));
children.push(P('ניתן לאכוף שמשך המדידה עצמה יהיה לפחות X (מינימום, לא מקסימום). המשך מחושב מתוך שדות "תאריך ושעה" של ההתחלה והסיום (תומך במעבר חצות ובמדידות ארוכות מיממה). ברירת המחדל נקבעת לכל מערכת+דרג, וניתן לעקוף לכל טבלה. ניסוח שורת ההוראה הוא טקסט חופשי בלבד ואינו משפיע על החישוב.'));
children.push(pageBreak());

// ---- 7. Draft / publish ----
children.push(H1('7. טיוטה, תצוגה מקדימה ופרסום גרסאות'));
children.push(P('עריכת תבנית מתבצעת כטיוטה. בד״חים חדשים נבנים מהגרסה שפורסמה בלבד — עריכת טיוטה אינה משפיעה על בד״חים חדשים עד לפרסום מחדש. לכל פרסום נשמרת גרסה (1.0 / 1.1 / 2.0), מי פרסם, מתי ותקציר שינויים.'));
children.push(H2('בדיקת תקינות לפני פרסום'));
children.push(...BULLETS([
  'שדה חובה ללא שם, טבלה ללא מבנה תקין, רשימת בחירה ללא אפשרויות.',
  'חוק מדידה עם פער לא חוקי או המפנה לשדה שנמחק, מזהים פנימיים כפולים.',
  'כל בעיה חוסמת פרסום ומוצגת למנהל לתיקון.',
]));
children.push(...IMG('pub-3-publish.png', 'דיאלוג פרסום — בדיקת תקינות, סוג גרסה ותקציר שינויים.'));
children.push(pageBreak());

// ---- 8. Running a form ----
children.push(H1('8. ביצוע בד״ח'));
children.push(P('המבצע בוחר מערכת → מספר מערכת → דרג → תבנית (מוצגות רק אפשרויות מורשות ומפורסמות). הבד״ח מציג את כל הרכיבים בסדר שהוגדר: סעיפי בדיקה (תקין/לא תקין + תקלות), כותרות, הוראות, תמונות, ציוד וטבלאות מדידה.'));
children.push(...IMG('e2e-A2-perf-systems.png', 'אשף פתיחת בד״ח — מוצגות רק המערכות המורשות.'));
children.push(H2('מילוי טבלת מדידה — תוצאה אוטומטית'));
children.push(P('הנתונים נשמרים אוטומטית (Autosave) ושורדים סגירה ופתיחה מחדש. הבדיקה עוברת רק כאשר מתקיימים יחד תנאי הזמן (משך ≥ מינימום) ותנאי הפער (±X). חסר נתון → "טרם הושלמה". לא ניתן לעקוף ידנית את תוצאת החישוב.'));
children.push(...IMG('dur-pass.png', 'מדידה שעברה — משך 7 שעות (≥6) ופער 10- (בטווח).'));
children.push(...IMG('dur-failtime.png', 'מדידה שנכשלה — משך 3 שעות (<6), עם סיבה מדויקת.'));
children.push(pageBreak());

// ---- 9. Approval + treatment ----
children.push(H1('9. אישור, החזרה לתיקון והעברה לדרג מטפל'));
children.push(P('המאשר חותם ומאשר, או מחזיר סעיפים לתיקון (רק כשקיים סעיף "לא תקין"), או מעביר סעיפי תקלה לדרג מטפל גבוה יותר (למשל דרג ד׳).'));
children.push(H2('העברה לדרג מטפל'));
children.push(...BULLETS([
  'לפני ההעברה נבדקת זמינות כוח-אדם מוסמך בדרג המטפל (לפחות שני מבצעי תיקון).',
  'דרג הבדיקה המקורי, המבצעים המקוריים והחתימות המקוריות נשמרים כהיסטוריה.',
  'מבצעי התיקון (1/2) מוסמכים בתוקף לדרג המטפל, מתעדים את הטיפול וחותמים חתימות חדשות.',
  'הסעיף נשאר "לא תקין" עד לאימות המאשר, ואז הופך ל"תקין"; התוצאה המקורית נשמרת.',
]));
children.push(...IMG('e2e-C5-done.png', 'העברה לדרג מטפל — סטטוס, הערה, היסטוריה וחתימות מקוריות נשמרות.'));
children.push(pageBreak());

// ---- 10. Reports ----
children.push(H1('10. דוחות, PDF ו-Excel'));
children.push(P('הדוח הסופי (לצפייה/הדפסה/PDF) כולל את פרטי הבד״ח, טבלת הסעיפים (✓/✕), טבלאות המדידה כטבלאות אמיתיות עם שורת תוצאה (פער בפועל, פער מותר, משך, תוצאה), אזור "תקלות וטיפול שבוצע", וחתימות. ייצוא Excel שומר נתונים מובְנים (כולל Initial/Final/Difference/Allowed/Result ומשך).'));
children.push(...IMG('e2e-E4-report-mid.png', 'דוח סופי — ✓ בכל השורות לאחר טיפול מאומת, צוות הטיפול וחתימות.'));
children.push(pageBreak());

// ---- 11. Backup / audit ----
children.push(H1('11. גיבוי, שחזור ויומן ביקורת'));
children.push(...BULLETS([
  'גיבוי מלא / שחזור — כל הנתונים (משתמשים, הסמכות, תבניות ורכיבים, בד״חים, חתימות, הגדרות).',
  'הפצת הגדרות בין מכשירים (ייצוא/ייבוא), והעברת בד״חים למחשב מרכזי (מיזוג Append-only ללא דריסה).',
  'יומן ביקורת — פרסום גרסה, שינוי/רענון הסמכה, אישור/החזרה/העברה לטיפול, כשל מדידה — כולם עם מי/מתי.',
]));
children.push(pageBreak());

// ---- 12. Acceptance ----
children.push(H1('12. נספח — בדיקות וקבלה'));
children.push(P('המערכת נבדקה אוטומטית (92 בדיקות יחידה/אינטגרציה) ובאופן ידני מקצה-לקצה באפליקציה. להלן תמצית תרחישי הקבלה המרכזיים:'));
children.push(...BULLETS([
  'הסמכות: סינון מערכות/דרגים, מבצע 2 מסונן, חסימת שילוב לא חוקי, שמירת היסטוריה.',
  'תוקף: >3 חודשים (אין התראה), בדיוק 3 חודשים (התראה), יום לפני/ביום/יום אחרי התפוגה, סגירת Popup וחזרתו, רענון שמסיר התראה, חסימת עבודה בהסמכה שפגה.',
  'בונה: הוספת/עריכת כל סוגי הרכיבים, טבלה (שורות/עמודות/סוגי שדות/חובה/בחירה/יחידות), שכפול, שינוי סדר.',
  'חוק ±X: 100→90/103/75/125 PASS; 100→50/130 FAIL; 0, שליליים, עשרוניים, חסר, קלט לא חוקי.',
  'משך מדידה: קצר/מדויק/ארוך מהמינימום, מעבר חצות, >24 שעות, סיום מוקדם מהתחלה, חסר נתון, שילוב זמן+פער.',
  'טיוטה/פרסום/גרסאות: בדיקת תקינות חוסמת, 1.0/1.1/2.0, בד״חים חדשים מהגרסה שפורסמה, היסטוריה לא משתנה.',
  'ביצוע: Autosave ששורד סגירה ופתיחה מחדש, Snapshot, PDF/Excel, אופליין מלא.',
  'העברה לדרג מטפל: בדיקת כוח-אדם, מבצעי תיקון מוסמכים, חתימות חדשות, היפוך סטטוס לאחר אימות.',
]));

// Build
const doc = new Document({
  creator: 'VERO',
  title: 'ספר מערכת VERO',
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  features: { updateFields: true },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: 'VERO · ספר מערכת · עמוד ', font: FONT, size: 16, color: GREY, rightToLeft: true }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GREY }),
    ] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('wrote', OUT, buf.length, 'bytes'); });
