# Speaker Trainer - build contract

Mobile-first game that trains spoken English for technical talks. Daily generated missions, real mic practice with live word detection, XP, levels, streaks, badges. Instructions in Hebrew (RTL), practice content in English (LTR).

Static PWA. **No build step.** Vanilla ES modules, served as-is by GitHub Pages from `main`. Must work offline after first load (service worker), on Android Chrome and desktop.

## Hard rules for every contributor

1. **Only edit the files you own** (table below). Never touch another owner's file. Read them freely.
2. **No commits, no pushes.** The orchestrator commits.
3. **Public-safe content.** The site is public. No colleague names (use "Alex", "a colleague"), no company names, no internal money figures, user counts, speed numbers, ticket keys or internal hostnames. Use placeholders like `[X] dollars`, `[N] users`. Source of truth for safe content: `docs/source/speaking-gym-public.html`.
4. **Hyphen only.** Never use an em dash or en dash character anywhere (code, comments, copy, Hebrew or English).
5. **Hebrew copy:** short, plain, CEFR B2. **English practice copy:** natural spoken English, B2+.
6. **Privacy:** audio is never uploaded or stored by the app. Recordings live in memory as blob URLs and are revoked when the user leaves the screen. Nothing about audio goes to localStorage.
7. No secrets, no API keys, no analytics, no external network calls except Google Fonts and the browser's own speech service.

## File ownership

| Owner | Files |
|---|---|
| content | `js/content.js` |
| engine | `js/engine.js`, `tests/engine.test.mjs` |
| speech | `js/speech.js`, `js/analyze.js`, `tests/analyze.test.mjs` |
| ui | `index.html`, `css/*`, `js/app.js`, `js/ui/*`, `manifest.webmanifest`, `sw.js`, `icons/*` |
| design | `docs/design/*`, `docs/design-spec.md` (and the .pen file outside the repo) |
| qa (phase 2) | `tests/e2e/*`, `package.json`, `playwright.config.*`, and fixes anywhere after phase 1 |

## Design tokens (from `docs/reference.webp`)

```
--primary:#6C3BF5  --primary-600:#5A2BE0  --primary-50:#F1ECFF  --primary-100:#E4DAFF
--bg:#F6F3FF  --surface:#FFFFFF  --ink:#1B1530  --muted:#8A84A3  --line:#ECE7F8
--gold:#FFB020 (stars, XP)  --flame:#FF7A1A (streak)  --good:#22C55E  --bad:#F04438  --warn:#F5A524
radius: card 24px, inner 16px, pill 999px. Shadow: 0 12px 32px rgba(108,59,245,.14)
font: "Rubik" (Hebrew + Latin UI), "Plus Jakarta Sans" optional for English display. Fallback system-ui.
```
Dark mode: deep violet ground `#120D24`, surface `#1C1534`, ink `#F2EEFF`, keep primary.
Look and feel: purple header band with rounded bottom, white rounded cards, pill chips, floating bottom nav with a raised center button (center = "Start today's mission"), soft 3D-feel illustrations done with CSS/SVG (no external images).

## Module interfaces

### `js/content.js` (content)
```js
export const CATEGORIES = [{ id, label_he, label_en, icon /* emoji-free: short svg name */, color, desc_he }]
// ids: 'grammar','pronoun','phrasing','fillers','speaking','scripts','qa','pronunciation','presenting'
export const ITEMS = [ /* every item: */ { id:'g-001', cat, type, level /*1..3*/, why_he, src /* 'MM:SS' or null */, ...typeFields } ]
// type 'fix':    { wrong, right, note_he }                       say the corrected sentence aloud
// type 'choice': { wrong, options:[...], correct:index, note_he } pick the natural English
// type 'speak':  { title_he, prompt_en, seconds, must:[...], banned:[...], model_en, bad }   free speaking
// type 'recall': { title_he, text_en }                           script from memory
// type 'shadow': { word, hint_he, sentence_en }                  pronunciation, repeat after
// type 'qa':     { question_en, model_en, note_he }              tough question
export const COACH = [{ id, title_he, body_he, bullets_he:[...], examples_en:[...] }]   // presenting tips
export const AUDIENCES = [{ id, name_he, focus_he:[...], skip_he, open_en, joke_en }]
export const ICEBREAKERS = [{ line_en, when_he }]
export const FILLERS = ['so','basically','whatever','like','um','uh','let\'s say','again','actually','you know']
export const BADGES = [{ id, title_he, desc_he, icon, rule }]  // rule keys understood by engine.js
export const LEVEL_TITLES_HE = [...]  // index = level-1
```

