# Speaker Trainer - design spec

Source of truth: `/Users/daniel.mazhbits/Documents/speaker-trainer-game.pen` (pen.dev). PNG exports at 2x in `docs/design/`:

| File | Screen |
|---|---|
| `01-onboarding.png` | Onboarding |
| `02-home.png` | Home |
| `03-mission-map.png` | Mission map |
| `04-speak-task.png` | Speak task (hero screen, listening state) |
| `05-result.png` | Result |
| `06a-fix-task.png` | Fix task (say the corrected sentence) |
| `06b-choice-task.png` | Choice task (pick natural English) |
| `07-coach.png` | Coach |
| `08-stats-profile.png` | Stats / Profile |
| `09-level-up-modal.png` | Level up / badge celebration modal |
| `10-component-states.png` | Mic button states, toasts, chips |

Frame size: 390 x 844 (CSS px). All values below are CSS px at 1x.

## 1. Tokens

CONTRACT tokens are kept as is. Additions are marked "new".

```css
:root{
  /* brand */
  --primary:#6C3BF5; --primary-600:#5A2BE0; --primary-50:#F1ECFF; --primary-100:#E4DAFF;
  --primary-300:#8A63FF;                       /* new: light end of button gradients */
  --band-top:#7B4DFF;                          /* new: header band gradient start */
  /* neutrals */
  --bg:#F6F3FF; --surface:#FFFFFF; --ink:#1B1530; --muted:#8A84A3; --line:#ECE7F8;
  /* game colors */
  --gold:#FFB020; --gold-300:#FFD36B;          /* new: XP bar gradient start */
  --flame:#FF7A1A; --flame-50:#FFF1E6;         /* new soft */
  --good:#22C55E; --good-ink:#15803D; --good-50:#E8F9EE;   /* new: ink for text on soft green, soft bg */
  --bad:#F04438;  --bad-50:#FEECEB;            /* new soft */
  --warn:#F5A524; --warn-ink:#B26A00; --warn-50:#FEF4E2;   /* new */
  --scrim:rgba(18,13,36,.65);                  /* new: modal backdrop */
  /* on-purple helpers (white with alpha) */
  --on-band-12:rgba(255,255,255,.12); --on-band-15:rgba(255,255,255,.15);
  --on-band-20:rgba(255,255,255,.20); --on-band-70:rgba(255,255,255,.70); --on-band-80:rgba(255,255,255,.80);
  /* gradients */
  --grad-band:linear-gradient(180deg,#7B4DFF 0%,#5A2BE0 100%);
  --grad-button:linear-gradient(180deg,#8A63FF 0%,#5A2BE0 100%);
  --grad-xp:linear-gradient(90deg,#FFD36B 0%,#FFB020 100%);
  /* radius */
  --r-card:24px; --r-inner:16px; --r-tile:12px; --r-chip-sq:6px; --r-pill:999px;
  /* shadows */
  --sh-card:0 12px 32px rgba(108,59,245,.14);
  --sh-card-sm:0 8px 24px rgba(108,59,245,.10);
  --sh-tile:0 6px 18px rgba(108,59,245,.08);
  --sh-cta:0 10px 24px rgba(108,59,245,.32);
  --sh-nav:0 12px 32px rgba(108,59,245,.25);
  --sh-mic:0 12px 28px rgba(108,59,245,.40);
  --sh-modal:0 24px 60px rgba(18,13,36,.40);
  /* fonts */
  --f-ui:"Rubik",system-ui,sans-serif;
  --f-en:"Plus Jakarta Sans","Rubik",system-ui,sans-serif;
}
```

Dark mode (from CONTRACT, extended): `--bg:#120D24; --surface:#1C1534; --ink:#F2EEFF; --muted:#A49CC4; --line:#2C2350; --primary-50:#2A1F55; --primary-100:#3A2C72; --good-50:#11331F; --bad-50:#3A1614; --warn-50:#3A2A0E; --flame-50:#3A220E; --good-ink:#6FD08C; --warn-ink:#F0B357`. Header band and primary stay the same. Shadows use `rgba(0,0,0,.35)` in dark.

