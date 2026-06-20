# Workshops Status Board — Design

**Date:** 2026-06-19
**Status:** Approved (pending spec review)

## Purpose
A small dashboard that continuously checks the Experiences→Workshops migration routing state across markets and persists a **timeline** of results, so the team can see — at a glance and over time — which workshop URLs are served by the new Vercel app vs the legacy nginx origin (or are redirecting / 404ing), and **when each cell flipped**.

Replaces the manual `curl` runs + hand-maintained spreadsheet.

## Decisions (locked)
- **Architecture:** Approach A — a single **Cloudflare Worker + Static Assets** (not Pages), routed with **Hono**. The Worker serves the Vite/React build, exposes the API, and runs the scheduled checker. One **D1** binding shared across all three.
- **Database:** **Cloudflare D1 (SQLite)**. D1 is SQLite-based — there is no Postgres mode; Postgres was considered and rejected (would require external Neon/Supabase + Hyperdrive for no benefit at this scale).
- **Scope:** **QA + Prod × canonical-host + .com** = **4 variants** per (market, concern).
- **Persistence:** **status history / timeline** (every check stored; current state + last-flip derived on read).
- **Access:** unlisted public URL (board exposes only finder URLs + backend verdicts; no secrets).
- **Checks:** hourly full coverage via a rotating cron + an on-demand "Refresh now" button.
- **Plan/limits:** **Workers Free tier** → work is **chunked** to respect *both* the 50-subrequest and 10 ms-CPU per-invocation caps; reads served from a denormalized `current` table to stay under D1's 5M-reads/day.
- **Deployment: OUT OF SCOPE.** `wrangler.toml` is included for local dev and is deploy-ready, but no deploy step, CI, or Cloudflare provisioning is wired — the user deploys later.

## The matrix
**Markets (11):** US, UK, CA/EN, CA/FR, AU, NZ, DE, FR, BE/FR, BE/NL, SE.
(NL, CH/DE, CH/FR are out of scope — Core-only, no workshops.)

**Concerns (5):** main, coachlist, coachdet, eventdet, locdet.

**Workshop slug (per market):**
`find-a-workshop` (US, UK, CA/EN, AU, NZ) · `trouvez-un-atelier` (CA/FR) · `workshop-finden` (DE) · `trouver-un-atelier` (FR, BE/FR) · `vind-een-workshop` (BE/NL) · `hitta-workshop` (SE).

**Concern path suffix:**
- main: `` (base)
- coachlist: coach suffix → `/browse-ww-coaches` (US,UK,CA/EN,CA/FR,AU,NZ,BE/NL,SE) · `/coaches` (DE) · `/parcourir-ww-coachs` (FR,BE/FR)
- coachdet: coach suffix + `/Alyce-G/1018090`
- eventdet: `/virtual/25550661`
- locdet: `/2003261/ww-studio--the-st-james-building-chelsea-new-york-new-york`

**Host variants (4):** built from base host + market path.
| Variant | Host pattern |
|---|---|
| qa-com | `https://www.qat2.weightwatchers.com` |
| qa-canonical | per-market QA TLD (below) |
| prod-com | `https://www.weightwatchers.com` |
| prod-canonical | per-market prod TLD (below) |

**Canonical TLD per market** (prod shown; QA = insert `qat2.` after `www.`):
US `weightwatchers.com` · UK `weightwatchers.co.uk` · CA/EN `weightwatchers.ca` · CA/FR `fr.weightwatchers.ca` · AU `weightwatchers.com.au` · NZ `weightwatchers.com` · DE `weightwatchers.de` · FR `weightwatchers.fr` · BE/FR `fr.weightwatchers.be` · BE/NL `weightwatchers.be` · SE `viktvaktarna.se`.
(US & NZ have no separate TLD → canonical == com.)

Total cells: 11 × 5 × 4 = 220, **minus US & NZ duplicate canonical**. US and NZ have no separate TLD (canonical == com), so their `canonical` variants are dropped (keep only `com` for qa + prod). That removes 2 variants × 5 concerns × 2 markets = 20 → **200 cells per cycle**. The matrix generator must skip `host_variant='canonical'` for US and NZ.

## Backend classification (`classify`)
**The checker follows redirects manually** (`fetch(url, {redirect:'manual'})` in a bounded loop, **max 5 hops**), capturing the full chain so we can both count hops (subrequest budget) and classify on the right signal. `classify()` takes **`(finalStatus, finalHeaders, redirectChain[])`** — not just final headers — so it can distinguish "served directly" from "redirected then served."

