import { useEffect, useRef, useState, forwardRef, type CSSProperties } from 'react';
import { certFontCss } from '@/services/certificateTemplates';
import { renderTokens, type CertificateFieldData } from '@/services/certificates';
import { formatDateDots } from '@/exports/labels';
import type { CertCanvasDesign, CertElement } from '@/types';

/** mm → px at 96dpi (CSS reference). Used only to compute screen scale. */
const PX_PER_MM = 96 / 25.4;

/** Resolve the text of a text/field element, including dual-date fields. */
export function resolveElementText(el: CertElement, data: CertificateFieldData): string {
  if (el.type === 'text') return renderTokens(el.text ?? '', data);
  if (el.type === 'field') {
    const token = el.field ?? '';
    if (el.date_mode === 'both' && (token.includes('תאריך') || token.includes('תוקף'))) {
      const isExpiry = token.includes('תוקף');
      const greg = formatDateDots(isExpiry ? data.expiresAt : data.issuedAt);
      const heb = isExpiry ? data.expiresHebrew : data.issuedHebrew;
      return `${greg}\n${heb}`;
    }
    return renderTokens(token, data);
  }
  return '';
}

function boxStyle(el: CertElement): CSSProperties {
  const s: CSSProperties = {
    position: 'absolute',
    left: `${el.x}mm`,
    top: `${el.y}mm`,
    width: `${el.w}mm`,
    height: `${el.h}mm`,
    zIndex: el.z,
    boxSizing: 'border-box',
  };
  return s;
}

function TextLike({ el, data }: { el: CertElement; data: CertificateFieldData }) {
  const justify = el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center';
  const items = el.valign === 'top' ? 'flex-start' : el.valign === 'bottom' ? 'flex-end' : 'center';
  const style: CSSProperties = {
    ...boxStyle(el),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: items,
    alignItems: justify,
    textAlign: (el.align ?? 'center') as CSSProperties['textAlign'],
    fontFamily: certFontCss(el.font_key),
    fontSize: `${el.font_size ?? 12}pt`,
    fontWeight: el.bold ? 700 : 400,
    fontStyle: el.italic ? 'italic' : 'normal',
    textDecoration: el.underline ? 'underline' : 'none',
    color: el.color ?? '#0f172a',
    background: el.bg_color ?? 'transparent',
    border: el.border_color ? `${el.border_width ?? 0.3}mm solid ${el.border_color}` : 'none',
    lineHeight: 1.35,
    whiteSpace: 'pre-line',
    // Allow a long value (long system name, long description) to WRAP to another
    // line and remain visible rather than being clipped. Horizontal wrapping is
    // bounded by the element's own width, which stays inside the page.
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    padding: '0 1mm',
  };
  return (
    <div style={style} dir="rtl">
      {resolveElementText(el, data)}
    </div>
  );
}

function Shape({ el }: { el: CertElement }) {
  if (el.type === 'line') {
    return (
      <div
        style={{
          ...boxStyle(el),
          height: `${el.line_width ?? 0.5}mm`,
          background: el.line_color ?? '#0f172a',
        }}
      />
    );
  }
  // rect
  return (
    <div
      style={{
        ...boxStyle(el),
        background: el.fill_color ?? 'transparent',
        border: el.border_color
          ? `${el.border_width ?? 0.3}mm solid ${el.border_color}`
          : 'none',
        borderRadius: '0.5mm',
      }}
    />
  );
}

function ImageEl({ el, signatureData }: { el: CertElement; signatureData?: string }) {
  const src = el.type === 'signature' ? signatureData : el.src ?? undefined;
  if (!src) {
    // Placeholder only matters in the editor; in output render nothing.
    return <div style={boxStyle(el)} />;
  }
  return (
    <img
      src={src}
      alt=""
      style={{
        ...boxStyle(el),
        objectFit: el.keep_aspect === false ? 'fill' : 'contain',
      }}
    />
  );
}

/**
 * Raw A4 sheet rendered at REAL millimetre size. Used directly for printing and
 * for PDF capture (html2canvas → elementToPdf), so the output matches the
 * on-screen preview exactly. For on-screen display, wrap in {@link ScaledSheet}.
 */
export const CertificateSheet = forwardRef<HTMLDivElement, {
  design: CertCanvasDesign;
  data: CertificateFieldData;
  signatureData?: string;
}>(function CertificateSheet({ design, data, signatureData }, ref) {
  const els = [...design.elements].sort((a, b) => a.z - b.z);
  return (
    <div
      ref={ref}
      className="certificate-sheet"
      dir="ltr"
      style={{
        position: 'relative',
        width: `${design.width_mm}mm`,
        height: `${design.height_mm}mm`,
        background: design.bg_color,
        overflow: 'hidden',
        // Geometry is LTR (absolute mm coords are physical); each text element
        // sets its own dir="rtl". This keeps positions identical to the editor.
        direction: 'ltr',
      }}
    >
      {els.map((el) => {
        if (el.type === 'text' || el.type === 'field') return <TextLike key={el.id} el={el} data={data} />;
        if (el.type === 'line' || el.type === 'rect') return <Shape key={el.id} el={el} />;
        return <ImageEl key={el.id} el={el} signatureData={signatureData} />;
      })}
    </div>
  );
});

/**
 * Screen wrapper that scales the real-mm sheet to fit its container width while
 * preserving the exact A4 proportions. Print uses the unscaled sheet (CSS below).
 */
export function ScaledSheet({
  design,
  data,
  signatureData,
  maxWidthPx,
}: {
  design: CertCanvasDesign;
  data: CertificateFieldData;
  signatureData?: string;
  maxWidthPx?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const sheetWpx = design.width_mm * PX_PER_MM;
  const sheetHpx = design.height_mm * PX_PER_MM;

  useEffect(() => {
    const update = () => {
      const avail = Math.min(wrapRef.current?.clientWidth ?? sheetWpx, maxWidthPx ?? Infinity);
      setScale(Math.min(1, avail / sheetWpx));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [sheetWpx, maxWidthPx]);

  // IMPORTANT: the scaling wrappers are forced to `direction: ltr`. The page is
  // RTL globally, and an un-scaled child wider than its clip box would otherwise
  // be anchored to the RIGHT and overflow LEFT; combined with a physical
  // `transform-origin: top left` that shifted the whole sheet left and clipped
  // it. With LTR geometry the child anchors to the physical left and scales into
  // place exactly. Element TEXT keeps its own dir="rtl" inside CertificateSheet.
  return (
    <div ref={wrapRef} style={{ width: '100%', direction: 'ltr' }}>
      <div
        className="mx-auto shadow-soft"
        style={{ width: sheetWpx * scale, height: sheetHpx * scale, overflow: 'hidden', direction: 'ltr' }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: sheetWpx,
            height: sheetHpx,
            direction: 'ltr',
          }}
        >
          <CertificateSheet design={design} data={data} signatureData={signatureData} />
        </div>
      </div>
    </div>
  );
}
