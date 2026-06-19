import { describe, it, expect } from "vitest";
import { marketSlices, marketStatus } from "./progress";

describe("marketSlices", () => {
  it("inverts slicePlan into market -> slice indices", () => {
    expect(marketSlices([["US"], ["UK"], ["UK"], ["NZ"]])).toEqual({
      US: [0],
      UK: [1, 2],
      NZ: [3],
    });
  });
});

describe("marketStatus", () => {
  const UK = [1, 2]; // a 2-slice country

  it("is idle when not refreshing", () => {
    expect(marketStatus(UK, 5, false)).toBe("idle");
  });

  it("is pending before any of its slices is reached", () => {
    expect(marketStatus(UK, 0, true)).toBe("pending"); // slice 0 (US) in flight
  });

  it("is loading while one of its slices is in flight", () => {
    expect(marketStatus(UK, 1, true)).toBe("loading"); // slice 1 in flight
    expect(marketStatus(UK, 2, true)).toBe("loading"); // slice 1 done, slice 2 in flight
  });

  it("is done once all its slices completed", () => {
    expect(marketStatus(UK, 3, true)).toBe("done");
  });

  it("handles a single-slice country (US): loads immediately, then done", () => {
    expect(marketStatus([0], 0, true)).toBe("loading");
    expect(marketStatus([0], 1, true)).toBe("done");
  });
});
