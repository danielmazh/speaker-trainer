# Scaling plan

How Speaker Trainer can grow from one browser to many users, step by step. Each stage is optional. Do not start a stage before the one before it works well.

Guiding rules for every stage:

- Offline first. The game must always work with no network.
- Speech scoring stays on the device by default.
- No audio is ever stored on a server. Not in Stage 1, 2 or 3.
- Collect the smallest amount of data that makes the feature work.

## Stage 0: today (local only)

- Static PWA on GitHub Pages. No backend, no accounts, no analytics.
- State lives in `localStorage` (`speakerTrainer.v1`). See `docs/DATA_MODEL.md`.
- Backup and move between devices: manual export and import of JSON in Profile.
- `js/data.js` has `createLocalAdapter(storage)` with `{ load(), save(state), clear() }`.
- `summary(state)` builds a small anonymous object for future opt-in telemetry. It is not sent anywhere.

What is ready for later: a stable `profile.id` (uuid), `meta.updatedAt` for conflict checks, and a versioned schema with migration.

## Stage 1: accounts and sync

Goal: the same progress on phone and laptop. Still single-user.

### Backend choice

| | Supabase | Firebase |
|---|---|---|
| Data model | Postgres, SQL, JSON columns | Firestore documents |
| Access rules | Row Level Security (RLS) in SQL | Security Rules language |
| Auth | Magic link, Google, others | Email link, Google, others |
| Open source and self host | Yes | No |
| Export and delete (GDPR) | Plain SQL | Possible, more work across collections |
| Free tier | Good for a small app | Good for a small app |
| Lock-in | Low (it is Postgres) | Higher |

**Recommendation: Supabase.**

- RLS keeps the rule "a user sees only their own rows" inside the database, close to the data, easy to test with SQL.
- Postgres makes stats, coach views and leaderboards (Stage 2) simple queries.
- Data export and delete are one SQL statement each.
- Low lock-in: the data is plain Postgres and can move.
- The public anon key is safe in a static site because RLS does the access control.

### Auth

- Magic link (email) as the default. No passwords to store or leak.
- "Sign in with Google" as a second option.
- Login is optional. A user without an account keeps playing in Stage 0 mode.
- Session tokens are handled by the Supabase client library. Keep the library version pinned and self-hosted (copied into the repo), so there is still no runtime CDN.

### RemoteAdapter

Same shape as the local adapter, plus `sync`:

```js
/**
 * @typedef {Object} RemoteAdapter
 * @property {() => Promise<State|null>} load   Read the server copy for the signed-in user.
 * @property {(state: State) => Promise<void>} save  Write the full state (or a patch) to the server.
 * @property {(local: State) => Promise<State>} sync  Merge local and server, save both, return the merged state.
 */
```

The app always reads and writes the local adapter first. The remote adapter runs in the background when online and signed in.

### Sync and conflict rules

Offline first: local is the source of truth for the UI. Sync on app start, on `visibilitychange` to hidden, after each completed task (debounced), and when the network comes back.

Merge field by field, not "last write wins" for the whole blob:

| Field | Rule |
|---|---|
| `xp`, `missions`, `counters.*` | Take the max. (Both sides only grow.) |
| `streak.best` | Max. |
| `streak.count`, `streak.last` | Take the side with the later `last`. Recompute from `days` if unsure. |
| `days`, `badges` | Union of both sets. |
| `items[id]` | Take the entry with the later `last`. |
| `history` | Union by `(ts, itemId)`, sort by `ts`, cap at 500. |
| `tracks[unitId]` | `bossPassed` = OR, `bestScore` = max. |
| `profile`, `settings` | Later `meta.updatedAt` wins. |
| `daily` | Keep the local one. It is regenerated per day anyway. |

These rules make the merge safe to run many times (idempotent). Add a unit test for each rule.

### Migration from local data (first login)

1. User signs in for the first time.
2. App calls `load()`. If the server has no row, upload the local state as is (`save`).
3. If the server has a row and the local state has progress too, ask once: "Merge this device into your account?" Then run `sync`.
4. Keep the local copy. Never delete local data as part of login.
5. The local `profile.id` becomes a client id. The server uses the auth user id as the owner.

### Minimal SQL schema sketch (Supabase)

```sql
-- One row per user with the full state as JSON. Simple first step.
create table public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  schema     int  not null default 2,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  check (pg_column_size(state) < 512000)          -- 500 KB cap
);

-- Optional: attempts as rows, for stats across devices and Stage 2 views.
create table public.attempts (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  ts         timestamptz not null,
  item_id    text not null,
  cat        text,
  task_kind  text not null,
  score      smallint not null check (score between 0 and 100),
  metrics    jsonb not null default '{}'::jsonb,  -- numbers only, never transcript or audio
  unique (user_id, ts, item_id)
);

alter table public.user_state enable row level security;
alter table public.attempts   enable row level security;

create policy "own state: read"   on public.user_state for select using (auth.uid() = user_id);
create policy "own state: insert" on public.user_state for insert with check (auth.uid() = user_id);
create policy "own state: update" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own state: delete" on public.user_state for delete using (auth.uid() = user_id);

create policy "own attempts: read"   on public.attempts for select using (auth.uid() = user_id);
create policy "own attempts: insert" on public.attempts for insert with check (auth.uid() = user_id);
create policy "own attempts: delete" on public.attempts for delete using (auth.uid() = user_id);
-- No update policy on attempts: they are append only.
```

### API surface (Stage 1)

Use the Supabase REST layer with RLS. No custom server.

