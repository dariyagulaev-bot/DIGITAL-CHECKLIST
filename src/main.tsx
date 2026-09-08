import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { runSeed } from './data/seed';

async function bootstrap() {
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
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        /* offline registration is best-effort */
      });
    });
  }
}

bootstrap();
