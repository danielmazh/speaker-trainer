# Security

Speaker Trainer is a static PWA on GitHub Pages. No backend, no accounts, no runtime dependencies. This page covers the threat model, what is in place, what to add when a backend exists, a code review, and how to report a problem.

## Report a vulnerability

- Use GitHub private vulnerability reporting: the repo's **Security** tab, then **Report a vulnerability**.
- Do not open a public issue for a security bug.
- Please include: what you found, steps to reproduce, the browser and device, and the impact.
- We aim to reply within 7 days and to fix confirmed issues within 30 days.
- Please do not test against other people's devices or data. Everything runs in your own browser, so you can test locally (`python3 -m http.server`).

## What we protect

| Asset | Why it matters |
|---|---|
| The user's voice | Most sensitive. The app never stores or uploads audio. |
| Progress state in `localStorage` | Display name, profile answers, scores. Low sensitivity, but the user cares about it. |
| The page itself | Script running on the page can use the mic after the user granted it. |
| The published site | Anyone who can push to `main` changes what every user runs. |

## Threat model (current app)

| Threat | Where | Risk today | What is in place | Gaps |
|---|---|---|---|---|
| XSS from content | `js/content.js` rendered via `innerHTML` in `js/ui/*` | Low | Content is static, in the repo, reviewed. All content strings go through `esc()` (`js/ui/dom.js:3`). | Helpers that take raw HTML (`band`, `ringSvg` label, `icon` class) must only get trusted strings. See Findings. |
| XSS from imported JSON | Profile import (`importData` in `js/data.js`) | Medium | `JSON.parse` only, no `eval`. Unsafe keys (`__proto__`, `constructor`, `prototype`) are dropped on merge (`isSafeKey` in `js/engine.js`). | Array elements are not type checked. Some numbers from state reach `innerHTML` without escaping. See Findings F1, F2. |
| XSS from transcripts | Speech results and typed text | Low | Rendered with `esc()` in `segHtml` and `diffHtml` (`js/ui/mic.js:22-50`). Transcripts are never stored. | None found. |
| `localStorage` tampering | Key `speakerTrainer.v1` | Low to Medium | Load is wrapped in try/catch. Known keys keep their type. | Same as imported JSON. Also: all repos of the same GitHub user share the `<user>.github.io` origin, so their pages can read and write this key. See F4. |
| No CSP | `index.html` | Low | No third-party scripts. Only Google Fonts CSS and fonts load from outside. | No Content-Security-Policy. An inline script in `index.html` blocks a strict policy. See F3. |
| Service worker cache poisoning | `sw.js` | Low | Same-origin only. Caches only `res.ok` and `type === 'basic'` responses. Old caches are deleted on activate. Fonts use their own cache. | A broken response can stay cached until the next version bump. Any failed same-origin fetch falls back to `index.html`. See F5. |
| Mic permission abuse | `js/speech.js`, `js/ui/mic.js` | Low | Mic starts only from a user tap. Tracks are stopped after each take (`js/speech.js:166`). Blob URLs are revoked when the user leaves the play screen (`js/ui/play.js:30-34`). Recording stops when the page is hidden. | Any XSS would get mic access in an already granted session. That is why the XSS findings matter. |
| Cloud speech | Browser speech service | Accepted | The user can force on-device only (`settings.onDevice = 'on'`). The app explains this in Profile. | The browser vendor's policy applies, not ours. |
| Open redirect | Router | None | Hash routing with a fixed route table (`js/app.js:166-169`). No URL parameters are used for navigation. | None. |
| `eval` and dynamic code | All `js/` | None | No `eval`, no `new Function`, no string `setTimeout`, no `document.write`. | None. |
| Supply chain | Runtime | Very low | No runtime dependencies, no CDN scripts, no build step. Files are served as they are in git. `node_modules` is dev only (Playwright) and not deployed code. | Protect `main` (see below). |
| GitHub Pages | Hosting | Low | HTTPS by default. | No custom headers on Pages (CSP must be a meta tag). Enable "Enforce HTTPS". |

## Hardening checklist for the repo

