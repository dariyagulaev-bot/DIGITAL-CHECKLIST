/*
 * Finalize the OFFLINE single-file build so it runs when opened as a local
 * file (file://) on the device — including iPad Safari.
 *
 * Vite tags the entry script as `<script type="module" crossorigin>`. Browsers
 * refuse to execute module scripts from a file:// origin (null origin / CORS),
 * which shows a blank white screen. The bundle is already emitted as a classic
 * IIFE (see vite.config OFFLINE_APP branch), so we only need to drop the
 * `type="module"` and `crossorigin` attributes to make it a classic script.
 *
 * Output: dist/VERO.html (the file transferred to the device).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = resolve(root, 'dist/index.html');
const outPath = resolve(root, 'dist/VERO.html');

let html = readFileSync(srcPath, 'utf8');

// Turn `<script type="module" crossorigin>` (in any attribute order) into a
// plain `<script>` so it executes from file://.
html = html.replace(/<script\b([^>]*)>/gi, (tag, attrs) => {
  const cleaned = attrs
    .replace(/\s*type=("|')module\1/gi, '')
    .replace(/\s*crossorigin(=("|')[^"']*\2)?/gi, '');
  return `<script${cleaned}>`;
});

writeFileSync(srcPath, html);
writeFileSync(outPath, html);

const stillModule = /<script[^>]*type=("|')module\1/i.test(html);
if (stillModule) {
  console.error('finalize-offline: a module script remained — file:// would still fail.');
  process.exit(1);
}
console.log('finalize-offline: wrote dist/VERO.html as a file://-safe classic bundle.');
