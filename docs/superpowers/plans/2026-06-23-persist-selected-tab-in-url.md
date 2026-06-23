# Persist Selected Tab in URL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the selected variant tab in the URL as `?tab=<key>` so it survives a refresh and is shareable.

**Architecture:** A new pure module `web/src/lib/tabParam.ts` owns the `VariantKey` type, the `VARIANT_KEYS` list, the default, and a pure `parseTabParam(search)` that validates the `tab` query param. `App.tsx` initializes its `variant` state lazily from the URL and, on user-initiated tab change, writes `?tab=<key>` via `history.replaceState`. No URL is written on first load.

**Tech Stack:** Vite + React + TypeScript, Vitest, shadcn/ui `Tabs`.

Spec: `docs/superpowers/specs/2026-06-23-persist-selected-tab-in-url-design.md`

---

## File Structure

- **Create** `web/src/lib/tabParam.ts` — `VariantKey`, `VARIANT_KEYS`, `DEFAULT_VARIANT`, `parseTabParam`.
- **Create** `web/src/lib/tabParam.test.ts` — unit tests for `parseTabParam`.
- **Modify** `web/src/App.tsx` — remove the local `VariantKey` type (line 13), import from the new module, lazy-init `variant` from the URL (line 19), write the URL in `onValueChange` (line 122).

Test command (run from repo root): `npm run test:web` runs the whole web suite. To run just this file: `cd web && npx vitest run src/lib/tabParam.test.ts`.

---

### Task 1: Pure `parseTabParam` module (TDD)

**Files:**
- Create: `web/src/lib/tabParam.ts`
- Test: `web/src/lib/tabParam.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/tabParam.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseTabParam, VARIANT_KEYS, DEFAULT_VARIANT } from "./tabParam";

describe("parseTabParam", () => {
  it("returns each valid variant key unchanged", () => {
    for (const key of VARIANT_KEYS) {
      expect(parseTabParam(`?tab=${key}`)).toBe(key);
    }
  });

  it("decodes a percent-encoded slash in the key", () => {
    expect(parseTabParam("?tab=prod%2Fcanonical")).toBe("prod/canonical");
  });

  it("falls back to the default when the tab param is missing", () => {
    expect(parseTabParam("")).toBe(DEFAULT_VARIANT);
    expect(parseTabParam("?other=1")).toBe(DEFAULT_VARIANT);
  });

  it("falls back to the default on an unknown value", () => {
    expect(parseTabParam("?tab=staging/com")).toBe(DEFAULT_VARIANT);
    expect(parseTabParam("?tab=garbage")).toBe(DEFAULT_VARIANT);
  });

  it("matches keys exactly (wrong case falls back)", () => {
    expect(parseTabParam("?tab=qa/COM")).toBe(DEFAULT_VARIANT);
  });

  it("defaults to qa/com", () => {
    expect(DEFAULT_VARIANT).toBe("qa/com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/tabParam.test.ts`
Expected: FAIL — cannot resolve `./tabParam` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `web/src/lib/tabParam.ts`:

```ts
export const VARIANT_KEYS = ["qa/com", "qa/canonical", "prod/com", "prod/canonical"] as const;

export type VariantKey = (typeof VARIANT_KEYS)[number];

export const DEFAULT_VARIANT: VariantKey = "qa/com";

function isVariantKey(value: string | null): value is VariantKey {
  return value !== null && (VARIANT_KEYS as readonly string[]).includes(value);
}

// Reads the `tab` query param and returns it only if it is a known variant key,
// otherwise the default. URLSearchParams.get decodes a %2F-encoded slash, so both
// `?tab=prod/com` and `?tab=prod%2Fcom` resolve.
export function parseTabParam(search: string): VariantKey {
  const tab = new URLSearchParams(search).get("tab");
  return isVariantKey(tab) ? tab : DEFAULT_VARIANT;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/lib/tabParam.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/tabParam.ts web/src/lib/tabParam.test.ts
git commit -m "feat(web): add parseTabParam url helper for variant tab"
```

