# Data model

This page describes what Speaker Trainer saves, where, and for how long.

Status: schema v2 is defined in `CONTRACT.md` (Phase 3 addendum) and built in `js/engine.js` (`SCHEMA = 2`, `APP_VERSION = '3.0.0'`, `defaultState()`, `migrate()`, `ensureIdentity()`). Export and import live in `js/data.js`. If this page and the code ever disagree, the code wins. Fix this page.

## Where data lives

| What | Where | Notes |
|---|---|---|
| All game state | `localStorage`, key `speakerTrainer.v1` | One JSON string. The key name stays `v1` for all schema versions. The version lives inside the object (`meta.schema`). |
| UI memory (selected track) | `localStorage`, key `ui.track` | A track id string. Not part of the state. Not exported. |
| App files for offline use | Cache Storage, `speaker-trainer-<version>` | Same-origin app files only. No user data. |
| Google Fonts | Cache Storage, `speaker-trainer-fonts` | Font CSS and font files. No user data. |
| Recordings | Page memory only, as blob URLs | Revoked when the user leaves the play screen. Never written to disk by the app. |

There is no server. Nothing leaves the browser, except:

- Google Fonts requests (font files only).
- Audio sent to the browser's own speech service when on-device recognition is not used. This is the browser's service, not the app. The user can force on-device only in Profile.

## What is NEVER stored

- Audio, in any form (no blobs, no base64, no IndexedDB).
- Transcript text (what the user said or typed).
- Free text answers.
- Device ids, IP addresses, location, contacts, or any analytics.

History keeps numbers only (`metrics`). See the history table below.

## State schema v2

Top-level shape:

```js
{
  v: 2,                 // schema version (same as meta.schema)
  name: '',             // legacy, mirrors profile.name (empty until the user sets one)
  onboarded: false,
  xp: 0,
  missions: 0,
  streak:   { count, last, best },
  days:     ['YYYY-MM-DD', ...],
  profile:  { id, name, role, nativeLang, goals, focusTracks, dailyGoalMin, nextTalkDate, audiences, createdAt },
  meta:     { schema: 2, createdAt, updatedAt, appVersion },
  tracks:   { [unitId]: { bossPassed, bestScore } },
  items:    { [itemId]: { ease, interval, due, reps, lapses, last, best } },
  history:  [{ date, ts, taskId, taskKind, itemId, cat, score, metrics }],
  counters: { fillerFree, perfect, boss, graded, mic, nightOwl, earlyBird, words, minutes, cats: { [catId]: n } },
  badges:   [badgeId, ...],
  settings: { onDevice, haptics, sound, theme },
  daily:    { date, tasks: [...], done: [taskId], bonus }
}
```

### Field table

#### Root

| Field | Type | Purpose |
|---|---|---|
| `v` | number | Schema version. v1 states had `1`. Migration sets it to `2`, same as `meta.schema`. |
| `name` | string | Legacy display name. v2 keeps it in sync with `profile.name`. |
| `onboarded` | boolean | True after the first-run slides. |
| `xp` | number | Total XP. Level is derived from it (`levelFromXp`). |
| `missions` | number | Count of fully completed daily missions. |
| `days` | string[] | Dates (`YYYY-MM-DD`, local) with at least one completed task. Used for the calendar and active days. |

#### `streak`

| Field | Type | Purpose |
|---|---|---|
| `count` | number | Current streak in days. |
| `last` | string or null | Last day that counted for the streak. |
| `best` | number | Best streak ever. |

#### `profile` (new in v2)

| Field | Type | Purpose |
|---|---|---|
| `id` | string (uuid v4) | Random local id. Future sync key. Not linked to any person. |
| `name` | string (max 24) | Display name. |
| `role` | string | Optional job role from onboarding. |
| `nativeLang` | string | Default `'he'`. |
| `goals` | string[] | Optional goal ids. |
| `focusTracks` | string[] | Track ids the user wants to focus on. |
| `dailyGoalMin` | number | Daily goal in minutes: 5, 10, 15 or 20. Default 10. |
| `nextTalkDate` | string or null | Date of the next talk, if the user set one. |
| `audiences` | string[] | Audience ids (from `AUDIENCES` in content). |
| `createdAt` | number (epoch ms) | When the profile was created. |

#### `meta` (new in v2)

| Field | Type | Purpose |
|---|---|---|
| `schema` | number | Schema version. `2` today. Drives migration. |
| `createdAt` | number (epoch ms) | When this state was first created. |
| `updatedAt` | number (epoch ms) | Last write. Future sync uses it for conflicts. |
| `appVersion` | string | App version that last wrote the state. |

#### `tracks` (new in v2)

Keyed by unit id (not track id).

| Field | Type | Purpose |
|---|---|---|
| `bossPassed` | boolean | True after the unit boss scored 70 or more. |
| `bestScore` | number 0..100 | Best boss score for this unit. |

Track and unit progress (`pct`, `status`) is computed by `trackProgress()`. It is not stored.

#### `items` (spaced repetition state)

Keyed by item id from `js/content.js`.

| Field | Type | Purpose |
|---|---|---|
| `ease` | number (min 1.3) | SM-2 ease factor. Starts at 2.5. |
| `interval` | number (days) | Days until the next review. |
| `due` | number (epoch ms) | When the item is due again. |
| `reps` | number | Correct answers in a row. Reset on a lapse. |
| `lapses` | number | Times the item was failed (quality under 3). |
| `last` | number (epoch ms) | Last time the item was graded. |
| `best` | number 0..100 | Best score for this item (v2). Unit progress uses it (pass mark 70). Migration fills it from history. |

