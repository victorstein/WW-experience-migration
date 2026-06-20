import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { env, fetchMock, SELF } from "cloudflare:test";
import { partitionSlices, allCells, buildUrl } from "../shared/matrix";

beforeAll(() => { fetchMock.activate(); fetchMock.disableNetConnect(); });
afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("api", () => {
  it("POST /api/refresh?slice=0 runs a slice; GET /api/status returns rows", async () => {
    const slice = partitionSlices(allCells())[0];
    for (const cell of slice) {
      const u = new URL(buildUrl(cell));
      fetchMock.get(u.origin).intercept({ path: u.pathname })
        .reply(200, "ok", { headers: { server: "Vercel", "x-vercel-id": "z" } });
    }
    const refresh = await SELF.fetch("https://board/api/refresh?slice=0", { method: "POST" });
    expect(refresh.status).toBe(200);

    const status = await SELF.fetch("https://board/api/status");
    const body = await status.json<{ cells: unknown[] }>();
    expect(body.cells.length).toBe(slice.length);
  });

  it("GET /api/status returns JSON shape even when empty-ish", async () => {
    const res = await SELF.fetch("https://board/api/status");
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("GET /api/history 400s on missing params, 200s with all four", async () => {
    const bad = await SELF.fetch("https://board/api/history?env=qa");
    expect(bad.status).toBe(400);
    const ok = await SELF.fetch("https://board/api/history?env=qa&host_variant=com&market=US&concern=main");
    expect(ok.status).toBe(200);
  });

  it("POST /api/sweep claims once, then 429s within the cooldown with a countdown", async () => {
    const first = await SELF.fetch("https://board/api/sweep", { method: "POST" });
    expect(first.status).toBe(200);
    const f = await first.json<{ ok: boolean; lastSweepTs: number }>();
    expect(f.ok).toBe(true);
    expect(f.lastSweepTs).toBeGreaterThan(0);

    const second = await SELF.fetch("https://board/api/sweep", { method: "POST" });
    expect(second.status).toBe(429);
    const s = await second.json<{ ok: boolean; retryAfter: number }>();
    expect(s.ok).toBe(false);
    expect(s.retryAfter).toBeGreaterThan(0);
  });

  it("GET /api/status exposes lastSweepTs + cooldown for the shared countdown", async () => {
    const res = await SELF.fetch("https://board/api/status");
    const body = await res.json<Record<string, unknown>>();
    expect(body).toHaveProperty("lastSweepTs");
    expect(body).toHaveProperty("cooldown");
  });

  it("GET /api/probe returns the live chain, headers, and edge classification", async () => {
    fetchMock.get("https://origin.test").intercept({ path: "/p" }).reply(200, "ok", {
      headers: { server: "cloudflare", via: "1.1 varnish, 1.1 varnish", "x-served-by": "cache-iad-a, cache-mia-b" },
    });
    const res = await SELF.fetch("https://board/api/probe?url=" + encodeURIComponent("https://origin.test/p"));
    expect(res.status).toBe(200);
    const body = await res.json<{ classified: { backend: string }; headers: Record<string, string> }>();
    expect(body.classified.backend).toBe("nginx"); // cloudflare-masked, but Fastly fingerprint => legacy
    expect(body.headers.via).toContain("varnish");
  });
});
