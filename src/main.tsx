import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { runSeed } from './data/seed';
import { installPwaManifest } from './pwa/installManifest';

/**
 * Force full RTL at the document level. index.html already sets dir="rtl",
 * but when the app is embedded in another host (e.g. the hosted preview) the
 * outer <html> may not carry it — so we assert it programmatically here. This
 * makes the whole layout right-to-left everywhere (flex, grid, tables, modals),
 * not merely right-aligned text.
 */
function enforceRtl() {
  try {
    const html = document.documentElement;
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'he');
    document.body?.setAttribute('dir', 'rtl');
  } catch {
    /* ignore */
  }
}

async function bootstrap() {
  enforceRtl();

  // Make VERO installable as a standalone app (real icon) on any delivery,
  // without a separate manifest file. Progressive enhancement — never blocks.
  installPwaManifest();

  // Ensure roles / default admin / demo template exist before first render.
  try {
    await runSeed();
  } catch (e) {
    // Non-fatal: the app can still render an error boundary later.
    console.error('Seed failed', e);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );

  // Register the service worker for offline support (production only).
  // Wrapped defensively: in a sandboxed iframe registration can throw.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      try {
        navigator.serviceWorker.register('./sw.js').catch(() => {
          /* offline registration is best-effort */
        });
      } catch {
        /* ignore */
      }
    });
  }
}

bootstrap();
