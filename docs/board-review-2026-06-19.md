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

The board's truthfulness depends entirely on probing the **same URL each market actually
serves as its new canonical workshop finder**. Source of truth (in priority order):

1. **Live prod/QA behavior** (what Vercel actually answers — `x-matched-path` is decisive).
2. **SB-rollout slug-translation sheet** — Google Sheet `1_9DJ9e6wmb3MtXgjJ9heY6VRuiHTlW88jhCQMbwFUlI`.
3. NOT a QA tester's assumption in a thread (those often hit transitional/legacy slugs).

### Dual-run model (important context)

During the migration, **two or three slugs coexist per market**:
- **new canonical** → should resolve on Vercel
- **legacy localized slug** → still served by old nginx WSF (expected during dual-run)
- **experience slug** → the find-an-experience page

A market that localizes its slug (e.g. DE) wires the *localized* slug to Vercel and leaves
the English `find-a-workshop` bouncing to old nginx. A market that doesn't (e.g. BE/NL) wires
the *English* `find-a-workshop` to Vercel and leaves the localized slug unmigrated. So
"English vs localized" is per-market, not uniform.

### Audit of `shared/matrix.ts` `MARKETS[]` (verified live)

| Market | Board slug | Canonical (verified) | Verdict |
|---|---|---|---|
| US / UK / CA-EN / AU / NZ | `find-a-workshop` + `/browse-ww-coaches` | same | ✅ correct |
| **DE** | `/de/workshop-finden` + `/coaches` | `/de/workshop-finden` | ✅ **correct** (sheet rows 686-687, 871-872; Pinal confirms `finde-einen-workshop` = OLD, `workshop-finden` = NEW) |
| FR / BE-FR | `…/trouver-un-atelier` + `/parcourir-ww-coachs` | live: `parcourir-ww-coachs` → Vercel coach route ✅ | ✅ correct (sheet's `parcourir-les-coachs-ww` actually misroutes to a *location* on Vercel — board's slug is the working one) |
| SE | `/se/hitta-workshop` | live → Vercel `/se/find-a-workshop` ✅ | ✅ correct |
| **CA/FR** | `/ca/fr/trouvez-un-atelier` + `/browse-ww-coaches` | `/ca/fr/trouver-un-atelier` + `/parcourir-les-coachs-ww` | ❌ **board tracks the OLD slug** — fix below |
| **BE/NL** | `/be/nl/vind-een-workshop` + `/browse-ww-coaches` | undecided — see below | ⚠️ **needs product decision** |

### CA/FR — clear fix

`trouvez-un-atelier` is the **legacy** slug; the new canonical is **`trouver-un-atelier`**
(sheet row 580; Gatti 2026-06-19 "we are serving: `trouver-un-atelier`"; Pinal POP-14875 is the
`trouvez → trouver` redirect). Live now:

```
.com/ca/fr/trouver-un-atelier  → 404 (Fastly not yet whitelisted — the gap the team is closing)
.com/ca/fr/trouvez-un-atelier  → 404 Vercel
.ca (fr) /ca/fr/trouvez-…      → 200 nginx (old WSF)
```

Tracking `trouvez` means the board will **never show the `trouver` whitelist landing**. Change
CA/FR to the canonical so the board flips green when Fastly whitelists `trouver`:

```ts
// shared/matrix.ts
{ market: "CA/FR", base: "/ca/fr/trouver-un-atelier", coach: "/parcourir-les-coachs-ww", tld: "fr.weightwatchers.ca" },
```

### BE/NL — needs Alfonso's call (do NOT change yet)

`vind-een-workshop` is the **legacy** localized slug. Verified:

```
PROD .be/be/nl/vind-een-workshop   → 200 nginx (old finder, live)
PROD .com/be/nl/vind-een-workshop  → 302 → 200 Vercel /be/nl/vind-een-ervaring (experience redirect still active)
QA   .com/be/nl/vind-een-workshop  → 404 Vercel (no such route in the new app)
QA   .com/be/nl/find-a-workshop    → 200 Vercel /be-nl/find-a-workshop  ✅
```

So the **new app answers on `find-a-workshop`**, not the Dutch slug (inverse of DE). The board's
current BE/NL rows (`nginx` on `.be`, `404` on `.com`) are *truthful* — they correctly show the
Dutch slug as unmigrated. Two valid resolutions, pending decision:
- **BE/NL localizes (like DE):** keep `vind-een-workshop`; board correctly flags the gap until it's wired to Vercel.
- **BE/NL stays English:** change base to `/be/nl/find-a-workshop`; board goes green.

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
