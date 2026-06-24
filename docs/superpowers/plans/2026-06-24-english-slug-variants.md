# English-slug Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Additionally check the fully English-slug equivalent of every page for the 6 localized markets (CA/FR, DE, FR, BE/FR, BE/NL, SE), surfaced as labeled `(EN Slug)` rows in the grid with an explanatory info tooltip.

**Architecture:** Each English twin is a new `MarketDef` whose `market` key is the parent label plus an `(EN Slug)` suffix, reusing the parent's locale prefix and canonical TLD but with English slugs (which are the `MarketDef` field defaults, so the localized fields are simply omitted). Because a cell is keyed by the free-form `(env, host_variant, market, concern)` tuple, this is purely additive — no D1 migration, no API change, no classification/token change. The grid gains the twin rows plus a tooltip; everything else (slicing, per-market reload, loading states) picks the twins up unchanged.

**Tech Stack:** TypeScript, Cloudflare Worker (Hono) + D1, Vite + React + Tailwind + shadcn/ui (radix Tooltip), Vitest (root: v3 pool-workers; web: v4 + jsdom).

---

## File Structure

- `shared/matrix.ts` — **Modify.** Add 6 twin `MarketDef` entries to `MARKETS`, each directly after its parent. No other logic changes (`buildUrl`, `allCells`, `partitionSlices`, `workshopRouteToken` derive everything from `MarketDef`).
- `test/matrix.test.ts` — **Modify.** Update the two `240` → `384` count assertions; add cases for a twin's English URLs, gateway token, and presence in `allCells()`.
- `test/slice-plan.test.ts` — **Modify.** Update slice count `31` → `49` and the market-union set (11 → 17 markets).
- `web/src/components/Grid.tsx` — **Modify.** Add the 6 twin labels to the display `MARKETS` array (each after its parent); add an `Info` tooltip in the shared `Heading` component for any label ending in `(EN Slug)`.

No files are created. No new dependencies (`Info` from `lucide-react` and the `@/components/ui/tooltip` primitives already exist).

---

## Task 1: Add English-slug twin markets (data model + tests)

**Files:**
- Modify: `shared/matrix.ts:12-24` (the `MARKETS` array)
- Test: `test/matrix.test.ts`, `test/slice-plan.test.ts`

- [ ] **Step 1: Add the new matrix test cases (failing)**

In `test/matrix.test.ts`, change the existing count assertion on line 5 from:

```ts
  it("produces exactly 240 cells (6 concerns; US/NZ canonical skipped)", () => {
    expect(allCells().length).toBe(240);
  });
```

to:

```ts
  it("produces exactly 384 cells (6 concerns; US/NZ canonical skipped; +6 EN-slug twins)", () => {
    expect(allCells().length).toBe(384);
  });
```

Change the `partitionSlices` flat-length assertion (currently `expect(slices.flat().length).toBe(240);`) to:

```ts
    expect(slices.flat().length).toBe(384);
```

Then add these three new cases inside the `describe("matrix", …)` block (e.g. just before the closing `});` of the describe):

```ts
  it("checks the English-slug twin under the localized locale (FR)", () => {
    const en = (concern: "main" | "gateway" | "coachlist" | "eventdet") =>
      buildUrl({ env: "prod", host_variant: "canonical", market: "FR (EN Slug)", concern });
    expect(en("main")).toBe("https://www.weightwatchers.fr/fr/find-a-workshop");
    expect(en("gateway")).toBe("https://www.weightwatchers.fr/fr/workshops");
    expect(en("coachlist")).toBe("https://www.weightwatchers.fr/fr/find-a-workshop/browse-ww-coaches");
    expect(en("eventdet")).toBe("https://www.weightwatchers.fr/fr/find-a-workshop/virtual/25550661");
  });

  it("uses the default 'workshops' gateway token for an English-slug twin", () => {
    expect(workshopRouteToken("gateway", "FR (EN Slug)")).toBe("workshops");
  });

  it("includes the six English-slug twin markets in allCells", () => {
    const twins = ["CA/FR (EN Slug)", "DE (EN Slug)", "FR (EN Slug)", "BE/FR (EN Slug)", "BE/NL (EN Slug)", "SE (EN Slug)"];
    const present = new Set(allCells().map((c) => c.market));
    for (const t of twins) expect(present.has(t)).toBe(true);
  });
```

- [ ] **Step 2: Update the slice-plan test (failing)**

