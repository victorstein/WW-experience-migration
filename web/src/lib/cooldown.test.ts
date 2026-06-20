import { describe, it, expect } from "vitest";
import { sweepRemaining } from "./cooldown";

describe("sweepRemaining", () => {
  it("is 0 when never swept", () => {
    expect(sweepRemaining(0, 90, 1000)).toBe(0);
  });
  it("counts down within the window", () => {
    expect(sweepRemaining(1000, 90, 1030)).toBe(60);
  });
  it("clamps to 0 past the window", () => {
    expect(sweepRemaining(1000, 90, 2000)).toBe(0);
  });
});
