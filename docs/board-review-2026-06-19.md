# Workshops Status Board — Live Review & Fixes (2026-06-19)

Review of the deployed board (`workshops-status-board.stein-hakase-vs.workers.dev`) against
live QA/prod curls, the Slack threads, and the authoritative slug-translation sheet.
Engine is sound; the remaining work is **URL/slug accuracy** plus one minor API bug.

---

## 1. Status of earlier fixes

| Issue | Status |
|---|---|
| `nginx` never classified (all legacy 200s fell into `other`) | ✅ Fixed & verified — 50 `nginx`, 0 `other`; `vercel`/`redirect-exp` unchanged (80/64). |
| AU `gateway` returned `error`/`null` (6-hop chain > 5-hop cap) | ✅ Fixed — now `redirect → /au/plans` (canonical) / `vercel` 200 (com). New generic `redirect` backend added. |
| `/api/history` 500s on missing query params | ❌ **Still open.** Bare or partial calls (`?env=qa`) return 500. UI path (all 4 params) returns 200, so the grid works. |

**Fix for the history 500** — in `worker/api.ts` `app.get("/api/history")`, short-circuit before
calling `getHistory` when any of `env` / `host_variant` / `market` / `concern` is absent:

```ts
const env = c.req.query("env"), host_variant = c.req.query("host_variant");
const market = c.req.query("market"), concern = c.req.query("concern");
if (!env || !host_variant || !market || !concern) {
  return c.json({ error: "env, host_variant, market, concern are required" }, 400);
}
```

---

## 2. Slug accuracy — the main finding

> **Source of truth corrected.** The authority is the **app's own routing tables** in
> `ww-marketing-website` — `apps/client/src/utils/routing/findAWorkshopRewrites.ts`
> (`FIND_A_WORKSHOP_LOCALIZED_ROUTES`) and `localizedRoutes.ts` — cross-checked against live
> `x-matched-path`. NOT the slug-translation sheet (stale in places) and NOT a QA tester's
> thread assumption.

### How the migration actually works (env-flag flip, not a slug swap)

`find-a-workshop` and `find-an-experience` **reuse the SAME localized slugs**. One env var,
`ENABLE_FIND_A_WORKSHOP_ROUTING` (`localizedRoutingConfig.ts`), decides which internal route the
localized slug maps to. They're mutually exclusive by construction.

- **Flag OFF (prod today):** localized slug → `find-an-experience`
- **Flag ON (QA today):** localized slug → `find-a-workshop`

The canonical user-facing slug is identical in both worlds; the migration just flips the target.
Verified live via `x-matched-path`:

```
QA   /de/workshop-finden        → matched /de/find-a-workshop      (flag ON  → workshop)
PROD /de/workshop-finden        → matched /de/find-an-experience   (flag OFF → experience)
QA   /be/nl/vind-een-ervaring   → matched /be-nl/find-a-workshop   ✅
PROD /be/nl/vind-een-ervaring   → matched /be-nl/find-an-experience
```

**The board's classifier already handles this correctly:** prod localized slugs classify as
`redirect-exp` (matched_path contains an experience slug); QA ones classify as `vercel`. So the
QA-vs-prod columns ARE the migration signal. DE/FR/SE are working right in both columns. The
engine and approach are sound — the only defect is *which slug string* two markets use.

### Per-market slugs

The board tracks the **end-state canonical workshop slug** per market (so a market reads as a
gap now and flips green when its app rewrite + Fastly whitelist land). For DE/FR/BE-FR/SE the
end-state slug already equals what `findAWorkshopRewrites.ts` serves during the overlap. For
**CA/FR and BE/NL the end-state slug differs from the current overlap table** (which still reuses
the experience slug) — decided by Alfonso 2026-06-19:

| Locale(s) | base | coaches | virtual | live today |
|---|---|---|---|---|
| en (US/UK/CA-EN/AU/NZ) | `find-a-workshop` | `…/browse-ww-coaches` | `…/virtual` | served |
| de (DE) | `workshop-finden` | `…/coaches` | `…/virtuell` | served |
| fr, be-fr | `trouver-un-atelier` | `…/parcourir-ww-coachs` | `…/virtuel` | served |
| se | `hitta-workshop` | `…/browse-ww-coaches` | `…/virtuell` | served |
| **ca-fr** | **`trouver-un-atelier`** | `…/parcourir-ww-coachs` | `…/virtuel` | **404 (not wired yet)** |
| **be-nl** | **`vind-een-workshop`** | `…/bekijk-ww-coaches` | `…/online` | **404 (not wired yet)** |

