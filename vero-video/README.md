# VERO — פרויקט עריכת סרטון ההדרכה

| תיקייה / קובץ | תפקיד |
| --- | --- |
| `remotion/` | Remotion 4.0.547: אנימציות, כרטיסיות ומעברים ב־React (`src/Composition.tsx`) |
| `hyperframes/` | HyperFrames 0.9.91: אנימציות וידאו מבוססות HTML ו־GSAP (`index.html`) |
| `.venv/` | Python מקומי עם OpenAI Whisper ו־yt-dlp (לא נשמר ב־git, ראו `requirements.txt`) |
| `subtitles/` | קובצי SRT |
| `references/` | חומרי רפרנס שהורדו (לא נשמר ב־git) |
| `models/` | מודלי Whisper (לא נשמר ב־git) |
| `setup-test.mp4` | קליפ בדיקת ההתקנה |

Skills של Claude Code (Remotion ו־HyperFrames) מותקנים ב־`.claude/skills` בשורש המאגר.

## התקנה מחדש (מחשב חדש)

```bash
cd vero-video
(cd remotion && npm install)
(cd hyperframes && npm install)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
# FFmpeg: מותקן ברמת המערכת (apt install ffmpeg / brew install ffmpeg)
```

## פקודות

```bash
# Remotion
cd remotion && npm run dev                          # Studio
cd remotion && npx remotion render SetupTest out/x.mp4

# HyperFrames
cd hyperframes && npm run check && npm run render

# תמלול קריינות בעברית ל־SRT (ברירת מחדל: מודל turbo)
scripts/transcribe.sh narration.wav            # → subtitles/narration.srt
scripts/transcribe.sh narration.wav large-v3   # דיוק מרבי, איטי יותר

# הורדת חומר רפרנס (רק תוכן שיש לך הרשאה להוריד)
scripts/fetch-reference.sh "<url>"
```

## הערות

- **Remotion** מוריד בדרך כלל Chrome Headless Shell משלו מ־`remotion.media`. אם השרת חסום, `remotion.config.ts` משתמש בדפדפן מקומי: `REMOTION_BROWSER_EXECUTABLE` או ה־headless shell של Playwright.
- **HyperFrames:** GSAP נטען מקומית מ־`hyperframes/assets/vendor/gsap.min.js` במקום מ־CDN.
- **FFmpeg וטקסט בעברית ב־`drawtext`:** עטפו את הטקסט ב־U+202B…U+202C (RLE/PDF), אחרת המילה הלטינית קופצת לצד הלא נכון.
- **Whisper** מוריד את המודל בהרצה הראשונה מ־`openaipublic.azureedge.net` אל `models/`. אפשר גם להעתיק לשם קובץ `.pt` שהורד במחשב אחר.
