# Speaker Trainer

A free mobile game that trains professional spoken English for Hebrew-speaking tech professionals: talks, meetings, status updates, incident calls, interviews and small talk. Every day it builds a short mission: pronunciation warmup, common mistakes said aloud, natural phrasing, a timed speaking challenge with live filler detection, and a boss question. Skill paths add tracks and units on top of the daily mission.

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
npm test                                   # unit tests
npx playwright test --reporter=line        # e2e, serves the app on port 8790
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

GitHub Pages deploys through `.github/workflows/pages.yml` on every push to `main` (about a minute). It publishes only the app files. Bump the cache version in `sw.js` on every release.

## Copyright

Copyright (c) 2026 Daniel Mazhbits. All rights reserved. See [LICENSE](LICENSE).