Fonts: Google Fonts `Rubik:wght@400;500;600;700;800` and `Plus Jakarta Sans:wght@500;600;700;800`. Rule: Hebrew and UI copy use `--f-ui`. English practice text, numbers in counters, XP values and the app name use `--f-en`.

## 2. Spacing scale

`4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32`. Use as `--s-1:4px` ... `--s-12:32px`.

- Screen side gutter: 20px (onboarding: 28px).
- Gap between body sections: 14px (Home 18px).
- Card padding: 16px (Mission card 18px, skill card 14px).
- Inside-card gap: 10 to 12px.

## 3. Type scale

| Token | Size / line-height | Weight | Font | Used for |
|---|---|---|---|---|
| display | 34 / 1.15, letter-spacing -0.5px | 800 | en | App name on onboarding |
| score | 40 / 1 | 800 | en | Score number in ring |
| h1 | 24 / 1.25 | 700 | ui | Screen title in band (Coach, Result headline), modal headline 28 |
| h2 | 20-22 / 1.3 | 700 | ui | Greeting, task title in band |
| h3 | 18 / 1.3 | 700 | ui | Section titles |
| en-lg | 17-19 / 1.4 | 500-700 | en | Transcript, practice sentences, icebreaker |
| en-md | 15-16 / 1.45 | 500-600 | en | Prompt, options |
| body | 14-15 / 1.5 | 400-600 | ui | Card titles, list rows, buttons 16-18 |
| small | 13 / 1.45 | 400-500 | ui | Sub copy, hints |
| caption | 11-12 / 1.3 | 500-700 | ui/en | Tags, counters labels, XP chips |

## 4. RTL / LTR rules

- `<html dir="rtl" lang="he">`. Every English practice block gets `dir="ltr" lang="en"` and `text-align:left` (prompt, transcript, options, diff, examples).
- Short English inside Hebrew rows (XP values, "Today's mission", must-say chips) use `<bdi>` or `unicode-bidi:isolate`.
- Use logical properties (`padding-inline-start`, `border-inline-start`, `inset-inline-end`). Progress bars fill from the inline start (right in RTL). The quote bar on English blocks is on the left (`border-left`, because the block is LTR).
- Arrow icons point left in CTAs ("forward" in RTL). Back button is on the right with an `arrow-right` icon.
- Icons: lucide (`flame, star, timer, list-checks, play, mic, mic-off, check, x, lock, crown, wrench, audio-lines, sparkles, house, user, chart-column, settings, shuffle, volume-2, lightbulb, rotate-ccw, party-popper, trending-down, calendar-check, message-circle-off, spell-check, messages-square, gauge, target, circle-dashed, chevron-up, chevron-down, arrow-left, arrow-right`). Inline SVG, 1.75 stroke, `currentColor`.

## 5. Components

### Status bar spacer
Real app: no fake status bar. Use `padding-top: max(12px, env(safe-area-inset-top))` on the header band. The 48px bar in the mocks is device chrome only.

### Header band
- Background `--grad-band`, `border-radius:0 0 32px 32px`, padding `0 20px 20-24px`, column, gap 12-14px, text white.
- Variants:
  - Home: greeting row (avatar 48 circle `--primary-100` with 2px white border, initial 20/700 `--primary`; name 22/700; sub 13 `--on-band-80`) and the streak pill on the opposite side. Below it the Level card.
  - Task (Speak, Fix, Choice): task bar row = close button (36 circle, `--on-band-15`, `x` 18) + 5 step segments (flex 1, gap 5, height 6, radius 3; done `--gold`, current `#fff`, todo `rgba(255,255,255,.25)`) + XP or timer pill. Then kicker (12/600 `--gold`) and task title (19-20/700 white).
  - Screen title (Coach, Stats, Map): title 22-24/700 + sub 13 `--on-band-80`.
