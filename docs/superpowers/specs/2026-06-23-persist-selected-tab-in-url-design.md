# Persist selected tab in the URL

**Date:** 2026-06-23
**Status:** Approved

## Problem

The dashboard's variant selector (`qa/com`, `qa/canonical`, `prod/com`, `prod/canonical`) is held only in React state and defaults to `qa/com`. A page refresh — or sharing the URL — always lands on `qa/com`, losing whichever tab the user was viewing.

## Goal

Reflect the selected variant tab in the URL so it survives a refresh and is shareable.

## Behavior

- The selected tab is encoded as a query param: `?tab=<key>`, where `<key>` is one of the four variant keys (e.g. `?tab=prod/canonical`).
- On load, the app reads `?tab=` and selects that tab. A missing or unrecognized value falls back to the current default, `qa/com`.
- On first load, the app does **not** write the default into a bare URL — a fresh visit with no `?tab=` stays clean. The URL is written only on a user-initiated tab change.
- Switching tabs rewrites the URL in place via `history.replaceState` — no new history entries, so the browser Back button leaves the page rather than cycling through tabs.
- The write uses plain string interpolation — `history.replaceState(null, "", \`?tab=${key}\`)` — so the slash stays unencoded for a clean URL (e.g. `?tab=prod/com`, not `?tab=prod%2Fcom`). This relative form intentionally preserves the path; the app uses no hash and no other query params. (Reading via `URLSearchParams.get` decodes `%2F` too, so a hand-encoded URL still resolves.)

## Structure

New focused module `web/src/lib/tabParam.ts`, matching the existing `lib/` pattern (`verdict.ts`, `cooldown.ts`, `progress.ts`):

- `VariantKey` type and `VARIANT_KEYS` array — moved out of `App.tsx` so they are the single source of truth.
- `DEFAULT_VARIANT` constant = `"qa/com"`.
- `parseTabParam(search: string): VariantKey` — pure function. Reads the `tab` param from a query string, returns it if it is a known variant key, otherwise returns `DEFAULT_VARIANT`. Independently unit-testable.

`App.tsx` changes (minimal):

- Initialize state lazily from the URL: `useState(() => parseTabParam(window.location.search))`. This read-only init does not touch the URL, so a bare first visit stays clean.
- In `onValueChange`, after `setVariant`, write the URL via `history.replaceState(null, "", \`?tab=${key}\`)` (string interpolation, not `URLSearchParams`).
- Import `VariantKey` / `VARIANT_KEYS` from the new module instead of declaring them locally.

## Testing

- `web/src/lib/tabParam.test.ts` covers `parseTabParam`:
  - a valid key passes through (each of the four),
  - missing `tab` param falls back to `qa/com`,
  - unknown/garbage value falls back to `qa/com`,
  - wrong-case value falls back to `qa/com` (keys are matched exactly).
- The `history.replaceState` write is a one-liner verified manually (load with `?tab=prod/canonical`, confirm the tab is selected; switch tabs, confirm the URL updates and survives refresh).

## Out of scope (YAGNI)

- No router dependency.
- No `pushState` / Back-button history stepping.
- No persisting any other UI state (cooldown, progress, etc.).
