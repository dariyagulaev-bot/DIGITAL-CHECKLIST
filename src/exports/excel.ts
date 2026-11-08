import type ExcelJSType from 'exceljs';
import { getFormBundle } from '@/services/forms';
import { db } from '@/data/db';
import { statusLabel, equipmentItemsOf, currentResult, formatDate, formatDateDots } from './labels';
import { calibrationState } from '@/services/calibration';
import { evaluateTableFull, formatDuration } from '@/services/measurements';
import {
  FormStatus,
  SignerType,
  TaskResult,
  faultSeverityLabel,
  type EquipmentCalibration,
  type TableConfig,
  type FieldsConfig,
  type CompletedForm,
  type CompletedTask,
  type CompletedBlock,
} from '@/types';

/** One equipment item + its calibration note (serial / expiry / validity), if any. */
function equipmentItemLine(name: string, cal: EquipmentCalibration | null | undefined, date: string): string {
  if (!cal?.requires_calibration) return name;
  const bits: string[] = [];
  if (cal.serial_number) bits.push(`מס׳ סידורי ${cal.serial_number}`);
  if (cal.calibration_expiry) {
    const st = calibrationState(cal.calibration_expiry, date);
    bits.push(`תוקף כיול ${formatDateDots(cal.calibration_expiry)} (${st === 'expired' ? 'פג' : st === 'valid' ? 'בתוקף' : '—'})`);
  } else {
    bits.push('דורש כיול');
  }
  return `${name} [${bits.join(' · ')}]`;
}

/** Equipment as a bulleted, one-per-line cell value (never a comma sentence),
 *  including per-item calibration details when present. */
