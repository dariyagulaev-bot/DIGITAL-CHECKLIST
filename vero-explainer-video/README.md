# VERO — Animated Explainer Video

Remotion (React) project that renders the VERO onboarding/explainer video
(1920×1080, Hebrew narration + RTL subtitles, ~117s, 10 scenes).

## Render
```
npx remotion render src/index.ts VeroExplainer out/vero-explainer.mp4 \
  --browser-executable="$CHROME" --concurrency=4
```

## Structure
- `src/Video.tsx` — scene timeline (10 scenes, narration, music, SFX)
- `src/scenes/parts.tsx` — reusable scene elements (chips, cards, titles, logo)
- `src/components/` — Character (cutout presenter), Device (screenshot frame),
  Caption (RTL subtitle), Bg, Icon
- `public/character/` — the illustrated guide (4 poses, transparent cutouts)
- `public/shots/` — real VERO screenshots embedded in device frames
- `public/audio/` — per-scene narration (sc1..sc10), music.wav, SFX
- `tools/music_synth.py` — regenerates music options + SFX (numpy)

Narration timing lives in `public/audio/durations.json`; `src/Video.tsx`
`LENS` must match it.
