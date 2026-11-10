import { fontCss, renderTokens, type CertificateFieldData } from '@/services/certificates';
import type { CertificateDesign } from '@/types';

/**
 * Pure, offline certificate renderer shared by the live designer preview and the
 * printable certificate. All styling comes from the design (embedded logo, local
 * font, colors); dynamic [tokens] are substituted from `data`. No network assets.
 */
export function CertificateView({
  design,
  data,
  signatureData,
}: {
  design: CertificateDesign;
  data: CertificateFieldData;
  signatureData?: string;
}) {
  return (
    <div
      className="certificate-sheet relative mx-auto flex flex-col items-center overflow-hidden rounded-lg border px-10 py-12 text-center"
      style={{
        width: '100%',
        maxWidth: 820,
        minHeight: 560,
        background: design.bg_color,
        color: design.text_color,
        fontFamily: fontCss(design.font_key),
        borderColor: design.accent_color,
        borderWidth: 2,
      }}
    >
      {/* Accent frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-3 rounded-md"
        style={{ border: `1px solid ${design.accent_color}55` }}
      />

      {design.logo_data && (
        <img
          src={design.logo_data}
          alt=""
          className="relative mb-4 object-contain"
          style={{ maxHeight: 90, maxWidth: 220 }}
        />
      )}

      <h1 className="relative text-[30px] font-extrabold" style={{ color: design.accent_color }}>
        {renderTokens(design.title, data)}
      </h1>
      {design.subtitle && (
        <div className="relative mt-1 text-[14px] opacity-80">{renderTokens(design.subtitle, data)}</div>
      )}

      <div
        aria-hidden
        className="relative my-5 h-[3px] w-28 rounded-full"
        style={{ background: design.accent_color }}
      />

      <div className="relative flex flex-1 flex-col justify-center gap-3">
        {design.body_lines.map((line, i) => (
          <p key={i} className="text-[17px] leading-relaxed">
            {renderTokens(line, data)}
          </p>
        ))}
      </div>

      {design.show_signature && (
        <div className="relative mt-6 flex flex-col items-center">
          {signatureData ? (
            <img src={signatureData} alt="חתימת המסמיך" style={{ height: 64 }} />
          ) : (
            <div style={{ height: 64 }} />
          )}
          <div className="mt-1 w-56 border-t pt-1 text-[13px]" style={{ borderColor: design.text_color }}>
            {renderTokens('חתימת המסמיך: [שם המסמיך]', data)}
          </div>
        </div>
      )}

      {design.footer && (
        <div className="relative mt-6 text-[12px] opacity-70">{renderTokens(design.footer, data)}</div>
      )}
    </div>
  );
}
