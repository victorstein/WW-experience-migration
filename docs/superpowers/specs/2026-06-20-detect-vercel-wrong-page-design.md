# Detect "Vercel 200 but wrong page" (migration-complete ≠ just on Vercel)

**Date:** 2026-06-20
**Status:** Approved

## Problem

"Migration complete" means the workshop page actually renders — not merely that
the URL is served by Vercel. Today any Vercel `200` is verdict `vercel` (green =
done), but that includes cases where Vercel returns 200 for a **different page**:

| Cell | URL | Vercel `x-matched-path` | Today | Reality |
|---|---|---|---|---|
| AU gateway (qa+prod com) | `/au/workshops` | `/au/plans` | 🟢 `vercel` | funnels to pricing |
| BE/NL coachlist (prod com) | `…/vind-een-workshop/browse-ww-coaches` | `/be-nl` | 🟢 `vercel` | falls back to homepage |

The hard oops (HTTP 404) is already caught as `vercel-404`. This is the other
gap: a 200 that isn't the workshop page.

## Why not body content

Reading the page body to detect an "oops" render is unreliable here: the **real**
workshop page's HTML embeds the oops/not-found component markup too (Next.js ships
the error boundary in the shared payload), so a body grep for "OOPS"/"Page Not
Found" false-positives on real pages. Markers are also per-locale. The HTTP-level
signals separate every case cleanly without reading bodies, so we use those.

## Detection

Vercel's `x-matched-path` is **canonicalized**: every real finder page reports
`…/find-a-workshop/…` regardless of the localized public slug (DE `workshop-finden`,
SE `hitta-workshop`, FR `trouver-un-atelier`, …), and the gateway reports
`…/workshops`. So the expected token is uniform per concern:

| concern | expected token in `x-matched-path` |
|---|---|
| `gateway` | `workshops` |
| `main`, `coachlist`, `coachdet`, `eventdet`, `locdet` | `find-a-workshop` |

Rule: for a Vercel `200`, if `x-matched-path` is present but does **not** contain
the expected token → `vercel-wrong`; otherwise → `vercel`. A missing
`x-matched-path` stays `vercel` (no penalizing on absent data — consistent with the
classifier's existing "no guessing" stance). `x-matched-path` survives Fastly
caching, so it's reliably present on real Vercel 200s.

## Architecture (keep `classify` pure + testable)

- **`shared/matrix.ts`** — add `workshopRouteToken(concern): string` (gateway →
  `"workshops"`, else → `"find-a-workshop"`). Route knowledge already lives here.
- **`shared/classify.ts`** — `classify(finalStatus, finalHeaders, chain, expectedToken?)`.
  In the `200 + isVercel` branch (after the experience-redirect check, before the
  plain `vercel` return): if `expectedToken` is given and `matched_path` is present
  and does not include it → `make("vercel-wrong")`. `classify` stays concern-agnostic
  — it only does a substring check when handed a token.
- **`worker/checker.ts`** — pass `workshopRouteToken(cell.concern)` into `classify`.
- **`/api/probe`** — calls `classify` with no token (generic debug tool, no concern),
  so it shows raw `vercel` plus the matched route in its output. Unchanged.

Ordering preserved: experience-redirect → wrong-page → vercel.

## Type + UI

- **`shared/types.ts`** and **`web/src/lib/types.ts`** — add `"vercel-wrong"` to `Backend`.
- **`web/src/lib/verdict.ts`** — the wrong-page state keeps the **`Vercel` pill** (it
  *is* on Vercel) but in **amber** (not green) with caption **"not a workshop page"**:

  | backend | pill label | caption | color |
  |---|---|---|---|
  | `vercel` | `Vercel` | — | green (done) |
  | `vercel-wrong` | `Vercel` | `not a workshop page` | amber |
  | `vercel-404` | `⚠ oops` | `on Vercel` | amber |

  The matched route is already shown in the cell tooltip, so the operator can see
  *where* it landed (e.g. `/au/plans`).

## Tests

- **`test/classify.test.ts`** — 200 + vercel + matched `/au/plans`, token `workshops`
  → `vercel-wrong`; 200 + vercel + matched `/us/find-a-workshop`, token
  `find-a-workshop` → `vercel`; 200 + vercel, no token arg → `vercel` (probe path);
  200 + vercel + matched absent, token given → `vercel`.
- **`test/matrix.test.ts`** — `workshopRouteToken` mapping (gateway vs a finder concern).

## Scope

Five source files + two test files, one PR. No DB migration (`backend` is free-text;
`vercel-wrong` starts appearing after deploy + a refresh-all). Verify live at
`https://ww-migration.victor-stein.dev/` — AU gateway and BE/NL prod coachlist should
flip from green `Vercel` to amber `Vercel` / "not a workshop page".
