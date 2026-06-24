# English-slug variants for localized markets

**Date:** 2026-06-24
**Status:** Approved

## Problem

Six markets are tracked using their localized URL slugs — the finder slug
(`trouver-un-atelier`, `workshop-finden`, `vind-een-workshop`, `hitta-workshop`),
the gateway slug (`ateliers`), the coach slug (`parcourir-ww-coachs`), and the
event word (`virtuel`). During the migration these pages also need to resolve at
their **English slugs** under the same locale (e.g. `/fr/find-a-workshop`,
`/fr/workshops`). Today the board has no visibility into whether the English-slug
URLs render correctly — Vercel canonicalizes localized finder slugs to
`find-a-workshop`, so the English slug is the underlying route, and we want to
confirm it directly.

## Goal

For each localized market, **additionally** check the fully English-slug
equivalent of every page (gateway, main, coach list, coach detail, event detail,
location), alongside the existing localized checks. Surface the results in the
existing grid with a clear label and an explanatory tooltip.

## Scope

- **Localized markets that get an English twin (6):** CA/FR, DE, FR, BE/FR,
  BE/NL, SE.
- **Already-English markets (no twin):** US, UK, CA/EN, AU, NZ — their slugs are
  already English, so a twin would duplicate the existing row.
- **All six concerns** get the English treatment, and **all localized segments**
  are swapped to English: finder slug → `find-a-workshop`, gateway → `workshops`,
  coach → `browse-ww-coaches`, event word → `virtual`. The locale prefix
  (`/ca/fr`, `/fr`, `/de`, …) and the canonical TLD are **unchanged** — we test
  the English slug *under the same locale and domain*.

## Approach: pseudo-market rows

A cell is identified by the tuple `(env, host_variant, market, concern)`, where
`market` is a free-form string key. The gateway slug, coach slug, and event word
are all derived from a single `MarketDef`. So each English twin is modeled as a
new `MarketDef` whose `market` key is the parent label plus an `(EN Slug)`
suffix. This is purely additive: `allCells()`, `partitionSlices()` (market-
aligned), the per-market reload/loading machinery, `/api/status`, and the D1
schema all pick the twins up with **no migration, no API change, and no
classification or token-logic change**.

### Data model — `shared/matrix.ts`

Add six entries to `MARKETS`, each placed directly after its parent so slices
stay market-grouped. The English slugs are exactly the `MarketDef` field
defaults, so the twins simply **omit** the localized fields (`gateway`,
`eventWord`) and use the English `coach`:

```ts
{ market: "CA/FR (EN Slug)", base: "/ca/fr/find-a-workshop", coach: "/browse-ww-coaches", tld: "fr.weightwatchers.ca" },
{ market: "DE (EN Slug)",    base: "/de/find-a-workshop",    coach: "/browse-ww-coaches", tld: "weightwatchers.de" },
{ market: "FR (EN Slug)",    base: "/fr/find-a-workshop",    coach: "/browse-ww-coaches", tld: "weightwatchers.fr" },
{ market: "BE/FR (EN Slug)", base: "/be/fr/find-a-workshop", coach: "/browse-ww-coaches", tld: "fr.weightwatchers.be" },
{ market: "BE/NL (EN Slug)", base: "/be/nl/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.be" },
{ market: "SE (EN Slug)",    base: "/se/find-a-workshop",    coach: "/browse-ww-coaches", tld: "viktvaktarna.se" },
```

Consequences, all from existing per-market derivation (no new code paths):

- `buildUrl` gateway → `https://…/<locale>/workshops` (default slug).
- `eventdet` → `…/virtual/<id>` (default event word).
- `workshopRouteToken("gateway", twin)` → `workshops`, so a French gateway that
  still renders `ateliers` at the English URL correctly reads as not-yet-migrated
  (`vercel-wrong`).
- Each twin has a canonical TLD, so `allCells()` emits all four variants for it
  (qa/prod × com/canonical) — the English slug is checked on the canonical domain
  too.

### UI — `web/src/components/Grid.tsx`

- Add the six twin labels to the display `MARKETS` array, each directly under its
  parent: `… "FR", "FR (EN Slug)", "BE/FR", "BE/FR (EN Slug)", …`.
- `NO_CANONICAL` is unchanged (twins all have a canonical TLD).
- **Info tooltip:** in the shared `Heading` component, when a market label is an
  English twin (ends with `(EN Slug)`), render a small `Info` icon (lucide) next
  to the name inside a Tooltip. `Grid.tsx` does **not** currently import any
  Tooltip primitives, so add `Tooltip`, `TooltipTrigger`, and `TooltipContent`
  from `@/components/ui/tooltip` and follow the existing radix pattern used in
  `Cell.tsx` (`<Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip>`).
  Tooltip copy:
  > English-slug variant — the same market and locale checked with the English
  > URL slugs (find-a-workshop, workshops, browse-ww-coaches, virtual) instead of
  > the localized ones.

  The app is already wrapped in `TooltipProvider`, so no provider change is
  needed. The icon sits alongside the existing reload control and host subheader.
- The footnote (Core-only markets) is unchanged.

## Cell count

6 twins × 4 variants × 6 concerns = **144 new cells → 384 total** (from 240).
Slices grow **31 → 49** (each twin is 24 cells → 3 balanced slices of 8).

The manual "Refresh all" sweep covers more cells and takes proportionally longer.
The cron checks one slice per tick (`*/3 * * * *`), so the time to revisit any
given cell grows with the slice count (≈ 31×3 → 49×3 min, ~1.5h → ~2.5h per
cell). Acceptable for this board; the cursor is `% sliceCount`, so it
self-adjusts with no code change.

## Testing

`test/matrix.test.ts`:

- Update the two `240` assertions (the `allCells().length` count and the
  `partitionSlices(...).flat().length`) to `384`.
- The `US (12 cells) → 2 slices` / `UK (24 cells) → 3` balance assertions still
  hold (parents unchanged), so they stay as-is.
- New cases for a twin (FR is representative), asserting fully English URLs under
  the localized locale:
  - `main` → `https://www.weightwatchers.fr/fr/find-a-workshop`
  - `gateway` → `https://www.weightwatchers.fr/fr/workshops`
  - `coachlist` → `…/fr/find-a-workshop/browse-ww-coaches`
  - `eventdet` → `…/fr/find-a-workshop/virtual/25550661`
- `workshopRouteToken("gateway", "FR (EN Slug)")` → `workshops`.
- `allCells()` includes the twin markets (e.g. a cell with `market === "FR (EN Slug)"`).
- Slice-balance invariants still hold (≤ `SLICE_MAX`, no slice straddles two
  markets) with the larger set.

`test/slice-plan.test.ts`:

- Update the slice-count assertion `31` → `49`.
- Add the 6 twin keys to the expected market-union set (11 → 17 markets) and
  update the test descriptions ("all 11 markets" → 17).
- The `US → 2`, `UK → 3`, `plan[0] === ["US"]` assertions are unaffected.

Tooltip rendering is verified manually (hover a twin row's info icon; confirm the
copy; confirm non-twin rows show no icon).

## Out of scope (YAGNI)

- No `lang`/`slug` axis added to the `Cell` type or D1 schema.
- No visual pairing of native + English pills per concern.
- No English twin for already-English markets.
- No collapsing/grouping control for twin rows.
