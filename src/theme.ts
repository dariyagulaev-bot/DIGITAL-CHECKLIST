/**
 * Per-user UI theme (Light / Dark). Stored locally so it works fully offline
 * and persists per device/user. The theme only affects the WORK UI — the
 * printed/exported document stays light (handled by the .print-page island in
 * index.css). Everything is driven by the central design tokens.
 */
export type Theme = 'light' | 'dark';
const KEY = 'vero.theme';

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* storage may be unavailable */
  }
  return 'light';
}

export function applyTheme(theme: Theme): void {
  try {
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    /* no-op */
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* no-op */
  }
  applyTheme(theme);
}

/** Apply the saved theme as early as possible (called before React renders). */
export function initTheme(): void {
  applyTheme(getStoredTheme());
}
