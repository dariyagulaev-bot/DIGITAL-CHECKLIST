import icon192 from '@/assets/icons/icon-192.png';
import icon512 from '@/assets/icons/icon-512.png';
import maskable512 from '@/assets/icons/maskable-512.png';

/**
 * Make VERO installable as a standalone app on ANY delivery (a hosted URL, the
 * single-file preview, or a local copy) without depending on a separate
 * manifest file.
 *
 * We build the Web App Manifest at runtime and point the <link rel="manifest">
 * at a Blob URL. Crucially, `start_url`/`scope`/`id` are set to the ABSOLUTE
 * current URL — a relative start_url cannot resolve against a blob: manifest —
 * so Chrome/Edge accept it and "Add to Home screen" creates a real VERO icon
 * that opens standalone. Icons are bundled as data: URIs, so nothing is fetched
 * from the network. Safe and inert where the APIs are missing (wrapped).
 */
export function installPwaManifest(): void {
  try {
    const base = location.href.split('#')[0]; // strip the HashRouter route
    const dir = base.replace(/[^/]*$/, ''); // directory of the current document

    const manifest = {
      name: 'VERO — מערכת בקרה דיגיטלית',
      short_name: 'VERO',
      description: 'מערכת בקרה דיגיטלית לביצוע ואישור בד״חים. עובדת ללא אינטרנט.',
      lang: 'he',
      dir: 'rtl',
      id: base,
      start_url: base,
      scope: dir,
      display: 'standalone',
      display_override: ['fullscreen', 'standalone', 'minimal-ui'],
      orientation: 'any',
      background_color: '#0e1f3a',
      theme_color: '#0e1f3a',
      icons: [
        { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const url = URL.createObjectURL(blob);

    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = url;
  } catch {
    /* installability is a progressive enhancement — never block the app */
  }
}
