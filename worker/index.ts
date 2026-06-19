// TEMPORARY scaffold placeholder.
//
// The vitest workers-pool boots `main` (this file, per wrangler.toml) before
// any test runs, so it must exist from Task 1 onward even though the real
// entry — the Hono app + `scheduled()` cron — isn't written until Task 6.
// Tasks 1–5 tests never call `SELF.fetch`, so this stub's behavior is never
// exercised. Task 6 REPLACES this whole file with the real `{ fetch, scheduled }`.
export default {
  fetch: () => new Response("not implemented (scaffold placeholder)", { status: 501 }),
};
