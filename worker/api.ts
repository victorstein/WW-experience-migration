import { Hono } from "hono";
import type { AppEnv } from "./db";
import { getCursor, getHistory, getStatus, setCursor, getLastSweep, claimSweep, SWEEP_COOLDOWN_S } from "./db";
import { runSlice, sliceCount, slicePlan } from "./checker";
import { probe } from "./fetcher";
import { classify } from "../shared/classify";
import type { Cell, Concern, Env, HostVariant } from "../shared/types";

export const app = new Hono<{ Bindings: AppEnv }>();

// Stable cache key for the status read — a plain GET, independent of the caller.
const statusCacheKey = (url: string) => new Request(new URL("/api/status", url).toString());
const bustStatusCache = (url: string) => caches.default.delete(statusCacheKey(url));

// Hot read path: every page load and 30s client poll hits this. Edge-cache it for
// 30s so a burst of viewers per colo collapses to a single D1 read; writes bust the
// cache so the next poll reflects them. lastSweepTs/cooldown drive the shared
// "Refresh all" countdown — both are absolute, so a slightly stale cache is fine
// (clients tick the countdown locally against lastSweepTs).
app.get("/api/status", async (c) => {
  const cached = await caches.default.match(statusCacheKey(c.req.url));
  if (cached) return cached;

  const [cells, lastSweepTs] = await Promise.all([getStatus(c.env.DB), getLastSweep(c.env.DB)]);
  const res = c.json({ cells, sliceCount: sliceCount(), slicePlan: slicePlan(), lastSweepTs, cooldown: SWEEP_COOLDOWN_S });
  res.headers.set("Cache-Control", "public, max-age=30");
  await caches.default.put(statusCacheKey(c.req.url), res.clone());
  return res;
});

app.get("/api/history", async (c) => {
  const cell: Cell = {
    env: c.req.query("env") as Env,
    host_variant: c.req.query("host_variant") as HostVariant,
    market: c.req.query("market") ?? "",
    concern: c.req.query("concern") as Concern,
  };
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10) || 100, 500);
  const history = await getHistory(c.env.DB, cell, limit);
  return c.json({ history });
});

// Manual refresh: cursor-free — runs exactly the requested slice.
app.post("/api/refresh", async (c) => {
  const slice = parseInt(c.req.query("slice") ?? "", 10);
  if (Number.isNaN(slice) || slice < 0 || slice >= sliceCount()) {
    return c.json({ error: `slice must be 0..${sliceCount() - 1}` }, 400);
  }
  const { changed } = await runSlice(c.env, slice, Math.floor(Date.now() / 1000));
  await bustStatusCache(c.req.url);
  return c.json({ slice, changed });
});

// Claim a full "Refresh all" sweep. Atomic + rate-limited so concurrent users
// can't run overlapping sweeps: the first within the cooldown window wins, the
// rest get 429 + retryAfter and render the same shared countdown. Busting the
// status cache means every client's next poll picks up the new trigger time.
app.post("/api/sweep", async (c) => {
  const now = Math.floor(Date.now() / 1000);
  const claim = await claimSweep(c.env.DB, now);
  await bustStatusCache(c.req.url);
  return c.json(
    { ok: claim.ok, lastSweepTs: claim.lastSweepTs, retryAfter: claim.retryAfter, cooldown: SWEEP_COOLDOWN_S },
    claim.ok ? 200 : 429
  );
});

// Debug visibility: live-probe any URL and return the full redirect chain, the
// final response headers, and how we'd classify it — no persistence. This is the
// edge's vantage point (Cloudflare rewrites Server, masks origins), which differs
// from a fetch run inside the corporate network. Use it to see exactly what the
// Worker sees when a verdict looks wrong: GET /api/probe?url=https://…
app.get("/api/probe", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ error: "url query param required" }, 400);
  try {
    const { chain, finalStatus, finalHeaders } = await probe(url);
    return c.json({ url, chain, finalStatus, headers: finalHeaders, classified: classify(finalStatus, finalHeaders, chain) });
  } catch (e) {
    return c.json({ url, error: e instanceof Error ? e.message : String(e) }, 502);
  }
});

// Asset fallback: anything not /api/* is served by the static assets (SPA).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

// Exposed for the scheduled() handler in index.ts.
export { getCursor, setCursor, runSlice, sliceCount };
