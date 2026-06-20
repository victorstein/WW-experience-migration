import { describe, it, expect } from "vitest";
import { slicePlan, sliceCount } from "../worker/checker";

describe("slicePlan", () => {
  it("has one entry per slice (24 with 6 concerns)", () => {
    const plan = slicePlan();
    expect(plan.length).toBe(sliceCount());
    expect(plan.length).toBe(24);
  });

  it("each slice covers 1 or 2 markets; the union is all 11 markets", () => {
    const plan = slicePlan();
    // Per-market cell counts (12 or 24) aren't multiples of 10, so some slices
    // straddle two adjacent markets — at most two.
    expect(plan.every((m) => m.length >= 1 && m.length <= 2)).toBe(true);
    expect(new Set(plan.flat())).toEqual(
      new Set(["US", "UK", "CA/EN", "CA/FR", "AU", "NZ", "DE", "FR", "BE/FR", "BE/NL", "SE"])
    );
  });

  it("starts at US; the 12-cell US spills into UK's first slice", () => {
    const plan = slicePlan();
    expect(plan[0]).toEqual(["US"]);
    expect(plan[1]).toEqual(["US", "UK"]);
  });
});