| Call | Method | What |
|---|---|---|
| `/rest/v1/user_state?user_id=eq.<me>` | GET | Load my state. |
| `/rest/v1/user_state` | POST (upsert) | Save my state. |
| `/rest/v1/attempts` | POST | Append attempts (batch). |
| `/rest/v1/rpc/export_my_data` | POST | Return all my rows as JSON. |
| `/rest/v1/rpc/delete_my_account` | POST | Delete all my rows and the auth user. Security definer function that only acts on `auth.uid()`. |

### Rate limits

- Client: debounce saves to at most 1 per 10 seconds. Batch attempts.
- Server: Supabase auth limits for magic links (default email rate limits). Keep them on.
- Per user caps: state size 500 KB (check constraint), at most 2,000 attempt rows per day (trigger or RPC check).
- Reject requests without a valid JWT. The anon key alone can read nothing because of RLS.

### Privacy for Stage 1

- Consent screen before the first sign-in: what is synced (progress numbers, name, profile answers), what is not (audio, transcripts), where it is hosted, how to delete.
- Profile gets "Download my data" (server export) and "Delete my account" (server delete plus local reset option).
- Privacy policy page in the repo, linked from Profile.
- No third-party analytics. If telemetry is ever added, it is opt-in and uses `summary(state)` only.

## Stage 2: teams

Goal: a coach or team lead helps a group practice.

Concepts:

- **Org**: a team. Has members with a role: `owner`, `coach`, `member`.
- **Invites**: owner or coach creates an invite link with a random token and an expiry date. One-time use.
- **Coach view**: a coach sees members' progress numbers (XP, streak, minutes, accuracy by skill). Never audio, never transcripts. Members see in the app who can see their numbers.
- **Leaderboards**: opt-in per member, off by default. Show display name and XP for this week only.
- **Admin content**: org owners can add custom drills (same 6 item types) for their team. Content is stored as data and always rendered with escaping (never as HTML).

Schema sketch:

```sql
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) <= 80),
  created_by uuid not null references auth.users(id)
);

create table public.org_members (
  org_id  uuid references public.orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role    text not null check (role in ('owner','coach','member')),
  share_with_coach boolean not null default true,
  on_leaderboard   boolean not null default false,
  primary key (org_id, user_id)
);

create table public.org_invites (
  token_hash text primary key,            -- store a hash, never the raw token
  org_id     uuid not null references public.orgs(id) on delete cascade,
  role       text not null default 'member',
  expires_at timestamptz not null,
  used_by    uuid references auth.users(id)
);

create table public.org_items (
  id      text not null,
  org_id  uuid not null references public.orgs(id) on delete cascade,
  item    jsonb not null,                 -- validated against the item schema on insert
  primary key (org_id, id)
);

-- Helper: is the current user a coach or owner in this org?
create function public.is_org_staff(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members
                 where org_id = o and user_id = auth.uid() and role in ('owner','coach'));
$$;

-- Coaches can read attempts of members who share with them.
create policy "coach reads team attempts" on public.attempts for select using (
  exists (select 1 from org_members m
          where m.user_id = attempts.user_id and m.share_with_coach
            and public.is_org_staff(m.org_id))
);

alter table public.orgs        enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invites enable row level security;
alter table public.org_items   enable row level security;
-- Add select/insert/update policies per table: members read their org, staff manage it.
```

Extra API for Stage 2:

| Call | What |
|---|---|
| `rpc/create_invite(org_id, role)` | Staff only. Returns a raw token once. |
| `rpc/accept_invite(token)` | Signed-in user joins the org. |
| `rpc/team_summary(org_id)` | Staff only. Aggregated numbers per member. |
| `rpc/leaderboard(org_id)` | Members only. Opt-in members, this week. |

Rate limits: invite creation 20 per hour per org. Invite accept 10 per hour per user.

## Stage 3: server-side speech scoring (optional)

Keep on-device first. Today the browser does speech to text, and `js/analyze.js` scores the transcript on the device. This is free, private and works offline. Only add server scoring if users need better pronunciation feedback than the browser gives.

Options:

| Option | What you get | Cost notes | Privacy notes |
|---|---|---|---|
| A. Keep browser recognition plus `analyze.js` | Fillers, grammar, target match | Free | Best. Audio stays in the browser or goes only to the browser's own service. |
| B. On-device model (Whisper in WebAssembly or WebGPU) | Better transcripts, works offline | Free to run. Large download (tens to hundreds of MB). Slow on low-end phones. | Audio never leaves the device. |
| C. Cloud speech to text API | Good transcripts, word timings | Paid per audio minute. Budget with `[X] dollars` per `[N] users` per month before launch. | Audio leaves the device. Must use a provider setting with no data retention. |
| D. Cloud pronunciation assessment API | Phoneme level scores | Paid per audio minute, usually more than C. | Same as C. |

Recommendation: stay on A. Try B as an opt-in "pro accuracy" mode. Use C or D only with explicit consent per session and a strict monthly budget cap.

If a cloud option is ever used:

- Stream audio to a small serverless function, which calls the provider and returns scores only.
- Never write audio to disk or logs. Turn off provider data retention.
- Store only the numeric result in `attempts.metrics`.
- Per user limit, for example 30 audio minutes per day. Global monthly budget alarm.
- Provider API keys live only in the server function's secret store. Never in the static site.

## Summary

| Stage | Adds | Server | Stores audio |
|---|---|---|---|
| 0 | Local game, export and import | None | No |
| 1 | Accounts, sync, export and delete | Supabase with RLS | No |
| 2 | Teams, coach view, opt-in leaderboard, team content | Same, more tables and policies | No |
| 3 | Better speech scoring | Optional serverless function | No |
