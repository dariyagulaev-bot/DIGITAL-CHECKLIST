import type ExcelJSType from 'exceljs';
import { getFormBundle } from '@/services/forms';
import { statusLabel, equipmentItemsOf, currentResult } from './labels';
import { evaluateTableFull, formatDuration } from '@/services/measurements';
import { FormStatus, SignerType, TaskResult, type TableConfig } from '@/types';

/** Equipment as a bulleted, one-per-line cell value (never a comma sentence). */
function equipmentCellValue(items: string[] | undefined, fallback: string): string {
  const list = equipmentItemsOf(items, fallback);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  return list.map((s) => `• ${s}`).join('\n');
}

const GREEN = 'FFD1FAE5';
const GREEN_TEXT = 'FF047857';
const RED = 'FFFEE2E2';
const RED_TEXT = 'FFB91C1C';
const HEADER_BG = 'FF1D4ED8';
const HEADER_TEXT = 'FFFFFFFF';

function b64FromDataUrl(dataUrl: string): { base64: string; ext: 'png' | 'jpeg' } {
  const match = /^data:image\/(png|jpe?g|webp);base64,(.*)$/i.exec(dataUrl);
  const ext = match && /jpe?g/i.test(match[1]) ? 'jpeg' : 'png';
  const base64 = match ? match[2] : dataUrl.split(',')[1] || '';
  return { base64, ext };
}