- Pill on band: padding `6-8px 10-14px`, radius pill, `--on-band-15`, value 13-16/700 white + 15-18 icon.

### Level card (in Home band)
Row, padding 14, gap 14, radius 20, bg `--on-band-12`, 1px border `--on-band-20`. Level ring 56 (see Score ring, stroke ratio 0.16, track `--on-band-20`, arc `--gold`, label 20/800 white). Text block: row with level title 15/600 white and `320 / 500 XP` 12/700 en `--gold`; XP track height 8, radius 4, `--on-band-20`, fill `--grad-xp`; hint 11 `rgba(255,255,255,.7)`.

### Card
`background:var(--surface); border-radius:24px; padding:16px; box-shadow:var(--sh-card-sm)`. Hero card uses `--sh-card`. Card head row: title 15/700 on the inline start, meta (pill or count) on the inline end.

### Chip
- Category chip: padding `9px 16px`, radius pill, 14/500. Idle: `--surface`, 1px `--line`, text `--muted`. Active: `--primary`, text white 600. Row scrolls horizontally (`overflow-x:auto; scrollbar-width:none`), gap 8, first chip at inline start.
- Must-say chip (on band): padding `5px 10px`, gap 4, radius pill, 12/600 en. Waiting: `rgba(255,255,255,.10)` + 1px `rgba(255,255,255,.4)` + `circle-dashed` 14. Hit: `--good` bg, `check` icon, short scale pop (see motion).
- Must-say chip on light surface: waiting `--primary-50` text `--primary` 1px `--primary-100`; hit `--good` white.
- Tag: padding `4px 10px`, radius pill, 12/600. Color pairs: primary (`--primary-50`/`--primary`), bad (`--bad-50`/`--bad`), good (`--good-50`/`--good-ink`), warn (`--warn-50`/`--warn-ink`).
- Transcript highlight: inline span padding `1px 6px`, radius 6. Filler: `--bad-50` bg, `--bad` text 600, underline. Must-hit: `--good-50` bg, `--good-ink` text 600. Removed word (diff): `--bad-50`, `--bad`, line-through. Added word: `--good-50`, `--good-ink`.

### Bottom nav
- Fixed, `inset-inline:16px; bottom: calc(12px + env(safe-area-inset-bottom))`. Total block height 100 (raised button sticks out 28 above the bar).
- Bar: height 64, radius 32, bg `--primary`, `--sh-nav`, padding `0 18px`, 5 slots `space-between`, slot 52x52.
- Order (RTL, right to left): Home `house`, Coach `sparkles`, center Play, Stats `chart-column`, Profile `user`. Icons 22, `rgba(255,255,255,.7)`; active icon white + 5px white dot 3px below.
- Center button: 72 circle, white, `0 8px 20px rgba(108,59,245,.36)`, centered horizontally, top at bar top -28px. Inner 56 circle `--grad-button` with `play` 24 white. It starts today's mission.
- Body content needs `padding-bottom:120px` so the last card can scroll above the nav.

### Mic button (states in `10-component-states.png`)
Box 140-176. Layers, centered: halo circle, level ring, core.
- Idle: halo 120-140 `rgba(108,59,245,.08)`; core 96 circle `--grad-button`, `--sh-mic`, `mic` 36-38 white. Hint under it: "הקש ודבר" 13 `--muted`.
- Listening: outer pulse 176 `rgba(108,59,245,.08)` + inner pulse 144 `rgba(108,59,245,.14)` (animate scale 1 to 1.08, 1.2s, alternate); level ring 128, stroke 6 (`conic-gradient` or SVG circle), track `--primary-100`, arc `--primary` with length = mic level 0..1, starting at 12 o'clock and going clockwise; core 104 with white rounded square 30x30 radius 8 (stop). Below: 14 waveform bars, 4px wide, gap 4, radius 2, heights driven by level (8-26px), color `--primary`. Hint "מקשיב... הקש כדי לסיים".
- Processing: core `--primary-600` with `loader` icon spinning, ring arc 90deg spinning, no halo.
- Disabled / no mic: core `--line`, `mic-off` `--muted`, no shadow, then show the fallback (record only + self rating, or type what you said).
- Tap target is the core; `aria-pressed` toggles; `aria-label` "התחל להקליט" / "עצור".

