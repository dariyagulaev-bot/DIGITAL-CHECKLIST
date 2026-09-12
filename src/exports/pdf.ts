/**
 * Render a DOM element (the styled A4 print document) into a real, downloadable
 * multi-page PDF. Using html2canvas preserves perfect Hebrew/RTL rendering and
 * embeds the actual signature images exactly as they appear on screen.
 *
 * A compact official footer (בד״ח number · date · time · page X of Y) is stamped
 * at the bottom of EVERY page, in a reserved white band with a thin rule above,
 * so it never overlaps content. The heavy PDF libraries load on demand.
 */
export interface PdfFooter {
  number: string;
  date: string;
  time: string;
}

/** Draw the footer line to a crisp PNG (Hebrew/RTL via the canvas API). */
async function footerImage(text: string): Promise<{ url: string; ratio: number }> {
  try {
    await (document as Document).fonts?.ready;
  } catch {
    /* fonts API optional */
  }
  const scale = 4;
  const fontPx = 12 * scale;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `500 ${fontPx}px Heebo, Arial, sans-serif`;
  const textW = Math.ceil(measure.measureText(text).width);
  const padX = 6 * scale;
  const w = textW + padX * 2;
  const h = Math.ceil(fontPx * 1.6);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `500 ${fontPx}px Heebo, Arial, sans-serif`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#5a6579';
  ctx.fillText(text, w - padX, h / 2);
  return { url: canvas.toDataURL('image/png'), ratio: w / h };
}

export async function elementToPdf(
  element: HTMLElement,
  filename: string,
  footer?: PdfFooter
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    // Elements flagged .pdf-ignore (the on-screen/print footers) are not baked
    // into the raster — the per-page footer below replaces them.
    ignoreElements: (el) => el.classList?.contains('pdf-ignore') ?? false,
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  // Reserve a band at the bottom of every page for the footer (only when we
  // actually have a footer to draw).
  const footerBand = footer ? 12 : 0; // mm
  const contentH = pageH - footerBand;
  const totalPages = Math.max(1, Math.ceil(imgH / contentH));
  const margin = 12; // mm side margin for the footer rule

  // Pre-render the per-page footer PNGs (Hebrew) before touching the PDF.
  const footerPngs: Array<{ url: string; ratio: number } | null> = [];
  if (footer) {
    for (let p = 1; p <= totalPages; p++) {
      const line = `מס' בד״ח: ${footer.number} | ${footer.date} ${footer.time} | עמוד ${p} מתוך ${totalPages}`;
      footerPngs.push(await footerImage(line));
    }
  }

  const stamp = (pageIdx: number) => {
    if (!footer) return;
    // Opaque band to hide any image bleed, a thin rule, then the footer text.
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, contentH, pageW, footerBand, 'F');
    pdf.setDrawColor(210, 218, 228);
    pdf.setLineWidth(0.2);
    pdf.line(margin, contentH + 2.5, pageW - margin, contentH + 2.5);
    const png = footerPngs[pageIdx];
    if (png) {
      const hMm = 4.2;
      const wMm = hMm * png.ratio;
      const x = (pageW - wMm) / 2;
      const y = contentH + 4.5;
      pdf.addImage(png.url, 'PNG', x, y, wMm, hMm);
    }
  };

  let heightLeft = imgH;
  let position = 0;
  let page = 0;
  pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
  stamp(page);
  heightLeft -= contentH;

  while (heightLeft > 0) {
    position -= contentH;
    pdf.addPage();
    page += 1;
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    stamp(page);
    heightLeft -= contentH;
  }

  pdf.save(filename);
}