/** Build and download an .xlsx report for a single form. */
export async function exportFormToExcel(formId: string): Promise<void> {
  const bundle = await getFormBundle(formId);
  if (!bundle) throw new Error('הבד״ח לא נמצא');
  const { form, tasks, blocks, signatures } = bundle;

  // Load the heavy Excel library on demand.
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'מערכת בד״ח דיגיטלית';
  wb.created = new Date();
  const ws = wb.addWorksheet('בד״ח', {
    views: [{ rightToLeft: true, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  });

  ws.columns = [
    { width: 22 },
    { width: 26 },
    { width: 16 },
    { width: 10 },
    { width: 10 },
    { width: 30 },
  ];

  // Title (VERO-branded)
  ws.mergeCells('A1:F1');
  const brand = ws.getCell('A1');
  brand.value = 'VERO · מערכת בקרה דיגיטלית';
  brand.font = { size: 12, bold: true, color: { argb: 'FF0F2B52' } };
  brand.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(1).height = 20;

  ws.mergeCells('A2:F2');
  const title = ws.getCell('A2');
  title.value = `בד״ח: ${form.name}`;
  title.font = { size: 16, bold: true };
  title.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(2).height = 26;

  const meta: Array<[string, string]> = [
    ['סוג מערכת', form.system_name_snapshot || '—'],
    ['מספר מערכת', form.unit_name_snapshot || '—'],
    ['דרג בדיקה', form.rank_name_snapshot || '—'],
    ['מספר בד״ח', form.number || '—'],
    ['סיווג', form.classification || 'בלמ״ס'],
    ['תאריך', form.date],
    ['מבצע 1', form.performer_name],
    ['מבצע 2', form.performer2_name || '—'],
    ['מאשר', form.approver_name || '—'],
    ['סטטוס', statusLabel(form.status)],
  ];
  let r = 3;
  for (const [k, v] of meta) {
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`A${r}`).alignment = { horizontal: 'right' };
    ws.mergeCells(`B${r}:F${r}`);
    ws.getCell(`B${r}`).value = v;
    ws.getCell(`B${r}`).alignment = { horizontal: 'right' };
    r++;
  }

  r++; // blank row
  // Table header — 5 columns only (no fixed notes column).
  const headerRow = ws.getRow(r);
  const headers = ['שם האזור', 'פעולה', 'ציוד נדרש', 'תקין', 'לא תקין'];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = allBorders();
  });
  headerRow.height = 22;
  r++;

  let okCount = 0;
  let faultCount = 0;
  for (const t of tasks) {
    // Current status: a resolved fault (repaired + verified) reads תקין; the
    // fault-detail section below still lists the original findings.
    const cur = currentResult(t);
    const isOk = cur === TaskResult.OK;
    const isFault = cur === TaskResult.FAULT;
    if (isOk) okCount++;
    if (isFault) faultCount++;
    const row = ws.getRow(r);
    row.getCell(1).value = t.part_name_snapshot;
    row.getCell(2).value = t.action_snapshot;
    row.getCell(3).value = equipmentCellValue(t.equipment_items_snapshot, t.equipment_snapshot);
    row.getCell(4).value = isOk ? '✓' : '';
    row.getCell(5).value = isFault ? '✕' : '';
    for (let c = 1; c <= 5; c++) {
      const cell = row.getCell(c);
      cell.border = allBorders();
      cell.alignment = { horizontal: c <= 3 ? 'right' : 'center', vertical: 'middle', wrapText: true };
    }
    if (isOk) {
      row.getCell(4).fill = solid(GREEN);
      row.getCell(4).font = { bold: true, color: { argb: GREEN_TEXT } };
    }
    if (isFault) {
      row.getCell(5).fill = solid(RED);
      row.getCell(5).font = { bold: true, color: { argb: RED_TEXT } };
    }
    r++;
  }

  // Fault details section (replaces the removed notes column).
  const faultTasks = tasks.filter((t) => t.result === TaskResult.FAULT);
  if (faultTasks.length) {
    r++;
    const fh = ws.getCell(`A${r}`);
    fh.value = '⚠ פירוט אי-תקינות';
    fh.font = { bold: true, color: { argb: RED_TEXT } };
    ws.mergeCells(`A${r}:F${r}`);
    r++;
    for (const t of faultTasks) {
      ws.getCell(`A${r}`).value = `${t.part_name_snapshot} (${t.action_snapshot})`;
      ws.getCell(`A${r}`).font = { bold: true };
      ws.getCell(`A${r}`).alignment = { horizontal: 'right' };
      ws.mergeCells(`B${r}:F${r}`);
      ws.getCell(`B${r}`).value = t.comment.trim() || '— לא הוזן פירוט —';
      ws.getCell(`B${r}`).alignment = { horizontal: 'right', wrapText: true };
      ws.getCell(`B${r}`).fill = solid(RED);
      r++;
    }
  }

  // Measurement tables — written as REAL structured data (never one blob), plus
  // the ±X computation (Initial / Final / Difference / Allowed / Result).
  const tableBlocks = blocks.filter((b) => b.type === 'table');
  for (const b of tableBlocks) {
    const cfg = b.config_snapshot as TableConfig;
    const cells = b.data?.cells ?? {};
    r++; // blank
    const full = evaluateTableFull(cfg, cells);
    const th = ws.getCell(`A${r}`);
    th.value = `טבלת מדידה: ${cfg.title}`;
    th.font = { bold: true, color: { argb: 'FF0F2B52' } };
    ws.mergeCells(`A${r}:F${r}`);
    r++;
    // Header row: first cell blank, then column labels (+ unit).
    const hdr = ws.getRow(r);
    hdr.getCell(1).value = '';
    cfg.columns.forEach((c, i) => {
      const cell = hdr.getCell(2 + i);
      cell.value = c.unit ? `${c.label} (${c.unit})` : c.label;
      cell.font = { bold: true, color: { argb: HEADER_TEXT } };
      cell.fill = solid(HEADER_BG);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = allBorders();
    });
    hdr.getCell(1).border = allBorders();
    r++;
    // Data rows.
    for (const row of cfg.rows) {
      const xr = ws.getRow(r);
      xr.getCell(1).value = row.label;
      xr.getCell(1).font = { bold: true };
      xr.getCell(1).border = allBorders();
      xr.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
      cfg.columns.forEach((c, i) => {
        const cell = xr.getCell(2 + i);
        cell.value = cells[`${row.id}|${c.id}`] ?? '';
        cell.border = allBorders();
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
      r++;
    }
    // Duration result.
    if (cfg.duration && full.duration_result) {
      const dr = full.duration_result;
      ws.getCell(`A${r}`).value = 'משך מדידה';
      ws.getCell(`A${r}`).font = { bold: true };
      ws.mergeCells(`A${r}:B${r}`);
      ws.mergeCells(`C${r}:F${r}`);
      const dc = ws.getCell(`C${r}`);
      dc.value = `נדרש מינימום: ${formatDuration(dr.min_minutes)} | בפועל: ${formatDuration(dr.actual_minutes)} | תוצאה: ${
        dr.invalid ? 'זמן סיום מוקדם מהתחלה' : dr.passed === null ? 'ממתין' : dr.passed ? '✓ עבר' : '✕ לא עבר'
      }`;
      dc.alignment = { horizontal: 'right', wrapText: true };
      if (dr.passed !== null) {
        dc.fill = solid(dr.passed && !dr.invalid ? GREEN : RED);
        dc.font = { color: { argb: dr.passed && !dr.invalid ? GREEN_TEXT : RED_TEXT } };
      }
      r++;
    }
    // ±X results.
    const results = full.results;
    for (const rule of cfg.rules ?? []) {
      const res = results.find((x) => x.rule_id === rule.id);
      const label = (ref: { row_id: string; col_id: string }) =>
        `${cfg.rows.find((x) => x.id === ref.row_id)?.label ?? ''}·${cfg.columns.find((x) => x.id === ref.col_id)?.label ?? ''}`;
      ws.getCell(`A${r}`).value = `פער (${label(rule.initial)} → ${label(rule.final)})`;
      ws.getCell(`A${r}`).font = { bold: true };
      ws.mergeCells(`A${r}:B${r}`);
      const decided = res && res.passed !== null;
      const text = `התחלתי: ${res?.initial ?? '—'} | סופי: ${res?.final ?? '—'} | פער בפועל: ${res?.difference ?? '—'} | פער מותר: ±${rule.allowed_difference} | תוצאה: ${
        !decided ? 'ממתין' : res!.passed ? '✓ עבר' : '✕ לא עבר'
      }`;
      ws.mergeCells(`C${r}:F${r}`);
      const rc = ws.getCell(`C${r}`);
      rc.value = text;
      rc.alignment = { horizontal: 'right', wrapText: true };
      if (decided) {
        rc.fill = solid(res!.passed ? GREEN : RED);
        rc.font = { color: { argb: res!.passed ? GREEN_TEXT : RED_TEXT } };
      }
      r++;
    }
    // Overall result (duration + gap combined).
    if (full.status) {
      ws.getCell(`A${r}`).value = 'תוצאה סופית';
      ws.getCell(`A${r}`).font = { bold: true };
      ws.mergeCells(`A${r}:B${r}`);
      ws.mergeCells(`C${r}:F${r}`);
      const oc = ws.getCell(`C${r}`);
      oc.value =
        full.status === 'pass'
          ? '✓ הבדיקה עברה'
          : full.status === 'fail'
            ? `✕ הבדיקה נכשלה — ${full.fail_reasons.join(' | ')}`
            : 'טרם הושלמה';
      oc.alignment = { horizontal: 'right', wrapText: true };
      oc.font = { bold: true, color: { argb: full.status === 'fail' ? RED_TEXT : full.status === 'pass' ? GREEN_TEXT : 'FF64748B' } };
      if (full.status !== 'incomplete') oc.fill = solid(full.status === 'pass' ? GREEN : RED);
      r++;
    }
  }

  r++; // blank
  // Totals
  const totals: Array<[string, string | number]> = [
    ['סה״כ בדיקות', tasks.length],
    ['תקין', okCount],
    ['לא תקין', faultCount],
    ['מבצע 1', form.performer_name],
    ['מבצע 2', form.performer2_name || '—'],
    ['מאשר', form.approver_name || '—'],
    ['סטטוס', statusLabel(form.status)],
  ];
  for (const [k, v] of totals) {
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`A${r}`).alignment = { horizontal: 'right' };
    ws.getCell(`B${r}`).value = v;
    ws.getCell(`B${r}`).alignment = { horizontal: 'right' };
    if (k === 'תקין') ws.getCell(`B${r}`).font = { bold: true, color: { argb: GREEN_TEXT } };
    if (k === 'לא תקין') ws.getCell(`B${r}`).font = { bold: true, color: { argb: RED_TEXT } };
    r++;
  }

  // Signatures (embedded as images when available)
  r++;
  const perf = signatures.find((s) => s.signer_type === SignerType.PERFORMER);
  const appr = signatures.find((s) => s.signer_type === SignerType.APPROVER);
  ws.getCell(`A${r}`).value = 'חתימת מבצע:';
  ws.getCell(`A${r}`).font = { bold: true };
  ws.getCell(`D${r}`).value = 'חתימת מאשר:';
  ws.getCell(`D${r}`).font = { bold: true };
  r++;
  const sigRow = r;
  ws.getRow(sigRow).height = 60;
  try {
    if (perf) {
      const { base64, ext } = b64FromDataUrl(perf.signature_data);
      const id = wb.addImage({ base64, extension: ext });
      ws.addImage(id, { tl: { col: 0, row: sigRow - 1 }, ext: { width: 180, height: 70 } });
    }
    if (appr) {
      const { base64, ext } = b64FromDataUrl(appr.signature_data);
      const id = wb.addImage({ base64, extension: ext });
      ws.addImage(id, { tl: { col: 3, row: sigRow - 1 }, ext: { width: 180, height: 70 } });
    }
  } catch {
    // If image embedding fails, fall back to a text note.
    ws.getCell(`A${sigRow}`).value = perf ? `נחתם: ${perf.signer_name}` : 'לא נחתם';
    ws.getCell(`D${sigRow}`).value = appr ? `נחתם: ${appr.signer_name}` : 'לא נחתם';
  }
  r = sigRow + 3;
  if (form.status !== FormStatus.APPROVED) {
    ws.getCell(`A${r}`).value = 'בד״ח זה טרם אושר';
    ws.getCell(`A${r}`).font = { bold: true, color: { argb: RED_TEXT } };
    r += 2;
  }
  // VERO footer
  ws.mergeCells(`A${r}:F${r}`);
  ws.getCell(`A${r}`).value = 'הופק ממערכת VERO · מערכת בקרה דיגיטלית';
  ws.getCell(`A${r}`).font = { italic: true, size: 10, color: { argb: 'FF8895A7' } };
  ws.getCell(`A${r}`).alignment = { horizontal: 'right' };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `badach_${sanitize(form.name)}_${form.date}.xlsx`);
}

function solid(argb: string): ExcelJSType.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function allBorders(): Partial<ExcelJSType.Borders> {
  const s: ExcelJSType.Border = { style: 'thin', color: { argb: 'FFCBD5E1' } };
  return { top: s, bottom: s, left: s, right: s };
}

function sanitize(s: string): string {
  return s.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
