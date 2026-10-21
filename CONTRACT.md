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
// state: { v:1, name:'Daniel', onboarded:false, xp:0, streak:{count,last}, days:[dateStr],
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