### Live counters
Row of 3 tiles, gap 10. Tile: column, center, padding `12px 10px`, radius 18, `--surface`. Value row: 24 circle icon dot (soft color bg, 13 icon) + value 22/800 en. Label 12 `--muted`.
- wpm: `--good` when 110-160, `--warn` outside.
- fillers/min: `--good` under 1, `--warn` 1-3, `--bad` over 3.
- must-say: `--primary`, format `2/3`.

### Score ring
SVG circle, size 124 (Result), 56 (Level card), 64 (Profile). Stroke width = 16% of size. Track `rgba(255,255,255,.2)` on band or `--line` on light. Arc `--gold` on band, `--primary` on light; start at 12 o'clock, clockwise, `stroke-linecap:butt`. Center: number 40/800 en + "/ 100" 12 `--on-band-70`. Animate the arc from 0 to value in 900ms ease-out, count the number up.

### Toast
Row, padding `12px 16px`, gap 10, radius 16, `--surface`, 2px border in the soft color, `0 8px 24px rgba(27,21,48,.08)`. Icon dot 28 (soft bg, 16 icon), text 14/600 in the ink color. Variants: success (`--good-50`, `--good-ink`, `circle-check`), warn (`--warn-50`, `--warn-ink`, `info`), error (`--bad-50`, `--bad`, `circle-alert`). Position: fixed, top `calc(12px + safe-area)`, centered, auto hide 2.5s. `role="status"`.
- Answer feedback sheet (Choice): full-width card at bottom of body, radius 24, padding 16, 4px top border `--good` (or `--bad`), icon 40 circle, title 16/700, rule line 14/600 en, full-width button 50 tall in the same color.

### Buttons
- Primary CTA: height 54-56, radius pill, `--primary`, white 16-17/600, `--sh-cta`, optional `arrow-left` 18-20 before the label (visually left of it in RTL). Pressed: `--primary-600`, translateY(1px).
- Secondary: height 54, radius pill, `--surface`, 2px `--primary-100`, text `--primary`.
- Round icon button on light: 36 circle, `--surface`, 1px `--line`, 16 icon `--primary`.

### Modal
- Scrim: fixed full screen `--scrim` + `backdrop-filter:blur(6px)`.
- Sheet: width `calc(100% - 48px)` max 342, centered (top about 150px on 844), radius 32, padding 24, column center, gap 12, `--sh-modal`.
- Content: art stage 190 tall (radial glow `#FFE7B0` to transparent, 180 circle; trophy SVG 170; 8 confetti rectangles 6-10 x 10-16, radius 2, rotated, colors gold/primary/flame/good/primary-100), level pill ("LEVEL 5", 12/800 en, letter-spacing 1.5, `--primary-50`/`--primary`), headline 28/800, body 14 `--muted` centered, two reward tiles (row gap 8, each radius 16, padding 10, soft bg + 14/700 + 16 icon), primary button full width.
- Motion: sheet scale 0.9 to 1 + fade 220ms, confetti falls 1.2s. Focus trap, Escape closes, focus returns to the trigger.

### Motion
- Card press: scale .98, 120ms.
- Must-say hit: scale 1 to 1.12 to 1, 240ms, and color change.
- XP gain: "+15 XP" floats up 24px and fades, 700ms.
- Respect `prefers-reduced-motion`: no pulse, no confetti, instant ring.

## 6. Screens

All screens: `min-height:100dvh; background:var(--bg)`; header band first; body is a column with 20px inline padding.