---

### Task 2: Wire `App.tsx` to read/write the URL

**Files:**
- Modify: `web/src/App.tsx` (line 13 type decl, line 19 state init, line 122 `onValueChange`)

- [ ] **Step 1: Remove the local type and import from the module**

Delete this line (currently line 13):

```ts
type VariantKey = "qa/com" | "qa/canonical" | "prod/com" | "prod/canonical";
```

Add the import alongside the other `@/lib` imports (near line 11, after the `type { CurrentCell }` import):

```ts
import { parseTabParam, type VariantKey } from "@/lib/tabParam";
```

- [ ] **Step 2: Lazy-init `variant` from the URL**

Change the `variant` state line (currently line 19) from:

```ts
  const [variant, setVariant] = useState<VariantKey>("qa/com");
```

to:

```ts
  const [variant, setVariant] = useState<VariantKey>(() => parseTabParam(window.location.search));
```

- [ ] **Step 3: Write the URL on tab change**

Change the `Tabs` `onValueChange` (currently line 122) from:

```tsx
          <Tabs value={variant} onValueChange={(v) => setVariant(v as VariantKey)}>
```

to:

```tsx
          <Tabs
            value={variant}
            onValueChange={(v) => {
              const key = v as VariantKey;
              setVariant(key);
              history.replaceState(null, "", `?tab=${key}`);
            }}
          >
```

- [ ] **Step 4: Typecheck the web build**

Run: `cd web && npx tsc -b`
Expected: no errors (the local `VariantKey` is gone and the imported one is used at lines for `variant.split("/")` and the state setter).

- [ ] **Step 5: Run the full web test suite**

Run: `npm run test:web`
Expected: PASS — existing web tests plus the 6 new `parseTabParam` tests.

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat(web): persist selected variant tab in the url"
```

---

### Task 3: Manual verification

**Files:** none (manual check of the `history.replaceState` behavior, which is not unit-tested).

- [ ] **Step 1: Start the web dev server**

Run: `npm run dev:web`
Expected: Vite serves on a local URL (e.g. `http://localhost:5173`).

- [ ] **Step 2: Verify deep-link selects the tab**

Open `http://localhost:5173/?tab=prod/canonical`.
Expected: the "Prod · canonical" tab is active on load.

- [ ] **Step 3: Verify tab change updates the URL and survives refresh**

Click "QA · canonical". Expected: the address bar shows `?tab=qa/canonical` (literal slash, not `%2F`), with no new Back-button history entry. Refresh the page. Expected: "QA · canonical" stays selected.

- [ ] **Step 4: Verify a bare URL stays clean and falls back**

Open `http://localhost:5173/` with no query. Expected: "QA · com" is selected and the URL stays bare (no `?tab=` is written until a tab is clicked). Open `http://localhost:5173/?tab=garbage`. Expected: falls back to "QA · com".

---

## Self-Review

**Spec coverage:**
- `?tab=<key>` encoding, read-on-load, fallback to `qa/com` → Task 1 (`parseTabParam`) + Task 2 (lazy init).
- No write on first load (bare URL stays clean) → Task 2 Step 2 (read-only init) + Task 3 Step 4 (verified).
- `history.replaceState` on user change, unencoded slash via string interpolation → Task 2 Step 3 + Task 3 Step 3 (verified).
- `VariantKey`/`VARIANT_KEYS` single source of truth → Task 1 + Task 2 Step 1.
- Tests: valid passthrough, missing, garbage, wrong-case → Task 1 Step 1.
- Out of scope (router, pushState, other state) → not present in any task. ✔

**Placeholder scan:** none — all steps contain concrete code and commands.

**Type consistency:** `VariantKey`, `VARIANT_KEYS`, `DEFAULT_VARIANT`, `parseTabParam` names are consistent across Task 1 and Task 2. `parseTabParam(search: string): VariantKey` is used exactly as defined. `App.tsx`'s existing `variant.split("/")` (line ~100) and `setVariant` continue to work with the imported `VariantKey`.
