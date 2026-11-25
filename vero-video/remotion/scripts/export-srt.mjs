// Export the narration in src/vero/timeline.ts as an SRT file (for voice-over recording / soft subtitles).
// Usage: node scripts/export-srt.mjs > ../subtitles/vero-inspection.he.srt
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/vero/timeline.ts", import.meta.url), "utf8");
const block = src.slice(src.indexOf("export const captions"), src.indexOf("];", src.indexOf("export const captions")));
const re = /start:\s*([\d.]+),\s*end:\s*([\d.]+),\s*text:\s*"([^"]*)"/g;
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
let i = 0, out = "";
for (const m of block.matchAll(re)) out += `${++i}\n${ts(+m[1])} --> ${ts(+m[2])}\n${m[3]}\n\n`;
process.stdout.write(out);