### 01 Onboarding
- Background `linear-gradient(180deg,#F1ECFF 0%,#FFFFFF 70%)`, no band.
- Stage (flex 1): white circle 300 with 2px `--primary-100` border, centered, top 40; speaker illustration (SVG, 320 box) on top; soft ellipse shadow 220x26 `rgba(108,59,245,.12)` blur 12 under it. Two floating pills (white, radius pill, `--sh-card-sm`): "+20 XP" with star at top left (x 24, y 70), "7" with flame at bottom right (x 262, y 290). Gentle float animation 3s.
- Copy block, padding `0 28px`, aligned to inline start (right): "Speaker Trainer" display; subtitle 16/1.5 `--muted`: "רק 12 דקות ביום. מדברים אנגלית טכנית בביטחון, בלי מילות מילוי."
- Footer row, padding `36px 28px 40px`, space-between: dots on the inline start (8x8, 8x8 `--primary-100`, active 24x8 `--primary`, radius 4, gap 6); Start button on the inline end (padding `16px 32px`, label "מתחילים" 18/600 + `arrow-left`).

### 02 Home
- Band: greeting row ("היי Daniel", sub "מוכן לאימון של היום?"), streak pill "7" + flame, Level card ("רמה 4 - מציג בטוח", "320 / 500 XP", hint "עוד 180 XP לרמה 5").
- Body padding `20px 20px 120px`, gap 18:
  1. Mission card (hero): top row = text block on inline start (tag "המשימה של היום", title "Today's mission" 20/800 en, meta row `list-checks` "5 שלבים" + `timer` "12 דק'" 13 `--muted`), round Go button 56 `--primary` with play on inline end. 5 step segments (height 8, radius 4, gap 6; done `--primary`, current `--primary-100`, todo `--line`). Footer row: "2 מתוך 5 הושלמו" 12 `--muted` and "+60 XP" 12/700 `--gold`.
  2. Category chips: דקדוק (active), מילות מילוי, ניסוח, דיבור, תסריטים, שאלות, הגייה, הצגה.
  3. Section head: "הכישורים שלך" 18/700 + "הכל" 13/500 `--primary`.
  4. Skill grid: 2 columns, gap 12. Skill card: padding 14, radius 20, `--sh-tile`, column aligned to inline start. Top row: icon tile 40 radius 12 (soft bg + 20 icon) and count "9/20" 12/600 en `--muted`. Name 15/600. Progress track 6 radius 3 `--line`, fill in the category color. Colors: Fillers `--flame`, Grammar `--primary`, Pronunciation `--good`, Q&A `--warn`.
- Bottom nav with Home active.

### 03 Mission map
- Band: back button (40 circle) + title "המשימה של היום", sub "יום שלישי - 5 שלבים, 12 דק'", XP pill "+60 XP" on the far side; progress row: track 8 + "2/5" 13/700 en.
- Path area: 5 nodes in a zigzag column, 104px apart vertically, node center x alternates (about 282, 122, 262, 112, 252 from the left edge). Between nodes, 8 dots (6px) along the line: `--primary` for done segments, `--primary-100` ahead.
- Node: circle 64. Done: `--good` + `check` 26 white + green glow shadow. Current: `--primary` + type icon, wrapped in an 80 halo `--primary-100`. Locked: `--surface`, 2px `--line`, `lock` `--muted`, no shadow.
- Label beside each node, on the side with more space, text aligned to the inline start: name 16/700 (locked `--muted`), sub 12 `--muted`, XP 11/600 (`--good` "הושלם +10 XP" when done, else `--gold`). Current node label gets a "עכשיו" pill (11/600 white on `--primary`).
- Steps: חימום (הגייה - חזור אחרי המילה, `audio-lines`), תיקון (`wrench`), בחירה (`list-checks`), דיבור חופשי (`mic`), בוס (`crown`, +20 XP).
- CTA at the bottom: "המשך לשלב 3", full width, 56 tall.