### `js/engine.js` (engine) - pure functions, storage injected
```js
export function todayStr(date = new Date()) // 'YYYY-MM-DD' local
export function seededRandom(seedString) // () => float 0..1
export function createStore(storage = globalThis.localStorage) // { get(), set(patchOrFn), reset() }, try/catch safe, key 'speakerTrainer.v1'
// state: { v:1, name:'', onboarded:false, xp:0, streak:{count,last}, days:[dateStr],
//   items:{ [id]:{ ease, interval, due, reps, lapses, last } }, history:[{ date, taskKind, itemId, score, metrics }],
//   badges:[id], settings:{ onDevice:'auto'|'on'|'off', haptics:true, sound:true, theme:'system' },
//   daily:{ date, tasks:[...], done:[taskId] } }
export function levelFromXp(xp) // { level, title_he, cur, next, pct }
export function generateDaily(state, ITEMS, dateStr) // { date, tasks:[{ id, kind, title_he, itemIds:[...], xp, minutes }] }
// 5 tasks, about 12 minutes: warmup(shadow) -> fix -> choice -> speak -> boss(qa or recall). Deterministic per date. Prefers due and weak items.
export function grade(itemState, quality /*0..5*/, now = Date.now()) // SM-2 lite, returns new itemState
export function completeTask(state, taskId, results /*[{itemId, score 0..100, metrics}]*/, now) // { state, xpGained, newBadges:[id], streakUp:boolean }
export function stats(state) // { totalXp, sessions, avgScore, fillersPerMinTrend:[...last 10], bestStreak, mastered, byCat:{} }
```

### `js/analyze.js` (speech) - pure, runs in node and browser
```js
export function tokenize(text) // [{ w, norm, i }]
export function analyze(transcript, durationSec, { target, must, banned } = {})
// -> { words, wpm, fillers:{ so:n, ... }, fillerTotal, fillersPerMin, beDrops:[{ text, index }], heForIt:n,
//      mustHit:[], mustMiss:[], targetScore /*0..1 or null*/, diff:[{ w, status:'ok'|'miss'|'extra' }],
//      score /*0..100*/, tips_he:[] }
export function highlight(transcript) // [{ text, kind:'word'|'filler'|'bedrop'|'he' }]
```

### `js/speech.js` (speech) - browser only
```js
export function support() // { recognition:boolean, onDevice:'yes'|'no'|'unknown', recorder:boolean, secure:boolean }
export function createSession({ lang='en-US', onDevice='auto', record=true, onInterim, onFinal, onLevel /*0..1*/, onError })
// -> { start(): Promise<void>, stop(): Promise<{ transcript, durationSec, audioUrl|null }>, cancel(), discard() }
```

### UI (ui)
`js/app.js` boots, routes by bare hash (`#home`, `#mission`, `#play`, `#coach`, `#profile`, `#onboarding`), imports the modules above. Screens in `js/ui/*.js`, each `export function render(root, ctx)`. If the mic or recognition is unavailable, every speaking task falls back to: record-only playback plus self-rating, or type-what-you-said, so the game always works.

---

# Phase 3 addendum: skill paths, profile, rich stats, data layer

Goal: many more professional-English skills (hi-tech, talks, audiences, status updates, presenting systems, incidents, meetings, numbers, vocabulary), a Duolingo-style path of tracks and units, a richer stats page, a user profile, and a data layer that is ready to scale (sync, accounts, security) later. Keep the app simple to use.

## Ownership (phase 3)

| Owner | Files |
|---|---|
| content | `js/content.js` |
| engine | `js/engine.js`, `js/data.js`, `tests/engine.test.mjs`, `tests/data.test.mjs` |
| ui-features | `js/app.js`, `js/ui/home.js`, `js/ui/stats.js`, `js/ui/profile.js`, `js/ui/onboarding.js`, `js/ui/shell.js`, NEW `js/ui/path.js`, `js/ui/track.js`, `css/screens.css`, `css/components.css`, `index.html`, `sw.js` (cache list + version) |
| qa | `tests/e2e/*`, `package.json`, `playwright.config.mjs`, `js/ui/play*.js`, `js/ui/mic.js`, `js/ui/result.js`, `js/ui/mission.js`, `js/ui/coach.js`, `css/play.css`, `css/base.css` |
| docs-security | `docs/SCALING.md`, `docs/DATA_MODEL.md`, `SECURITY.md`, `.github/*` |

Need a change in a file you do not own? Report it to the orchestrator. Do not edit it.