function equipmentCellValue(
  items: string[] | undefined,
  fallback: string,
  calibration?: (EquipmentCalibration | null)[],
  date = ''
): string {
  const list = equipmentItemsOf(items, fallback);
  if (list.length === 0) return '';
  const lines = list.map((s, i) => equipmentItemLine(s, calibration?.[i], date));
  if (lines.length === 1) return lines[0];
  return lines.map((s) => `• ${s}`).join('\n');
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
    ...(form.phase_name_snapshot ? [['שלב הבד״ח', form.phase_name_snapshot] as [string, string]] : []),
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
    row.getCell(3).value = equipmentCellValue(t.equipment_items_snapshot, t.equipment_snapshot, t.equipment_calibration_snapshot, form.date);
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
      const sev = t.fault_severity ? ` — חומרה: ${faultSeverityLabel(t.fault_severity)}` : '';
      ws.getCell(`A${r}`).value = `${t.part_name_snapshot} (${t.action_snapshot})${sev}`;
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
    const full = evaluateTableFull(cfg, cells, { started_at: b.data?.started_at, ended_at: b.data?.ended_at });
    const th = ws.getCell(`A${r}`);
    th.value = `טבלת מדידה: ${cfg.title}`;
    th.font = { bold: true, color: { argb: 'FF0F2B52' } };
    ws.mergeCells(`A${r}:F${r}`);
    r++;
    const NUMERIC = ['number', 'decimal', 'percent'];
    // Keep numbers numeric (never "230 V" as a string) so Excel calcs still work;
    // the unit is stored in its own column, separate from the value.
    const asValue = (raw: string, type: string) => {
      const t = (raw ?? '').trim();
      if (t === '') return '';
      if (NUMERIC.includes(type)) { const n = Number(t); return Number.isFinite(n) ? n : t; }
      return t;
    };
    if (cfg.layout === 'fields') {
      // Simplified field layout → one row per field: שדה | ערך | יחידה.
      const rowId = cfg.rows[0]?.id ?? '';
      const heads = ['שדה', 'ערך', 'יחידה'];
      const hdr = ws.getRow(r);
      heads.forEach((h, i) => {
        const cell = hdr.getCell(1 + i);
        cell.value = h;
        cell.font = { bold: true, color: { argb: HEADER_TEXT } };
        cell.fill = solid(HEADER_BG);
        cell.alignment = { horizontal: i === 0 ? 'right' : 'center', vertical: 'middle' };
        cell.border = allBorders();
      });
      r++;
      for (const c of cfg.columns) {
        const xr = ws.getRow(r);
        xr.getCell(1).value = c.label;
        xr.getCell(1).font = { bold: true };
        xr.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
        xr.getCell(2).value = asValue(cells[`${rowId}|${c.id}`] ?? '', c.field_type);
        xr.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        xr.getCell(3).value = NUMERIC.includes(c.field_type) ? (c.unit ?? '') : '';
        xr.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        [1, 2, 3].forEach((n) => (xr.getCell(n).border = allBorders()));
        r++;
      }
    } else {
      // Legacy row × column grid.
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
      for (const row of cfg.rows) {
        const xr = ws.getRow(r);
        xr.getCell(1).value = row.label;
        xr.getCell(1).font = { bold: true };
        xr.getCell(1).border = allBorders();
        xr.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
        cfg.columns.forEach((c, i) => {
          const cell = xr.getCell(2 + i);
          cell.value = asValue(cells[`${row.id}|${c.id}`] ?? '', c.field_type);
          cell.border = allBorders();
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
        r++;
      }
    }
    // Duration result.
    if (cfg.duration && full.duration_result) {
      const dr = full.duration_result;
      ws.getCell(`A${r}`).value = 'משך מדידה';
      ws.getCell(`A${r}`).font = { bold: true };
      ws.mergeCells(`A${r}:B${r}`);
      ws.mergeCells(`C${r}:F${r}`);
      const dc = ws.getCell(`C${r}`);
      const fmtTs = (iso: string | null) => {
        if (!iso) return '—';
        const t = Date.parse(iso);
        if (!Number.isFinite(t)) return iso;
        const d = new Date(t);
        const p = (n: number) => String(n).padStart(2, '0');
        return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
      };
      dc.value = `התחלה: ${fmtTs(dr.start)} | סיום: ${fmtTs(dr.end)} | נדרש מינימום: ${formatDuration(dr.min_minutes)} | בפועל: ${formatDuration(dr.actual_minutes)} | תוצאה: ${
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
      const unitFor = (ref: { col_id: string }) => {
        const c = cfg.columns.find((x) => x.id === ref.col_id);
        return c && NUMERIC.includes(c.field_type) ? (c.unit ?? '').trim() : '';
      };
      const u = unitFor(rule.final) || unitFor(rule.initial);
      const wu = (v: number | null | undefined) => (v === null || v === undefined ? '—' : u ? `${v} ${u}` : `${v}`);
      const text = `התחלתי: ${wu(res?.initial)} | סופי: ${wu(res?.final)} | פער בפועל: ${wu(res?.difference)} | פער מותר: ±${rule.allowed_difference}${u ? ` ${u}` : ''} | תוצאה: ${
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

  // Custom-field groups (תת־מערכת / שדות) — one "שדה | ערך" table per group.
  const fieldBlocks = blocks.filter((b) => b.type === 'fields');
  for (const b of fieldBlocks) {
    const cfg = b.config_snapshot as import('@/types').FieldsConfig;
    if (!cfg.fields?.length) continue;
    const cells = b.data?.cells ?? {};
    r++; // blank
    const th = ws.getCell(`A${r}`);
    th.value = cfg.title || 'תת־מערכת';
    th.font = { bold: true, color: { argb: 'FF0F2B52' } };
    ws.mergeCells(`A${r}:F${r}`);
    r++;
    const hdr = ws.getRow(r);
    ['שדה', 'ערך'].forEach((h, i) => {
      const cell = hdr.getCell(1 + i);
      cell.value = h;
      cell.font = { bold: true, color: { argb: HEADER_TEXT } };
      cell.fill = solid(HEADER_BG);
      cell.alignment = { horizontal: i === 0 ? 'right' : 'center', vertical: 'middle' };
      cell.border = allBorders();
    });
    r++;
    for (const f of cfg.fields) {
      const xr = ws.getRow(r);
      xr.getCell(1).value = f.label;
      xr.getCell(1).font = { bold: true };
      xr.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
      const raw = (cells[f.id] ?? '').trim();
      xr.getCell(2).value = f.field_type === 'bool' ? (raw === 'true' ? 'כן' : raw === 'false' ? 'לא' : '') : f.unit && raw ? `${raw} ${f.unit}` : raw;
      xr.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      [1, 2].forEach((n) => (xr.getCell(n).border = allBorders()));
      r++;
    }
  }

  // Tracking faults present on this unit at the time of the inspection (snapshot).
  const trackingSnap = form.tracking_faults_snapshot ?? [];
  if (trackingSnap.length) {
    r++; // blank
    const th = ws.getCell(`A${r}`);
    th.value = '🟠 תקלות במעקב (בזמן ביצוע הבד״ח)';
    th.font = { bold: true, color: { argb: 'FFB45309' } };
    ws.mergeCells(`A${r}:F${r}`);
    r++;
    const repairLabel = (s: string) =>
      s === 'repaired' ? 'תוקן (ממתין לאימות)' : s === 'repair_approved' ? 'תיקון אושר' : 'לא תוקן';
    const hdr = ws.getRow(r);
    ['תיאור התקלה', 'בד״ח מקור', 'דרג מקור', 'נפתחה בתאריך', 'מצב תיקון'].forEach((h, i) => {
      const cell = hdr.getCell(1 + i);
      cell.value = h;
      cell.font = { bold: true, color: { argb: HEADER_TEXT } };
      cell.fill = solid('FFB45309');
      cell.alignment = { horizontal: i === 0 ? 'right' : 'center', vertical: 'middle', wrapText: true };
      cell.border = allBorders();
    });
    r++;
    for (const tf of trackingSnap) {
      const xr = ws.getRow(r);
      xr.getCell(1).value = tf.description;
      xr.getCell(2).value = tf.source_form_number || '—';
      xr.getCell(3).value = tf.source_rank_name || '—';
      xr.getCell(4).value = tf.opened_at ? tf.opened_at.slice(0, 10) : '—';
      xr.getCell(5).value = repairLabel(tf.repair_status);
      for (let c = 1; c <= 5; c++) {
        xr.getCell(c).border = allBorders();
        xr.getCell(c).alignment = { horizontal: c === 1 ? 'right' : 'center', vertical: 'middle', wrapText: true };
      }
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

// ===========================================================================
//  Consolidated Excel — one workbook, one sheet per (system + rank).
//  Each sheet is a "smart" matrix: one row per completed בד״ח, with a column
//  for every check item, measurement cell and custom field used in that group
//  (union across the group's forms), so the same template lines up column-wise.
// ===========================================================================

interface ColDef {
  key: string;
  label: string;
  order: number;
  kind: 'check' | 'data' | 'result';
}

/** Collect this form's per-column values + register the columns it introduces. */
function collectFormColumns(
  tasks: CompletedTask[],
  blocks: CompletedBlock[],
  registry: Map<string, ColDef>
): { values: Map<string, string>; faults: string[] } {
  const values = new Map<string, string>();
  const faults: string[] = [];
  const reg = (c: ColDef) => {
    const prev = registry.get(c.key);
    if (!prev || c.order < prev.order) registry.set(c.key, c);
  };

  // Check items → ✓ / ✕
  for (const t of [...tasks].sort((a, b) => a.sort_order - b.sort_order)) {
    const label = `${t.part_name_snapshot} · ${t.action_snapshot}`.trim();
    const key = `chk|${label}`;
    reg({ key, label, order: t.sort_order, kind: 'check' });
    const cur = currentResult(t);
    values.set(key, cur === TaskResult.OK ? '✓' : cur === TaskResult.FAULT ? '✕' : '');
    if (cur === TaskResult.FAULT) {
      const sev = t.fault_severity ? ` [${faultSeverityLabel(t.fault_severity)}]` : '';
      faults.push(`${t.part_name_snapshot}: ${t.comment?.trim() || 'לא תקין'}${sev}`);
    }
  }

  const NUMERIC = ['number', 'decimal', 'percent'];
  for (const b of [...blocks].sort((a, b) => a.sort_order - b.sort_order)) {
    const base = b.sort_order * 1000;
    if (b.type === 'fields') {
      const cfg = b.config_snapshot as FieldsConfig;
      const cells = b.data?.cells ?? {};
      const title = cfg.title || 'שדות';
      (cfg.fields ?? []).forEach((f, i) => {
        const label = `${title} · ${f.label}`;
        const key = `fld|${label}`;
        reg({ key, label, order: base + i, kind: 'data' });
        const raw = (cells[f.id] ?? '').trim();
        values.set(key, f.field_type === 'bool' ? (raw === 'true' ? 'כן' : raw === 'false' ? 'לא' : '') : f.unit && raw ? `${raw} ${f.unit}` : raw);
      });
    } else if (b.type === 'table') {
      const cfg = b.config_snapshot as TableConfig;
      const cells = b.data?.cells ?? {};
      const title = cfg.title || 'טבלת מדידה';
      if (cfg.layout === 'fields') {
        const rowId = cfg.rows[0]?.id ?? '';
        cfg.columns.forEach((c, i) => {
          const unit = NUMERIC.includes(c.field_type) && c.unit ? ` (${c.unit})` : '';
          const label = `${title} · ${c.label}${unit}`;
          const key = `tbl|${label}`;
          reg({ key, label, order: base + i, kind: 'data' });
          values.set(key, (cells[`${rowId}|${c.id}`] ?? '').trim());
        });
      } else {
        cfg.rows.forEach((row, ri) => {
          cfg.columns.forEach((c, ci) => {
            const unit = c.unit ? ` (${c.unit})` : '';
            const label = `${title} · ${row.label} · ${c.label}${unit}`;
            const key = `tbl|${label}`;
            reg({ key, label, order: base + ri * cfg.columns.length + ci, kind: 'data' });
            values.set(key, (cells[`${row.id}|${c.id}`] ?? '').trim());
          });
        });
      }
      // One compact pass/fail result column per measurement table.
      const full = evaluateTableFull(cfg, cells, { started_at: b.data?.started_at, ended_at: b.data?.ended_at });
      if (full.status) {
        const label = `${title} · תוצאה`;
        const key = `res|${label}`;
        reg({ key, label, order: base + 900, kind: 'result' });
        values.set(key, full.status === 'pass' ? '✓ עברה' : full.status === 'fail' ? '✕ נכשלה' : 'טרם הושלמה');
      }
    }
  }
  return { values, faults };
}

function groupBySystemRank(forms: CompletedForm[]): Map<string, { system: string; rank: string; forms: CompletedForm[] }> {
  const groups = new Map<string, { system: string; rank: string; forms: CompletedForm[] }>();
  for (const f of forms) {
    const system = f.system_name_snapshot || '—';
    const rank = f.rank_name_snapshot || '—';
    const key = `${system}||${rank}`;
    if (!groups.has(key)) groups.set(key, { system, rank, forms: [] });
    groups.get(key)!.forms.push(f);
  }
  return groups;
}

/**
 * Build one consolidated .xlsx from all completed forms (optionally a filtered
 * subset): a סיכום sheet, then one sheet per (system + rank) group.
 */
export async function exportConsolidatedExcel(formIds?: string[]): Promise<{ groups: number; forms: number }> {
  const all = await db.completed_forms.toArray();
  const forms = formIds ? all.filter((f) => formIds.includes(f.id)) : all;
  if (!forms.length) throw new Error('אין בד״חים לייצוא.');

  const ids = new Set(forms.map((f) => f.id));
  const [allTasks, allBlocks] = await Promise.all([
    db.completed_tasks.toArray(),
    db.completed_blocks.toArray(),
  ]);
  const tasksByForm = new Map<string, CompletedTask[]>();
  for (const t of allTasks) if (ids.has(t.completed_form_id)) (tasksByForm.get(t.completed_form_id) ?? tasksByForm.set(t.completed_form_id, []).get(t.completed_form_id)!).push(t);
  const blocksByForm = new Map<string, CompletedBlock[]>();
  for (const b of allBlocks) if (ids.has(b.completed_form_id)) (blocksByForm.get(b.completed_form_id) ?? blocksByForm.set(b.completed_form_id, []).get(b.completed_form_id)!).push(b);

  const groups = groupBySystemRank(forms);

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VERO';
  wb.created = new Date();

  // ---- Summary sheet ------------------------------------------------------
  const sum = wb.addWorksheet('סיכום', { views: [{ rightToLeft: true, showGridLines: false }] });
  sum.columns = [{ width: 24 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }];
  sum.mergeCells('A1:F1');
  sum.getCell('A1').value = 'VERO · ייצוא מרוכז לאקסל';
  sum.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF0F2B52' } };
  sum.getCell('A1').alignment = { horizontal: 'right' };
  sum.mergeCells('A2:F2');
  sum.getCell('A2').value = `הופק: ${formatDate(new Date().toISOString())} · ${forms.length} בד״חים · ${groups.size} קבוצות (מערכת × דרג)`;
  sum.getCell('A2').font = { size: 11, color: { argb: 'FF64748B' } };
  sum.getCell('A2').alignment = { horizontal: 'right' };
  let sr = 4;
  ['מערכת', 'דרג', 'בד״חים', 'תקין', 'לא תקין', 'גיליון'].forEach((h, i) => {
    const c = sum.getRow(sr).getCell(i + 1);
    c.value = h; c.font = { bold: true, color: { argb: HEADER_TEXT } };
    c.fill = solid(HEADER_BG); c.alignment = { horizontal: 'center' }; c.border = allBorders();
  });
  sr++;

  // ---- One sheet per (system + rank) --------------------------------------
  const usedNames = new Set<string>();
  const sheetName = (system: string, rank: string) => {
    let base = `${system}-${rank}`.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28);
    let name = base || 'קבוצה';
    let n = 2;
    while (usedNames.has(name)) name = `${base.slice(0, 25)} ${n++}`;
    usedNames.add(name);
    return name;
  };

  const META = ['מספר מערכת', 'מספר בד״ח', 'תאריך', 'שלב', 'מבצע 1', 'מבצע 2', 'מאשר', 'סטטוס'];

  for (const { system, rank, forms: gForms } of [...groups.values()].sort((a, b) => `${a.system}${a.rank}`.localeCompare(`${b.system}${b.rank}`, 'he'))) {
    // First pass: gather the union of columns + each form's values.
    const registry = new Map<string, ColDef>();
    const perForm = new Map<string, { values: Map<string, string>; faults: string[] }>();
    for (const f of gForms) {
      perForm.set(f.id, collectFormColumns(tasksByForm.get(f.id) ?? [], blocksByForm.get(f.id) ?? [], registry));
    }
    const cols = [...registry.values()].sort((a, b) => a.order - b.order);

    const name = sheetName(system, rank);
    const ws = wb.addWorksheet(name, {
      views: [{ rightToLeft: true, showGridLines: false, state: 'frozen', xSplit: 1, ySplit: 3 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    // Title
    const totalCols = META.length + cols.length + 3; // +תקין +לא תקין +תקלות
    ws.mergeCells(1, 1, 1, totalCols);
    ws.getCell(1, 1).value = `${system} · ${rank}`;
    ws.getCell(1, 1).font = { size: 13, bold: true, color: { argb: 'FF0F2B52' } };
    ws.getCell(1, 1).alignment = { horizontal: 'right' };
    ws.mergeCells(2, 1, 2, totalCols);
    ws.getCell(2, 1).value = `${gForms.length} בד״חים`;
    ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF64748B' } };
    ws.getCell(2, 1).alignment = { horizontal: 'right' };

    // Header row (row 3)
    const headers = [...META, ...cols.map((c) => c.label), 'תקין', 'לא תקין', 'תקלות'];
    const hr = ws.getRow(3);
    headers.forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: HEADER_TEXT }, size: 10 };
      c.fill = solid(i < META.length ? 'FF0F2B52' : HEADER_BG);
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = allBorders();
    });
    hr.height = 42;
    ws.getColumn(1).width = 14;
    for (let i = 2; i <= META.length; i++) ws.getColumn(i).width = 12;
    for (let i = META.length + 1; i <= META.length + cols.length; i++) ws.getColumn(i).width = 13;
    for (let i = META.length + cols.length + 1; i <= totalCols; i++) ws.getColumn(i).width = i === totalCols ? 32 : 9;

    // Data rows — one per form, sorted by unit then date
    let r = 4;
    let gOk = 0, gFault = 0;
    const sortedForms = [...gForms].sort((a, b) => (a.unit_name_snapshot || '').localeCompare(b.unit_name_snapshot || '', 'he') || a.date.localeCompare(b.date));
    for (const f of sortedForms) {
      const pf = perForm.get(f.id)!;
      const okCount = [...pf.values].filter(([k, v]) => k.startsWith('chk|') && v === '✓').length;
      const faultCount = [...pf.values].filter(([k, v]) => k.startsWith('chk|') && v === '✕').length;
      gOk += okCount; gFault += faultCount;
      const row = ws.getRow(r);
      const meta = [f.unit_name_snapshot || '—', f.number || '—', formatDate(f.date), f.phase_name_snapshot || '', f.performer_name || '', f.performer2_name || '', f.approver_name || '—', statusLabel(f.status)];
      meta.forEach((v, i) => { row.getCell(i + 1).value = v; });
      cols.forEach((c, i) => {
        const cell = row.getCell(META.length + i + 1);
        const v = pf.values.get(c.key) ?? '';
        cell.value = v;
        if (v === '✓') { cell.fill = solid(GREEN); cell.font = { bold: true, color: { argb: GREEN_TEXT } }; }
        else if (v === '✕' || v === '✕ נכשלה') { cell.fill = solid(RED); cell.font = { bold: true, color: { argb: RED_TEXT } }; }
        else if (v === '✓ עברה') { cell.fill = solid(GREEN); cell.font = { color: { argb: GREEN_TEXT } }; }
      });
      row.getCell(META.length + cols.length + 1).value = okCount;
      row.getCell(META.length + cols.length + 2).value = faultCount;
      row.getCell(META.length + cols.length + 3).value = pf.faults.join(' | ');
      for (let c = 1; c <= totalCols; c++) {
        const cell = row.getCell(c);
        cell.border = allBorders();
        cell.alignment = { horizontal: c <= META.length ? 'right' : c === totalCols ? 'right' : 'center', vertical: 'middle', wrapText: c === totalCols };
        if (!cell.font) cell.font = { size: 10 };
      }
      r++;
    }

    // Summary-sheet row for this group (links are by name)
    const srow = sum.getRow(sr++);
    [system, rank, gForms.length, gOk, gFault, name].forEach((v, i) => {
      const c = srow.getCell(i + 1);
      c.value = v;
      c.alignment = { horizontal: i < 2 ? 'right' : 'center' };
      c.border = allBorders();
      if (i === 4 && Number(v) > 0) c.font = { bold: true, color: { argb: RED_TEXT } };
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `VERO_ייצוא_מרוכז_${stamp}.xlsx`);
  return { groups: groups.size, forms: forms.length };
}