### 04 Speak task (hero)
- Band (task variant): segments with step 4 current, timer pill "0:42" (`timer` icon), kicker "דיבור חופשי - 60 שניות - שלב 4 מתוך 5", title "ספר מה הצוות שלך השיק החודש", English prompt 15/1.45 `rgba(255,255,255,.85)` LTR, must-say chip row (aligned to inline start, gap 6).
- Body padding `18px 20px 28px`, gap 14:
  1. Transcript card: head row with "מה שאמרת" 13/600 `--muted` and "LIVE" badge (8px `--bad` dot + 11/800 en letter-spacing 1 `--bad`, dot blinks). Text block LTR 17/500 en, line gap 10, with filler and must-hit spans; caret 2x20 `--primary` blinking at the end. Max height 4 lines, auto scroll to bottom.
  2. Counters row (wpm, fillers/min, must-say).
  3. Mic area (flex 1, centered): listening mic button 176, waveform, hint.

### 05 Result
- Band: row centered, gap 18: score ring 124 (inline end, left in RTL) and text block (inline start): "כל הכבוד!" 24/700, sub "פחות מילוי מאתמול" 13, pills "+15 XP" (star) and streak "8" (flame).
- Body padding `16px 20px 24px`, gap 12:
  1. Filler card: head "מילות מילוי" + "3.1 / min" 13/700 en `--bad`. Rows (LTR data): word 13/600 en (64 wide), track 8 radius 4 `--line` with fill (count 2+ `--bad`, 1 `--warn`), "x2" 12/700 `--muted`.
  2. Diff card: title "המשפט המתוקן", LTR sentence 16 en with removed and added spans.
  3. Playback card: row = play button 44 `--primary`, text ("השמע את ההקלטה" 14/600, "0:58" 12 en `--muted`), waveform (27 bars 3px, gap 3, played part `--primary`, rest `--primary-100`). Privacy note under it: padding `8px 10px`, radius 12, `--primary-50`, `lock` 13 + "ההקלטה נשמרת רק בזיכרון ונמחקת כשיוצאים מהמסך." 11 `--primary-600`. Audio uses an in-memory blob URL only.
  4. Actions row: secondary "שוב" (120 wide, `rotate-ccw`) + primary "המשך לשלב הבא" (flex 1).

### 06a Fix task
- Band (task variant, step 2), XP pill "+10", kicker "תיקון - שלב 2 מתוך 5", title "אמור את המשפט הנכון בקול".
- Body gap 14: Wrong card (tag "לא טבעי" bad, LTR quote 18/500 `--muted` with 3px `--bad` left border and 12px left padding, hint box `--primary-50` radius 14 padding `10px 12px` with `lightbulb` and Hebrew note 13 `--primary-600`); You-said card (head "מה שאמרת" + match tag "100%" good, LTR sentence 17 with matched new words in good spans); mic area with idle mic 120 and hint; primary CTA "המשך" (enabled after a match of 80% or more).

### 06b Choice task
- Band (task variant, step 3), kicker "בחירה - שלב 3 מתוך 5", title "איזה משפט נשמע טבעי?".
- Source card: label "Alex אמר בפגישה:" 13/600 `--muted`, LTR italic quote 18 with bad left border.
- Options (LTR, gap 14): row padding 14, radius 18, gap 12; key square 32 radius 10 (`--primary-50`, letter 14/700 en `--primary`); text 16/500 en. States: idle `--surface` + 1px `--line`; correct `--good-50` + 2px `--good`, key `--good` with `check`, text `--good-ink` 600; wrong `--bad-50` + 2px `--bad`, key `--bad` with `x`, text `--bad`; others after answer opacity .6.
- Feedback sheet pinned to the bottom of the body: "נכון, כל הכבוד!" + rule "explain something to someone" + green "המשך" button.