Order of evaluation:
- Any hop is a **3xx whose `Location` lands on an experience slug** (`find-an-experience` / `trouver-une-experience` / `vind-een-ervaring`) → **redirect-exp** (this is the prod workshop→experience case; classify on the `Location`, not `x-matched-path`).
- Final `200` + (`server: Vercel` or `x-vercel-id` present) → **vercel**. (If Vercel served but `x-matched-path` is an experience route while a workshop slug was requested, also **redirect-exp** — covers silent rewrites.)
- Final `200` + `server: nginx` (positive evidence) → **nginx**.
- Final `404` → **404**.
- Anything else (Fastly synthetic, unknown `server`, etc.) → **other** (record the `server` string).
- Fetch throws / hop cap exceeded → **error** (message stored in `matched_path`).

Store `via` and `x-served-by` alongside `server` for later disambiguation. Pure function, no I/O — unit-tested against captured fixtures (qa-vercel, qa-nginx, trailing-slash 302→200, canonical 301→200, prod redirect-exp, Fastly synthetic, 404, error).

## Free-tier limits & chunking
Two free-tier caps govern slice size, **both** must be respected:
- **50 subrequests / invocation.** Each redirect hop is a subrequest. Size slices by **worst-case hops**: with a 5-hop ceiling, **~10 cells/slice** keeps the worst case ≤50 even if several cells chain. → **~20 slices** for 200 cells.
- **10 ms CPU / invocation** (applies to `scheduled()` too; **excludes** network-wait). The compute cost is classify() + DB writes. Mitigations: **batch all of a slice's inserts into one D1 `batch()`**, and keep classify() allocation-light. Slice size is tuned against *both* caps; measure CPU per slice in `wrangler dev` / observability and shrink if needed.

A **single cron trigger fires every ~3 minutes**, processes the next slice (cursor in `meta`, **cron-owned**), advances `cursor=(cursor+1) mod N` → **full matrix refreshed ~hourly** (~20 slices × 3 min ≈ 60 min). Within a slice, fetches run **concurrently** (`Promise.allSettled`) so a hung host doesn't serialize the slice (concurrency doesn't change the subrequest count, only wall-clock); each fetch has a ~10 s `AbortController` timeout.

On-demand "Refresh now": the frontend calls `POST /api/refresh?slice=N` for each slice (0..N-1) sequentially. **`/api/refresh` is cursor-free** — it runs the requested slice and never advances the cron cursor (avoids skip/repeat races between cron and manual refresh). The append-only schema makes a duplicate check harmless.

## D1 schema (SQLite)
```sql
CREATE TABLE checks (
  id           INTEGER PRIMARY KEY,
  ts           INTEGER NOT NULL,       -- epoch seconds (UTC)
  env          TEXT NOT NULL,          -- 'qa' | 'prod'
  host_variant TEXT NOT NULL,          -- 'canonical' | 'com'
  market       TEXT NOT NULL,
  concern      TEXT NOT NULL,
  url          TEXT NOT NULL,
  http_status  INTEGER,
  backend      TEXT,                   -- vercel|nginx|redirect-exp|404|other|error
  matched_path TEXT,
  redirect_to  TEXT
);
CREATE INDEX idx_cell ON checks (env, host_variant, market, concern, ts);

-- one row per cell: denormalized current state + when it last changed
CREATE TABLE current (
  env TEXT, host_variant TEXT, market TEXT, concern TEXT,
  url TEXT, backend TEXT, http_status INTEGER,
  matched_path TEXT, redirect_to TEXT,
  ts INTEGER,        -- last check
  since_ts INTEGER,  -- when backend last changed to its current value
  PRIMARY KEY (env, host_variant, market, concern)
);
CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);   -- 'cursor' -> slice index (cron-owned)
```
**Why two tables:** `checks` is the append-only history (timeline). `current` is the read model.
- On each check the checker: appends to `checks`, then **upserts** `current` — if `backend` differs from the stored row, set `since_ts = now`; else keep `since_ts`. So "flipped X ago" = `now − since_ts`, a stored column (no gaps-and-islands window query).
- **`GET /api/status` reads only `current`** — a ≤200-row point read, not a full-history scan. This is the key fix for the D1 **5M-reads/day** free cap (the binding read limit, separate from the 100k-writes/day cap).
- Volume: 200 checks/hour ⇒ ~200 history writes + ~200 current upserts/hour × 24 ≈ ~9.6k writes/day — well under 100k/day. Storage trivial. Retention/pruning is then genuinely optional (out of scope v1).