## content.js additions
- New CATEGORIES (keep the old 9): `status` (status updates, standups, exec status), `incident` (incident comms, postmortems), `systems` (presenting a system or architecture), `meetings` (agree, disagree, interrupt, clarify, push back politely), `numbers` (saying numbers, data, trends, percentages, dates), `vocab` (hi-tech verbs and phrasal verbs: roll out, roll back, spin up, tear down, mitigate, deprecate), `stress` (word stress and intonation), `interview` (talking about your work and impact), `smalltalk` (small talk with international colleagues).
- Same 6 item types only (fix, choice, speak, recall, shadow, qa). New id prefixes: st-, in-, sy-, mt-, nu-, vo-, ws-, iv-, sm-.
- `export const TRACKS = [{ id, title_he, desc_he, icon, color, units:[{ id, title_he, goal_he, itemIds:[...], bossId }] }]`. 8 to 10 tracks, 4 to 6 units each, 5 to 8 items per unit, bossId is a speak, qa or recall item. Every itemId must exist in ITEMS. An item may appear in more than one unit.

## engine.js additions
- State schema v2 with migration from v1 (keep all v1 data):
  - `profile: { id /* uuid v4 */, name, role, nativeLang:'he', goals:[], focusTracks:[], dailyGoalMin:10, nextTalkDate:null, audiences:[], createdAt }`
  - `meta: { schema:2, createdAt, updatedAt, appVersion }`
  - `tracks: { [unitId]: { bossPassed:boolean, bestScore } }`
- `trackProgress(state, TRACKS, ITEMS)` -> `{ [trackId]: { pct, unitsDone, unitsTotal, currentUnitId, units:{ [unitId]:{ status:'locked'|'open'|'done', pct } } } }`. First unit of every track is open. A unit is done when every item in it has a best score >= 70 and its boss passed (score >= 70). The next unit opens when the previous is done.
- `buildUnitSession(state, unit, ITEMS)` -> `{ id:'unit:'+unit.id, kind:'unit', title_he, itemIds, bossId, xp }`.
- `completePractice(state, sessionId, results, now, opts)` handles `unit:*` and `practice:*` sessions (moves the free-practice logic out of the UI): grade items, XP (+5 per item >= 60, unit completion +60, boss pass +40), history, streak, counters, badges, `tracks` update. Same return shape as completeTask.
- `stats(state, ITEMS, TRACKS)` extended, keep old fields: `minutesTotal`, `minutesByDay` (last 30 days, array of {date, min}), `todayMin`, `goalPct` (todayMin vs profile.dailyGoalMin), `wordsSpoken`, `wpmTrend` (last 10), `scoreTrend` (last 10), `accuracyByCat` ({cat:{avg,count}}), `weakest` (3 cat ids), `strongest` (3 cat ids), `fillerTotals` ({so:n,...}), `activeDays`, `tracksDone`.
- History entries may carry `metrics: { fromMic, words, wpm, durationSec, fillerTotal, fillersPerMin, fillers:{}, beDrops }`. Never transcript text, never audio.

## data.js (new, engine owner)
- `exportData(state)` -> pretty JSON string `{ app:'speaker-trainer', schema:2, exportedAt, state }`.
- `importData(text)` -> validated, migrated state, or throws `Error` with a Hebrew `message`.
- `createLocalAdapter(storage)` -> `{ load(), save(state), clear() }` (wraps createStore). Remote sync is NOT built now: document the adapter interface `{ load, save, sync }` in a JSDoc block for a future backend.
- `summary(state)` -> small anonymous object (no name, no id) for future opt-in telemetry. Not sent anywhere.

## UI additions (ui-features)
- Bottom nav: Home, Path (new, replaces nothing: put Coach inside Path or Home if needed to keep 5 slots), center Play, Stats, Profile. Keep Coach reachable.
- `#path`: list of tracks with progress ring; `#track/<id>` is not allowed (bare hash only): use `#track` plus state in memory or localStorage `ui.track`.
- Track screen: vertical unit path (like the mission map), locked/open/done, boss node, start unit -> runs the existing players via a unit session.
- Onboarding: after the name, 4 quick optional questions (role, main goal, next talk date, daily minutes 5/10/15/20, audiences). Skippable.
- Home: today's goal ring (minutes), "continue your path" card, mission card stays the hero.
- Stats: clear and simple, no chart overload: 4 tiles (minutes, words spoken, avg score, streak), 30-day activity heatmap, one trend line (fillers per minute) with a toggle to wpm or score, accuracy by skill as horizontal bars, weakest 3 skills with a "practice" button, badges grid.
- Profile: edit profile fields, export data (copy to clipboard and show the JSON in a textarea to save), import data (paste JSON), privacy and mic section stays.
- Players must pass `words` and `wpm` into metrics (qa owner adds this in play-*.js; ui-features passes results to completePractice).