- Branch protection on `main`: require a PR, require the CI workflow to pass, no force push.
- Enable GitHub private vulnerability reporting and Dependabot alerts.
- Enable secret scanning and push protection.
- Keep CI dependency free (`.github/workflows/ci.yml`).
- Bump the `sw.js` cache version on every release.

## Rules for new code

- Render user or imported data with `textContent`, or with `esc()` inside template strings. No exceptions for "it is only a number": coerce with `Number(x) || 0` first.
- Helpers that accept raw HTML must say so in their name or JSDoc (for example `titleHtml`), and get only static or already escaped strings.
- No `eval`, no `new Function`, no `innerHTML` with data you did not build yourself.
- No new network calls. No analytics. No third-party scripts.
- Never write audio or transcript text to storage.

## Import rules (for `importData`)

An import is untrusted input, often pasted from a message or a file someone else made.

1. Limit the input size (for example 1 MB) before `JSON.parse`.
2. Require `app === 'speaker-trainer'` and a known `schema`.
3. Drop unsafe keys (`__proto__`, `constructor`, `prototype`) at every level.
4. Check every field type, including array elements:
   - numbers: `Number.isFinite`, clamp to a sane range (score 0..100, xp >= 0).
   - strings: type check and max length (name 24, ids 64).
   - `daily.tasks[*]`: `id` string, `kind` in the known set, `itemIds` string array, `xp` and `minutes` finite numbers. If invalid, drop `daily` and let the app regenerate it.
   - `history[*]`: drop entries that fail checks. `metrics` keeps numbers and booleans only.
   - ids must match known ids where possible (items, badges, tracks, units).
5. Cap `history` at 500.
6. Never keep text fields that are not in the schema.
7. On any failure, throw a Hebrew error and leave the current state untouched.

## When a backend exists

See `docs/SCALING.md` for the plan. Security rules for that stage:

- **Auth**: magic link or Google through the provider (Supabase recommended). No passwords stored by us. Short-lived access tokens, refresh handled by the client library.
- **Authorization**: Row Level Security on every table, enabled before the first row is written. Default deny. Policies use `auth.uid()`. Add SQL tests that prove user A cannot read or write user B's rows.
- **Secrets**: the anon key is public by design and is fine in the static site. The service role key and any third-party API keys live only in the provider's secret store or server functions. Never in the repo, never in the browser. CI checks for common secret patterns.
- **Rate limits**: keep the provider's auth rate limits on. Debounce client saves. Per-user caps on state size and attempts per day. Budget alarms for any paid API.
- **Logging without PII**: log request ids, user ids (uuid), status codes and timings. Never log email addresses, names, profile answers, transcripts or audio. Keep logs for 30 days at most.
- **Data rights**: one call to export all of a user's data, one call to delete it all (including the auth user). Document both in a privacy page.
- **Audio**: still never stored. If a cloud scoring API is used, it must have data retention turned off, and only numeric results are saved.
- **CORS and origins**: allow only the production origin and localhost for development.
- **Dependencies**: pin and self-host the client SDK. Review updates.

## Findings

Read-only review of `index.html`, `sw.js`, `js/*.js` and `js/ui/*.js` on 2026-10-21. Line numbers are from that day and may move.

No `eval`, no `new Function`, no open redirects, no external network calls besides Google Fonts. Content, transcripts, toasts and modal labels are escaped correctly.

### F1. Medium: numbers from stored state reach `innerHTML` unescaped

`daily.tasks` comes from `localStorage` (or, soon, an import). `deepMerge` copies arrays as they are, so `t.xp` and `t.minutes` can be strings. The UI sums them with `+` and inserts the result into HTML. A string like `"<img src=x onerror=...>"` in `xp` becomes script.