## API (Hono routes on the Worker)
- `GET /api/status` → all rows of `current` (≤200): `{env, host_variant, market, concern, url, backend, http_status, ts, since_ts}`. Single point read — no full-history scan.
- `GET /api/history?env=&host_variant=&market=&concern=&limit=` → time-ordered `checks` rows for one cell.
- `POST /api/refresh?slice=N` → run slice N now (**cursor-free**), append to `checks` + upsert `current`, return cells whose `backend` changed.
- cron `scheduled()` shares the slice-runner with `/api/refresh`; **only the cron path reads/advances `meta.cursor`**.

## Frontend (Vite + React + TS + Tailwind + shadcn/ui)
**UI library: shadcn/ui** (Radix primitives + Tailwind, components copied into `web/src/components/ui` via the shadcn CLI — not an npm dependency). Tailwind is the styling layer; no other component framework. Dark/light via shadcn theme tokens.

Component mapping:
- **Grid** — shadcn `Table`: markets (rows) × concerns (cols). Variant selector (qa-com / qa-canonical / prod-com / prod-canonical) via shadcn `Tabs` (or `ToggleGroup`); optional compact mode showing 4 `Badge` swatches per cell.
- **Cell status** — shadcn `Badge` (color via variant/Tailwind classes): ✅ vercel · 🟧 nginx · ↪️ redirect-exp · ❌ 404 · ⚠️ error; subtext "flipped Xh ago". `Tooltip` on hover shows status + server + URL.
- **Cell detail (on click)** — shadcn `Sheet` (or `Dialog`): timeline list from `/api/history` + last response detail (status, server, x-matched-path, redirect target, full URL).
- **Header** — `Button` "Refresh now" (fires the slice sequence, shows a spinner/`Sonner` toast on completion) + "last refreshed" timestamp; stale-data state via an `Alert`.
- Out-of-scope markets (NL, CH/DE, CH/FR) shown as a small muted "no workshops" note, not tracked.

## Components / boundaries
- `shared/matrix.ts` — pure: market/concern/variant definitions (skipping US/NZ `canonical`) + `buildUrl(cell)` + slice partitioning (≤10 cells/slice). Unit-testable, no I/O.
- `shared/classify.ts` — pure: `(finalStatus, finalHeaders, redirectChain[]) → backend`. Unit-tested against recorded fixtures.
- `worker/checker.ts` — runs a slice: build URLs → **manual-redirect fetch (≤5 hops), concurrently (`Promise.allSettled`)** → classify → **one D1 `batch()`**: append `checks` rows + upsert `current` (set `since_ts` only when `backend` changed). Per-cell try/catch (one failure never aborts the slice).
- `worker/api.ts` — Hono routes + D1 reads (`current` for status, `checks` for history).
- `worker/index.ts` — Worker entry: static assets + Hono + `scheduled()` (cron-owned cursor).
- `web/` — Vite + React + TS app (Tailwind + shadcn/ui, components in `web/src/components/ui`) consuming `/api/*`.

## Error handling
- Per-cell fetch failure / hop-cap exceeded → `backend='error'`, message in `matched_path`; slice continues (`allSettled`).
- Per-fetch ~10 s `AbortController` timeout; concurrent fetches bound slice wall-clock to ~one timeout, not the sum.
- Writes go through one D1 `batch()` per slice (atomic, CPU-cheap); a batch failure is logged and retried next cycle (history is append-only, safe to retry).
- API read failures return a clear JSON error; the grid shows a stale-data banner with last-good `ts` from `current`.

## Testing
- Unit: `classify()` against fixtures — qa-vercel, qa-nginx, trailing-slash 302→200, canonical 301→200, prod redirect-exp, Fastly synthetic, 404, error.
- Unit: `buildUrl()` per market/concern/variant; matrix sums to **200** (US/NZ canonical skipped); every slice ≤10 cells (subrequest budget).
- Unit: `current`-upsert logic — `since_ts` advances only on backend change, holds otherwise.
- Local integration: `wrangler dev` with local D1; a `seed`/dry-run script runs one slice against live hosts and prints rows.

## Out of scope (v1)
- Deployment / CI / Cloudflare provisioning (user handles).
- Auth (unlisted public URL).
- Retention/pruning, alerting, NL/CH tracking, ORM.