> The app's overlap table (`findAWorkshopRewrites.ts`) currently maps `ca-fr → trouver-une-experience`
> and `be-nl → vind-een-ervaring` (experience slugs reused during dual-run). The canonical workshop
> slugs above (`trouver-un-atelier`, `vind-een-workshop`) require the app's rewrite table to be
> updated AND Fastly to whitelist them. Until then the board correctly shows these two as gaps.

### Audit of `shared/matrix.ts` `MARKETS[]` (verified live)

| Market | Board slug | Correct (code + live) | Verdict |
|---|---|---|---|
| US / UK / CA-EN / AU / NZ | `find-a-workshop` + `/browse-ww-coaches` | same | ✅ correct |
| DE | `/de/workshop-finden` + `/coaches` | same | ✅ correct |
| FR / BE-FR | `…/trouver-un-atelier` + `/parcourir-ww-coachs` | same | ✅ correct |
| SE | `/se/hitta-workshop` | same | ✅ correct |
| **CA/FR** | `/ca/fr/trouvez-un-atelier` + `/browse-ww-coaches` | `/ca/fr/trouver-un-atelier` + `/parcourir-ww-coachs` | ❌ wrong slug — fix below |
| **BE/NL** | `/be/nl/vind-een-workshop` + `/browse-ww-coaches` (coach slug wrong) | `/be/nl/vind-een-workshop` + `/bekijk-ww-coaches` | ⚠️ base OK; coach slug wrong |

### CA/FR — fix

Board uses `trouvez-un-atelier` (legacy). Canonical end-state slug is **`trouver-un-atelier`**
(Alfonso's call; matches the slug sheet and Gatti "we serve trouver"). Currently 404s in QA (the
app overlap table still serves `trouver-une-experience`, and Fastly hasn't whitelisted `trouver`)
— so this will read as a gap until that work lands, which is correct.

```ts
// shared/matrix.ts
{ market: "CA/FR", base: "/ca/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "fr.weightwatchers.ca" },
```

### BE/NL — fix

Base slug `vind-een-workshop` is correct (Alfonso's call). The **coach suffix is wrong**: board
uses `/browse-ww-coaches`; the Dutch coach slug is **`/bekijk-ww-coaches`** (per Pinal's redirect
list and the app table). `vind-een-workshop` currently 404s in QA (only a legacy redirect
destination today, not yet in `findAWorkshopRewrites.ts`) — reads as a gap until wired, which is
correct.

```ts
// shared/matrix.ts
{ market: "BE/NL", base: "/be/nl/vind-een-workshop", coach: "/bekijk-ww-coaches", tld: "weightwatchers.be" },
```

### Localized DETAIL slugs (coachdet / eventdet) — also wrong for non-EN markets

`shared/matrix.ts` builds detail URLs from English constants (`/virtual/<id>`,
`/browse-ww-coaches/<id>`) for every market, but the segments are localized (`virtuell`/`virtuel`/
`online`; `/coaches`, `/parcourir-ww-coachs`, `/bekijk-ww-coaches`). Result: non-EN detail rows can
match the wrong Vercel route and false-green (e.g. BE/NL coachlist currently matches `/be-nl`, the
homepage). Build the coach/virtual segments per-market from `findAWorkshopRewrites.ts` rather than
hardcoding English. (Location-detail has no localized segment — `/<id>/<slug>` is fine.)

---

## 3. Methodology notes (not bugs, but limits to document in the UI/README)

- **Detail concerns reuse a US entity ID for every market** (`coach Alyce-G/1018090`,
  `virtual/25550661`, `location 2003261…new-york`). For non-US markets these IDs don't exist, so
  `coachdet`/`eventdet`/`locdet` are effectively **"is the route served by Vercel"** checks, not
  real per-market pages. Vercel returns 200 for the dynamic route regardless of whether the
  entity exists. Acceptable for backend tracking, but in fallback cases the bogus ID can change
  the redirect (e.g. DE English coachdet bounces to old nginx). Real per-market IDs would be
  more faithful. At minimum, note this on the detail rows.
- **Single slug per market hides the dual-run redirect web.** Optional enhancement: track both
  the canonical and the legacy localized slug as separate rows, since the redirect between them
  is the actual migration risk surface (it's where the team's reported bugs live).
- **Gateway concern** (`/<locale>/workshops`) correctly catches the US & DE `404` hub gaps the
  team reported — keep as-is.

---

## 4. Recommended order of work

1. `worker/api.ts` — history 400 guard (5-min fix).
2. `shared/matrix.ts` — CA/FR → `trouver-un-atelier` / `parcourir-les-coachs-ww`; update `test/matrix.test.ts` expected URLs.
3. BE/NL — await Alfonso's slug decision, then update `matrix.ts` + tests.
4. (Optional) US-entity-ID caveat note on detail rows; dual-slug tracking.

DE / FR / BE-FR / SE / US / UK / CA-EN / AU / NZ are verified correct — **do not touch**.
