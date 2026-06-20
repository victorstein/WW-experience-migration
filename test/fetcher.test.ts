import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { probe } from "../worker/fetcher";

beforeAll(() => { fetchMock.activate(); fetchMock.disableNetConnect(); });
afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("probe", () => {
  it("captures a redirect chain and final headers", async () => {
    fetchMock.get("https://ex.test").intercept({ path: "/a" })
      .reply(302, "", { headers: { location: "https://ex.test/b" } });
    fetchMock.get("https://ex.test").intercept({ path: "/b" })
      .reply(200, "ok", { headers: { server: "Vercel", "x-vercel-id": "z" } });

    const r = await probe("https://ex.test/a");
    expect(r.chain.length).toBe(1);
    expect(r.chain[0].location).toBe("https://ex.test/b");
    expect(r.finalStatus).toBe(200);
    expect(r.finalHeaders["server"]).toBe("Vercel");
  });

  it("stops at the hop cap and returns what it saw instead of throwing", async () => {
    // Every hop's Location points at /next, so the chain is /1 -> /next -> /next…
    // Past the cap we keep the observation (a still-redirecting 3xx) rather than
    // discarding it as an error — that's what lets AU's funnel become a `redirect`.
    fetchMock.get("https://loop.test").intercept({ path: "/1" })
      .reply(302, "", { headers: { location: "https://loop.test/next" } });
    fetchMock.get("https://loop.test").intercept({ path: "/next" })
      .reply(302, "", { headers: { location: "https://loop.test/next" } }).persist();
    const r = await probe("https://loop.test/1", 5);
    expect(r.chain.length).toBe(5); // 5 fetches, all redirects recorded
    expect(r.finalStatus).toBe(302); // still redirecting at the cap
    expect(r.chain[4].location).toBe("https://loop.test/next");
  });
});