| File:line | Code |
|---|---|
| `js/ui/home.js:16` | `d.tasks.reduce((a, t) => a + (t.minutes \|\| 2), 0)` |
| `js/ui/home.js:17` | `... .reduce((a, t) => a + (t.xp \|\| 0), 0)` |
| `js/ui/home.js:52` | `<bdi>${minutes}</bdi>` |
| `js/ui/home.js:63` | `+${xpLeft} XP` |
| `js/ui/mission.js:19-20` | same `xpLeft` and `mins` sums |
| `js/ui/mission.js:42` | `<bdi>${mins}</bdi>` |
| `js/ui/mission.js:43` | `+${xpLeft} XP` |
| `js/ui/mission.js:59` | `+${t.xp} XP` and `+${t.xp \|\| 0} XP` |
| `js/ui/play.js:80` | `` `<bdi>+${task.practice ? 5 : task.xp \|\| 0}</bdi>` `` |

Impact: script on the page, with access to the mic in a granted session. Needs a crafted import, another page on the same `github.io` origin, or local access.

Fix (both layers):
- UI (owners: ui-features for `home.js`; qa for `mission.js`, `play.js`): coerce before use, for example `Number(t.xp) || 0` and `Number(t.minutes) || 0`, and wrap interpolated values in `esc()`.
- Engine (owner: engine): in `migrate()` or `normalize()`, validate `daily.tasks` elements (`id` string, `kind` in the known set, `itemIds` string array, `xp` and `minutes` finite numbers). If any task is invalid, reset `daily` so `ensureDaily` regenerates it. Apply the same element checks to `history[*]` and `days`.

### F2. Medium (pending): import validation is not built yet

`js/data.js` does not exist yet, so `importData` could not be reviewed. When it lands it must follow the "Import rules" above, and must not rely on `deepMerge` alone (it does not check array elements). Owner: engine. Add tests in `tests/data.test.mjs` with hostile inputs: wrong types in `daily.tasks`, `__proto__` keys, a 5 MB string, HTML in `profile.name`, unknown top-level keys.

### F3. Low: no Content-Security-Policy

`index.html` has no CSP. GitHub Pages cannot send headers, so use a meta tag. The inline theme script at `index.html:25-32` must move to a file (for example `js/theme.js`, loaded before the CSS) or get a `sha256` hash. Suggested policy (owner: ui-features):

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src blob:; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
```

`'unsafe-inline'` for styles is needed because the UI uses `style="..."` attributes. Test with Playwright after adding it.

### F4. Low: shared `github.io` origin

All Pages sites of the same GitHub user share the `<user>.github.io` origin and its `localStorage`. Another project page of that user can read or change `speakerTrainer.v1`. Fix: treat stored state as untrusted (F1). Optional: serve from a custom domain or subdomain.

### F5. Low: service worker robustness

- `sw.js:81`: any failed same-origin request (also JS and CSS) falls back to `index.html`. A missing module then gets HTML, which fails in a confusing way. Fix: fall back to `index.html` only for `req.mode === 'navigate'`.
- `sw.js:53`: install ignores failed file downloads and still calls `skipWaiting()`. A release can activate with a partial cache, and offline use breaks for some screens. Fix: let install fail if a core file fails, or retry on the next start.
- The phase 3 files (`js/data.js`, `js/ui/path.js`, `js/ui/track.js`) must be added to `APP_FILES` with a version bump. Owner: ui-features.

### F6. Info: helpers that take raw HTML

These insert parameters as HTML. All current callers pass static strings, so there is no bug today. New phase 3 screens (track titles, profile names) could misuse them.

| File:line | Parameter |
|---|---|
| `js/ui/shell.js:28` | `band({ title, sub, right, extra })` |
| `js/ui/dom.js:32` | `ringSvg(..., { label })`, also `color` and `track` go into `style` |
| `js/ui/icons.js:93` | `icon(name, cls)`: `cls` goes into `class` |
| `js/ui/fx.js:64` | `modal(innerHtml)` |
| `js/ui/play.js:86` | `api.band({ extra })` |

Fix: add a JSDoc line "raw HTML, pass trusted strings only", or escape `title` and `sub` inside `band()` and add `titleHtml` for the rare case that needs markup. Owners: ui-features (`shell.js`), qa (`play.js`), orchestrator to assign `dom.js`, `icons.js` and `fx.js` (not in the phase 3 ownership table).