In `test/slice-plan.test.ts`, replace lines 5-17 so the count is `49` and the market set has all 17 markets:

```ts
  it("has one entry per slice (49: market-aligned balanced slices)", () => {
    const plan = slicePlan();
    expect(plan.length).toBe(sliceCount());
    expect(plan.length).toBe(49);
  });

  it("every slice belongs to exactly one market; union is all 17 markets", () => {
    const plan = slicePlan();
    expect(plan.every((m) => m.length === 1)).toBe(true);
    expect(new Set(plan.flat())).toEqual(
      new Set([
        "US", "UK", "CA/EN", "CA/FR", "CA/FR (EN Slug)", "AU", "NZ",
        "DE", "DE (EN Slug)", "FR", "FR (EN Slug)", "BE/FR", "BE/FR (EN Slug)",
        "BE/NL", "BE/NL (EN Slug)", "SE", "SE (EN Slug)",
      ])
    );
  });
```

(Leave the third `it` — `US → 2`, `UK → 3`, `plan[0] === ["US"]` — unchanged; parents are unaffected.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- matrix slice-plan`
Expected: FAIL — `allCells().length` is still 240 (expected 384), `slicePlan().length` is 31 (expected 49), and the twin URL/token/membership assertions fail because the markets don't exist yet.

- [ ] **Step 4: Add the 6 twin entries to `MARKETS`**

In `shared/matrix.ts`, the `MARKETS` array (lines 12-24) becomes — each twin inserted directly after its parent:

```ts
export const MARKETS: MarketDef[] = [
  { market: "US", base: "/us/find-a-workshop", coach: "/browse-ww-coaches", tld: null },
  { market: "UK", base: "/uk/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.co.uk" },
  { market: "CA/EN", base: "/ca/en/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.ca" },
  { market: "CA/FR", base: "/ca/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "fr.weightwatchers.ca", eventWord: "virtuel", gateway: "ateliers" },
  { market: "CA/FR (EN Slug)", base: "/ca/fr/find-a-workshop", coach: "/browse-ww-coaches", tld: "fr.weightwatchers.ca" },
  { market: "AU", base: "/au/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.com.au" },
  { market: "NZ", base: "/nz/find-a-workshop", coach: "/browse-ww-coaches", tld: null },
  { market: "DE", base: "/de/workshop-finden", coach: "/coaches", tld: "weightwatchers.de" },
  { market: "DE (EN Slug)", base: "/de/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.de" },
  { market: "FR", base: "/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "weightwatchers.fr", gateway: "ateliers" },
  { market: "FR (EN Slug)", base: "/fr/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.fr" },
  { market: "BE/FR", base: "/be/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "fr.weightwatchers.be", gateway: "ateliers" },
  { market: "BE/FR (EN Slug)", base: "/be/fr/find-a-workshop", coach: "/browse-ww-coaches", tld: "fr.weightwatchers.be" },
  { market: "BE/NL", base: "/be/nl/vind-een-workshop", coach: "/bekijk-ww-coaches", tld: "weightwatchers.be" },
  { market: "BE/NL (EN Slug)", base: "/be/nl/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.be" },
  { market: "SE", base: "/se/hitta-workshop", coach: "/browse-ww-coaches", tld: "viktvaktarna.se" },
  { market: "SE (EN Slug)", base: "/se/find-a-workshop", coach: "/browse-ww-coaches", tld: "viktvaktarna.se" },
];
```

(The twins omit `gateway` and `eventWord`, so they default to `workshops` and `virtual`; they use the English `coach` slug `/browse-ww-coaches`.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- matrix slice-plan`
Expected: PASS — all matrix and slice-plan cases green, including the new twin cases.

- [ ] **Step 6: Run the full root suite + typecheck (no regressions)**

Run: `npm test && npm run typecheck`
Expected: PASS — the worker/classify suites are untouched; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add shared/matrix.ts test/matrix.test.ts test/slice-plan.test.ts
git commit -m "feat: add English-slug variant markets for localized locales"
```

---

## Task 2: Render twin rows in the grid

**Files:**
- Modify: `web/src/components/Grid.tsx:7` (the display `MARKETS` array)

- [ ] **Step 1: Add the twin labels to the display order**

In `web/src/components/Grid.tsx`, replace the `MARKETS` constant on line 7:

```ts
const MARKETS = ["US", "UK", "CA/EN", "CA/FR", "AU", "NZ", "DE", "FR", "BE/FR", "BE/NL", "SE"];
```

with the parent-then-twin order (matching `shared/matrix.ts`):

```ts
const MARKETS = [
  "US", "UK", "CA/EN", "CA/FR", "CA/FR (EN Slug)", "AU", "NZ",
  "DE", "DE (EN Slug)", "FR", "FR (EN Slug)", "BE/FR", "BE/FR (EN Slug)",
  "BE/NL", "BE/NL (EN Slug)", "SE", "SE (EN Slug)",
];
```

- [ ] **Step 2: Typecheck and build the web app**

Run: `npm run typecheck && cd web && npm run build && cd ..`
Expected: PASS — `market` is a free-form string, so no type changes are needed; build succeeds.

- [ ] **Step 3: Verify the rows render (manual, optional but recommended)**

Run: `npm run dev:web` and open the local URL. Confirm the grid now shows `CA/FR (EN Slug)`, `DE (EN Slug)`, `FR (EN Slug)`, `BE/FR (EN Slug)`, `BE/NL (EN Slug)`, `SE (EN Slug)` rows directly under their parents, each with cells and a per-row reload control. (Cells may be empty/`—` until a sweep populates them — that is expected for brand-new markets.) Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Grid.tsx
git commit -m "feat(web): show English-slug twin rows in the status grid"
```

---

## Task 3: Add the English-slug info tooltip

**Files:**
- Modify: `web/src/components/Grid.tsx:1` (imports), `web/src/components/Grid.tsx:58-85` (the `Heading` component)

- [ ] **Step 1: Add the imports**

In `web/src/components/Grid.tsx`, line 1 currently is:

```ts
import { Loader2, RotateCw } from "lucide-react";
```

Change it to add `Info`, and add the tooltip primitives import on the next line:

```ts
import { Info, Loader2, RotateCw } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
```

- [ ] **Step 2: Render the info icon for twin rows**

In the `Heading` component, the market-name row currently reads (around lines 62-77):

```tsx
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {m}
          {load === "loading" ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : !sameAsCom ? (
            <button
              type="button"
              onClick={() => onReloadMarket?.(m)}
              aria-label={`Reload ${m}`}
              title={`Reload ${m}`}
              className="rounded p-0.5 text-muted-foreground/50 transition hover:text-foreground"
            >
              <RotateCw className="size-3.5" />
            </button>
          ) : null}
        </div>
```

Add the tooltip immediately after that reload conditional, still inside the same flex `div`:

```tsx
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {m}
          {load === "loading" ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : !sameAsCom ? (
            <button
              type="button"
              onClick={() => onReloadMarket?.(m)}
              aria-label={`Reload ${m}`}
              title={`Reload ${m}`}
              className="rounded p-0.5 text-muted-foreground/50 transition hover:text-foreground"
            >
              <RotateCw className="size-3.5" />
            </button>
          ) : null}
          {m.endsWith("(EN Slug)") && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="What is the EN Slug variant?"
                  className="rounded p-0.5 text-muted-foreground/50 transition hover:text-foreground"
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                English-slug variant — the same market and locale checked with the English URL slugs (find-a-workshop, workshops, browse-ww-coaches, virtual) instead of the localized ones.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && cd web && npm run build && cd ..`
Expected: PASS.

- [ ] **Step 4: Verify the tooltip (manual)**

Run: `npm run dev:web`, open the local URL. Hover (or tap) the `Info` icon on any `(EN Slug)` row and confirm the copy appears: "English-slug variant — the same market and locale checked with the English URL slugs …". Confirm non-twin rows (e.g. `US`, `FR`) show **no** info icon. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Grid.tsx
git commit -m "feat(web): explain English-slug rows with an info tooltip"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run every gate the CI runs**

Run:

```bash
npm test && npm run typecheck && npm run test:web && (cd web && npm run build)
```

Expected: PASS on all four — root worker/matrix/slice-plan suites, typecheck, web suite (22 tests, unchanged), and the web production build.

- [ ] **Step 2: Confirm the spec's manual checks are satisfied**

Confirm against `docs/superpowers/specs/2026-06-24-english-slug-variants-design.md`:
- All 6 twin rows render under their parents in the grid.
- Each twin row shows the info tooltip; no non-twin row does.
- (After a sweep) a twin's gateway/main/coach/event cells point at the English-slug URLs under the localized locale (hover a cell pill to see its `url`).

- [ ] **Step 3: (No commit)** — verification only; proceed to finishing the branch (PR) per the chosen execution flow.
```
