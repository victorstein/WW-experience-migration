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

  it("stops at the hop cap and throws", async () => {
    // Every hop's Location points at /next, so the actual chain is
    // /1 -> /next -> /next -> ... (the /2../6 interceptors in the original
    // plan fixture are unreachable and would trip assertNoPendingInterceptors).
    fetchMock.get("https://loop.test").intercept({ path: "/1" })
      .reply(302, "", { headers: { location: "https://loop.test/next" } });
    fetchMock.get("https://loop.test").intercept({ path: "/next" })
      .reply(302, "", { headers: { location: "https://loop.test/next" } }).persist();
    await expect(probe("https://loop.test/1", 5)).rejects.toThrow(/hop cap/i);
  });
});
