import { describe, it, expect, vi } from "vitest";
import { fetchStatus, refreshSlices } from "./api";

describe("fetchStatus", () => {
  it("returns the cells array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ cells: [{ market: "US" }], sliceCount: 20 }),
        { headers: { "content-type": "application/json" } })
    ));
    const r = await fetchStatus();
    expect(r.cells[0].market).toBe("US");
    expect(r.sliceCount).toBe(20);
  });
});

describe("refreshSlices", () => {
  it("POSTs each slice in order and reports progress after each completes", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      return new Response("{}", { headers: { "content-type": "application/json" } });
    }));

    const progress: number[] = [];
    await refreshSlices(3, (done) => { progress.push(done); });

    expect(calls).toEqual([
      "/api/refresh?slice=0",
      "/api/refresh?slice=1",
      "/api/refresh?slice=2",
    ]);
    // Callback fires after each slice with the running completed count — this is
    // what lets the grid populate incrementally instead of all-at-once.
    expect(progress).toEqual([1, 2, 3]);
  });

  it("keeps going if one slice request fails (one bad slice doesn't abort the rest)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("slice=1")) throw new Error("network");
      return new Response("{}", { headers: { "content-type": "application/json" } });
    }));
    const progress: number[] = [];
    await refreshSlices(3, (done) => { progress.push(done); });
    // All three slices reported (the failed one still advances progress).
    expect(progress).toEqual([1, 2, 3]);
  });
});
