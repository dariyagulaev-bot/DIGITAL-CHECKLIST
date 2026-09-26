import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-hebrew/hebrew-400.css';
import '@fontsource/ibm-plex-sans-hebrew/hebrew-500.css';
import '@fontsource/ibm-plex-sans-hebrew/hebrew-600.css';
import '@fontsource/ibm-plex-sans-hebrew/latin-400.css';
import '@fontsource/ibm-plex-sans-hebrew/latin-500.css';
import '@fontsource/ibm-plex-sans-hebrew/latin-600.css';
import './styles.css';
import { App } from './App';
import { repo } from './data/repo';
import { registerSW } from 'virtual:pwa-register';

async function start() {
  // Ask the browser not to evict our data under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
  await repo.init();
  await repo.ensureUpToCurrent();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

start().catch(err => {
  console.error(err);
  document.getElementById('root')!.innerHTML =
    '<p style="padding:24px;font-family:sans-serif">לא ניתן לפתוח את מאגר הנתונים במכשיר. ייתכן שהדפדפן במצב גלישה פרטית. נסי לפתוח שוב בחלון רגיל.</p>';
});

registerSW({ immediate: true });
