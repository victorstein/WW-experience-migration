# Split 404 into Vercel-oops vs Drupal-legacy

**Date:** 2026-06-20
**Status:** Approved

## Problem

The board renders every 404 identically, but two structurally different 404s are
collapsed into one verdict:

1. **Vercel "oops" 404** — the route *is* served by the migrated Vercel app, but
   that specific path returns Vercel's not-found ("oops") page. The page has been
   migrated; the route just isn't wired up (or is gated, e.g. not whitelisted yet).
2. **Drupal/legacy 404** — the request never reached Vercel. The legacy Drupal
   origin answered with a 404, meaning the path **has not been forwarded to the
   Vercel app yet**.

For a migration tracker these mean opposite things ("on Vercel but broken" vs
"not migrated at all"), so they must be visually distinct.

## Detection

Confirmed against all 58 live 404 cells (`/api/status`): the split is unambiguous.

| Signal | Vercel oops 404 | Drupal/legacy 404 |
|---|---|---|
| `x-vercel-id` | **present** (`fra1::84ngg-…`) | absent |
| `x-matched-path` | `/404` | absent |
| `x-served-by` | one Fastly hop | two Fastly hops (Drupal shielding) |
| `via` | `1.1 varnish` | `1.1 varnish` (same — can't split on this) |

`via: varnish` appears on both because Fastly fronts everything, so it is **not**
a discriminator. `x-vercel-id` is, in 100% of current data.

Rule (in `shared/classify.ts`, the `finalStatus === 404` branch), reusing the
existing `isVercel` signal (`!!vercel_id || /vercel/i.test(server)`):

```ts
if (finalStatus === 404) return make(isVercel ? "vercel-404" : "404");
```

## Backend type

`shared/types.ts` — keep `"404"` to mean the **legacy/Drupal** 404 and add a new
`"vercel-404"`:

```ts
export type Backend =
  | "vercel" | "nginx" | "redirect-exp" | "redirect"
  | "vercel-404" | "404" | "other" | "error";
```

**Why keep `"404"` rather than rename both values:** existing DB rows already
store `backend = "404"`, and the large majority of them genuinely are Drupal
404s, so they stay semantically correct with zero stale rendering after deploy.
Only the handful currently mis-bucketed as `"404"` that are actually Vercel
(e.g. CA/FR `coachlist` qa, all BE/NL qa, NZ/FR/BE-FR gateways) flip to
`"vercel-404"` on the first sweep after deploy. The transition is self-healing
on the next refresh-all; no DB migration is required (`backend` is free-text).

## UI

`web/src/lib/verdict.ts` — both 404s are **amber** (amber reads as "still on the
legacy stack / not done"); the caption distinguishes them.

| backend | pill label | caption (`note`) |
|---|---|---|
| `vercel-404` | `⚠ oops` | `on Vercel` |
| `404` | `404` | `legacy / Drupal` |

`404` moves from rose → amber. The caption rides the existing `note` field, so it
renders automatically in the desktop cell (absolute, below the pill) and the
mobile stacked rows (`showNote`) with no component changes. nginx remains amber
with its own caption, so the three legacy-stack states (`nginx`, `404`,
`vercel-404`) share the amber family and are told apart by caption.

## Scope

- `shared/types.ts` — add `"vercel-404"` to `Backend`.
- `shared/classify.ts` — split the 404 branch on `isVercel`.
- `web/src/lib/verdict.ts` — add `vercel-404` case; recolor `404` to amber + add captions.
- `test/classify.test.ts` (or wherever classify is tested) — add: 404 + `x-vercel-id` → `vercel-404`; bare 404 → `404`.

One PR. No DB migration. Verify live at `https://ww-migration.victor-stein.dev/`
after deploy + a refresh-all.
