# Speaker Trainer

A mobile game that trains spoken English for technical talks. Every day it builds a short mission: pronunciation warmup, grammar fixes said aloud, natural phrasing, a timed speaking challenge with live filler detection, and a boss question.

- Instructions in Hebrew, practice in English.
- Works on Android Chrome and desktop. Installable (Add to Home screen). Works offline after the first visit.
- Live site: https://danielmazh.github.io/speaker-trainer/

## Privacy

- The app never uploads or saves audio. A recording lives in memory only, for "play my recording", and is deleted when you leave the screen.
- Speech to text: when on-device recognition is available (recent Chrome), the audio stays on the phone. Otherwise the browser's own speech service (Google, in Chrome) turns audio into text. You can force on-device only in Profile.
- Progress (XP, streak, scores) is saved in this browser only, in localStorage.

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765. The mic needs `localhost` or HTTPS.

## Tests

```bash
node --test
```

## Structure

See [CONTRACT.md](CONTRACT.md) for the modules and their interfaces.

| File | What it does |
|---|---|
| `js/content.js` | All drills, coach tips, badges |
| `js/engine.js` | Daily mission generator, XP, levels, streaks, spaced repetition, badges |
| `js/analyze.js` | Transcript analysis: fillers, dropped "is/are", target diff, score |
| `js/speech.js` | Mic, live speech recognition, in-memory recording |
| `js/app.js`, `js/ui/*` | Screens and router |
| `sw.js`, `manifest.webmanifest` | Offline and install |

## Deploy

GitHub Pages serves `main` from the repo root. Push to `main` and the site updates in about a minute. Bump the cache version in `sw.js` on every release.
