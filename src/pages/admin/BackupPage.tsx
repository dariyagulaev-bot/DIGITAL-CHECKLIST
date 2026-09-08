import { useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  downloadJson,
  exportConfigBundle,
  exportFormsBundle,
  exportFullBackup,
  importConfigBundle,
  mergeFormsBundle,
  readJsonFile,
  restoreFullBackup,
  timestampedName,
  type ConfigBundle,
  type FormsBundle,
  type FullBackup,
} from '@/services/backup';

export default function BackupPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const restoreRef = useRef<HTMLInputElement>(null);
  const mergeRef = useRef<HTMLInputElement>(null);
  const configRef = useRef<HTMLInputElement>(null);

  const doFullBackup = async () => {
    const data = await exportFullBackup();
    downloadJson(data, timestampedName('checklist_full_backup'));
    notify('גיבוי מלא נוצר', 'ok');
  };

  const doRestore = async (file: File) => {
    if (!user) return;
    if (
      !confirm(
        '⚠️ שחזור יחליף את כל הנתונים הקיימים במכשיר זה (משתמשים, תבניות, בד״חים)! פעולה זו אינה הפיכה. להמשיך?'
      )
    )
      return;
    try {
      const payload = await readJsonFile<FullBackup>(file);
      const res = await restoreFullBackup(payload, user);
      notify(`שוחזרו ${res.usersRestored} משתמשים ו-${res.formsRestored} בד״חים`, 'ok');
    } catch (e) {
      notify('שחזור נכשל: ' + (e as Error).message, 'error');
    }
  };

  const doExportForms = async () => {
    const data = await exportFormsBundle();
    downloadJson(data, timestampedName('checklist_forms'));
    notify(`יוצאו ${data.forms.length} בד״חים להעברה`, 'ok');
  };

  const doMergeForms = async (file: File) => {
    try {
      const payload = await readJsonFile<FormsBundle>(file);
      const res = await mergeFormsBundle(payload);
      notify(`נוספו ${res.added} בד״חים (${res.skipped} כבר קיימים)`, 'ok');
    } catch (e) {
      notify('מיזוג נכשל: ' + (e as Error).message, 'error');
    }
  };

  const doExportConfig = async () => {
    const data = await exportConfigBundle();
    downloadJson(data, timestampedName('checklist_config'));
    notify('הגדרות (משתמשים/תבניות) יוצאו', 'ok');
  };

  const doImportConfig = async (file: File) => {
    if (!confirm('ייבוא הגדרות יעדכן משתמשים, תבניות והגדרות במכשיר זה. להמשיך?')) return;
    try {
      const payload = await readJsonFile<ConfigBundle>(file);
      await importConfigBundle(payload);
      notify('ההגדרות יובאו בהצלחה', 'ok');
    } catch (e) {
      notify('ייבוא נכשל: ' + (e as Error).message, 'error');
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Section
        title="גיבוי ושחזור מלא"
        desc="גיבוי כולל את כל הנתונים: משתמשים, תבניות, בד״חים, חתימות, תמונות והגדרות. השחזור מחליף את כל הנתונים במכשיר."
      >
        <button className="btn-primary" onClick={doFullBackup}>
          💾 גיבוי מערכת מלא
        </button>
        <button className="btn-outline text-fault-700" onClick={() => restoreRef.current?.click()}>
          ♻️ שחזור מגיבוי
        </button>
        <input
          ref={restoreRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && doRestore(e.target.files[0])}
        />
      </Section>

      <Section
        title="העברת בד״חים למחשב מרכזי (מוסיף בלבד)"
        desc="ייצא את הבד״חים שבוצעו במכשיר זה לקובץ, העבר ב-USB, וייבא (מזג) במחשב המרכזי. בד״חים קיימים לא יידרסו."
      >
        <button className="btn-primary" onClick={doExportForms}>
          ⬆️ ייצוא בד״חים להעברה
        </button>
        <button className="btn-outline" onClick={() => mergeRef.current?.click()}>
          ⬇️ מיזוג בד״חים מקובץ
        </button>
        <input
          ref={mergeRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && doMergeForms(e.target.files[0])}
        />
      </Section>

      <Section
        title="הפצת הגדרות למכשירים (משתמשים ותבניות)"
        desc="במחשב המרכזי: ייצא משתמשים, תבניות והגדרות לקובץ. במכשירי השטח: ייבא כדי לקבל את העדכונים."
      >
        <button className="btn-primary" onClick={doExportConfig}>
          ⬆️ ייצוא הגדרות
        </button>
        <button className="btn-outline" onClick={() => configRef.current?.click()}>
          ⬇️ ייבוא הגדרות
        </button>
        <input
          ref={configRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && doImportConfig(e.target.files[0])}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold text-slate-700">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">{desc}</p>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );
}