### 07 Coach
- Band: "המאמן", sub "הכנה מהירה לפני הרצאה", label "מי בקהל?" 12/600, audience segmented control (padding 4, radius pill, bg `--on-band-15`; 4 equal segments padding 9; active white with `--primary` 700 text; idle `rgba(255,255,255,.9)` 500). Order right to left: מפתחים, מנהלים, מוצר, לקוחות.
- Body gap 14:
  1. Icebreaker card: bg `linear-gradient(135deg,#FFFFFF,#F1ECFF)`; head row = tag "פתיח" (warn, `smile`) + 2 round icon buttons (`volume-2` to hear it with the browser voice, `shuffle` for another). Line 19/700 en LTR. "מתי: ..." 13 `--muted`.
  2. "טיפים להצגה" 18/700.
  3. Accordion: one card, radius 24, rows separated by 1px `--line`. Row padding `14px 16px`: icon tile 34 radius 10 `--primary-50`, title 15/600, chevron 18 `--muted` at the inline end. Open row bg `#FBF9FF`, bullets 13 `--muted` with 5px `--primary` dots indented 46px, example box (`--primary-50`, radius 12, 14/600 en `--primary-600`). Use `<details>/<summary>`.
- Bottom nav with Coach active.

### 08 Stats / Profile
- Band: profile row = level ring 64 around a 50 avatar, name "Daniel" 22/800 en, level "רמה 4 - מציג בטוח" 13, settings button 40. Stat tiles row (3, gap 8, padding `10px 8px`, radius 16, `--on-band-12`): "74" ציון ממוצע (`target`), "12" שיא רצף (`flame`), "1,320" XP (`star`). Value 20/800 en.
- Body gap 12:
  1. Streak calendar card: head "אוקטובר" + streak pill "8 ימים" (`--flame-50`/`--flame`). Weekday row א..ש (11 `--muted`, first day at inline start). Day cells 30x30 radius 10, `space-between`: done `--primary` + white number 11/600 en; missed `--bg` + `--muted`; today `--flame` with `flame` icon and 2px `#FFD3B0` ring.
  2. Trend card: "מילוי לדקה - 10 אימונים" + delta tag "-42%" good with `trending-down`. 10 bars, gap 8, height 70 area, bar height proportional (value x 12), radius `6 6 3 3`, `--primary-100`, latest bar `--primary`. Oldest at inline start.
  3. Badges card: "תגים" + "5/12". 4 per row, 72 wide: medal 52 circle (soft bg + 2px color border + 22 icon), label 11/500. Locked: `--bg`, `--line` border, `lock` icon, opacity .45.
- Bottom nav with Stats active (Profile tab opens the same screen scrolled to the top).

### 09 Level up / badge modal
- Over Home: scrim, sheet with trophy art, "LEVEL 5", "עלית רמה!", "עכשיו אתה מציג מנוסה. ההרצאה הבאה כבר פחות מפחידה.", reward tiles "תג חדש" (primary) and "+50 XP" (warn), button "מעולה, ממשיכים". Badge-only variant: same sheet, art = the badge medal at 120, headline "תג חדש!", one reward tile.

## 7. Illustrations
Two SVG illustrations exist in the .pen as components: "Illustration Speaker" (onboarding, 320 box) and "Illustration Trophy" (modal, 220 box). The ui owner should rebuild them as inline SVG with the same palette (no external images): soft gradients, violet `#6C3BF5`, lavender `#E4DAFF`/`#F1ECFF`, ink `#1B1530`, gold `#FFB020`, orange accent `#FF7A1A`, white highlights.

## 8. Accessibility
- Contrast: white on `--primary` 5.6:1, `--muted` on white 3.6:1 (use only for 13px+ secondary copy, never for key actions), `--good-ink` on `--good-50` 4.9:1.
- Touch targets 44px minimum (chips 36 tall are fine inside a scroll row with 8 gap).
- Live transcript region `aria-live="polite"`; counters `aria-live="off"` (update visually only); filler spans have `title="filler"`.
