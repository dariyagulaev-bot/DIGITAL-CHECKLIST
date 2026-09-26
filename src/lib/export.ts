import type { Category, Transaction } from '../data/types';

const KIND = { income: 'הכנסה', expense: 'הוצאה', saving: 'חיסכון' } as const;

function cell(v: string | number) {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a UTF-8 BOM so Excel shows Hebrew correctly. */
export function toCsv(txs: Transaction[], cats: Map<string, Category>, goals: Map<string, string>): string {
  const header = ['תאריך', 'חודש', 'סוג', 'קבועה', 'קטגוריה', 'תיאור', 'סכום'];
  const rows = [...txs]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
    .map(t => {
      const [y, m, d] = t.date.split('-');
      const cat = t.kind === 'saving' ? goals.get(t.goalId ?? '') ?? 'חיסכון' : cats.get(t.categoryId ?? '')?.name ?? '';
      const signed = t.kind === 'income' ? t.amount : -t.amount;
      return [`${d}/${m}/${y}`, `${m}/${y}`, KIND[t.kind], t.fixed ? 'כן' : 'לא', cat, t.note, (signed / 100).toFixed(2)];
    });
  return '﻿' + [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
}

/**
 * Saves a file. On phones this opens the share sheet (save to Files / Drive / send),
 * elsewhere it downloads the file.
 */
export async function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const file = typeof File !== 'undefined' ? new File([blob], name, { type }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && file && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