#### `history`

Newest last. Capped at 500 entries (`HISTORY_CAP`). Older entries are dropped.

| Field | Type | Purpose |
|---|---|---|
| `date` | string | Local date of the attempt. |
| `ts` | number (epoch ms) | Time of the attempt. |
| `taskId` | string | Daily task id, `unit:<id>` or `practice:<...>`. |
| `taskKind` | string | `warmup`, `fix`, `choice`, `speak`, `boss`, `unit`, `practice`. |
| `itemId` | string | Content item id. |
| `cat` | string or null | Category id of the item. |
| `score` | number 0..100 | Score for this attempt. |
| `metrics` | object | Numbers only. See below. |

`metrics` (all optional):

| Field | Type | Purpose |
|---|---|---|
| `mode` | string | `speech`, `record`, `typed`, `self` or `tap`. |
| `fromMic` | boolean | True when live speech recognition produced the score. |
| `words` | number | Word count of the take. |
| `wpm` | number | Words per minute. |
| `durationSec` | number | Length of the take in seconds. |
| `fillerTotal` | number | Total filler words. |
| `fillersPerMin` | number | Fillers per minute (speech mode only). |
| `fillers` | object | Count per filler word, for example `{ so: 2, um: 1 }`. Keys come from the fixed `FILLERS` list. |
| `beDrops` | number | Count of dropped "is/are". |
| `targetScore` | number 0..1 or null | Match against the target sentence. |
| `selfRated` | boolean | True when the user rated the take with stars. |

`metrics` never holds transcript text or audio.

#### `counters`

Used by badge rules.

| Field | Type | Purpose |
|---|---|---|
| `fillerFree` | number | Speak tasks with zero fillers. |
| `perfect` | number | Attempts with score 95 or more. |
| `boss` | number | Boss tasks completed (first time each day). |
| `graded` | number | Total graded attempts. |
| `mic` | number | Attempts scored from the mic. |
| `nightOwl` | number | Tasks done between 22:00 and 05:00. |
| `earlyBird` | number | Tasks done between 05:00 and 08:00. |
| `words` | number | Total words spoken (v2). Migration fills it from history. |
| `minutes` | number | Total practice minutes (v2). Measured duration, or an estimate per item type. |
| `cats` | object | Attempts per category id. |

#### `badges`

| Field | Type | Purpose |
|---|---|---|
| `badges` | string[] | Earned badge ids (from `BADGES` in content). |

#### `settings`

| Field | Type | Purpose |
|---|---|---|
| `onDevice` | `'auto'`, `'on'`, `'off'` | Speech recognition mode. `on` never uses the cloud service. |
| `haptics` | boolean | Vibrate on answers. |
| `sound` | boolean | Play sounds. |
| `theme` | `'system'`, `'light'`, `'dark'` | Color theme. Read before first paint by `index.html`. |

#### `daily`

| Field | Type | Purpose |
|---|---|---|
| `date` | string or null | Date of the current mission. |
| `tasks` | object[] | 5 tasks: `{ id, kind, title_he, itemIds, xp, minutes }`. Generated by `generateDaily`, deterministic per date. |
| `done` | string[] | Task ids already completed today. |
| `bonus` | boolean | True after the mission bonus XP was given. |

## Loading and migration

- `createStore()` reads the key, parses it, and merges it over `defaultState()`.
- Known keys keep their default type. A wrong type falls back to the default.
- Unknown keys survive the merge (forward compatibility).
- A missing or broken value gives a fresh default state. Storage errors never crash the app.
- v1 to v2 (`migrate()`): all v1 data is kept. It adds `profile` (with `name` copied from `name`), `meta` and `tracks`, fills `items[id].best`, `counters.words` and `counters.minutes` from history, and sets `v = 2` and `meta.schema = 2`. It is pure: it does not invent ids or times.
- `ensureIdentity()` then fills `profile.id` (uuid v4), `profile.createdAt`, `meta.createdAt`, `meta.updatedAt` and `meta.appVersion`.
- The keys `__proto__`, `constructor` and `prototype` are dropped on merge (`isSafeKey`).
- `name` and `profile.name` are kept in step on every write: whichever changed wins.

Note: arrays are copied as they are. Their elements are not type checked on load. See `SECURITY.md`, Findings.

## Export and import

Export (`exportData(state)` in `js/data.js`) gives pretty JSON:

```json
{
  "app": "speaker-trainer",
  "schema": 2,
  "exportedAt": "2026-10-21T12:00:00.000Z",
  "state": { "...": "the full state object above" }
}
```

- The user copies it to the clipboard or saves it from a textarea in Profile.
- It holds no audio and no transcripts. It does hold the display name and profile answers.

Import (`importData(text)`):

- Parses the text with `JSON.parse` only.
- Checks `app === 'speaker-trainer'` and a known `schema`.
- Migrates older schemas to the current one.
- Validates types (see `SECURITY.md` for the rules an import must follow).
- On any problem it throws an `Error` with a Hebrew message. The current state is not changed.

## Retention

- Data stays in this browser until the user resets it, clears site data, or uninstalls the app.
- History keeps the last 500 attempts only.
- Recordings are deleted when the user leaves the play screen.
- "Reset progress" in Profile removes the key and keeps only the name and settings.
- There is no copy anywhere else. If the user clears the browser, the data is gone. Export is the backup.

## Shared origin note

On GitHub Pages the site runs on `<user>.github.io`. All project sites of the same GitHub user share that origin, so they share `localStorage`. Another page on the same origin can read or change `speakerTrainer.v1`. Treat stored state as untrusted input. See `SECURITY.md`.
