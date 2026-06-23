import { describe, it, expect } from "vitest";
import { parseTabParam, VARIANT_KEYS, DEFAULT_VARIANT } from "./tabParam";

describe("parseTabParam", () => {
  it("returns each valid variant key unchanged", () => {
    for (const key of VARIANT_KEYS) {
      expect(parseTabParam(`?tab=${key}`)).toBe(key);
    }
  });

  it("decodes a percent-encoded slash in the key", () => {
    expect(parseTabParam("?tab=prod%2Fcanonical")).toBe("prod/canonical");
  });

  it("falls back to the default when the tab param is missing", () => {
    expect(parseTabParam("")).toBe(DEFAULT_VARIANT);
    expect(parseTabParam("?other=1")).toBe(DEFAULT_VARIANT);
  });

  it("falls back to the default on an unknown value", () => {
    expect(parseTabParam("?tab=staging/com")).toBe(DEFAULT_VARIANT);
    expect(parseTabParam("?tab=garbage")).toBe(DEFAULT_VARIANT);
  });

  it("matches keys exactly (wrong case falls back)", () => {
    expect(parseTabParam("?tab=qa/COM")).toBe(DEFAULT_VARIANT);
  });

  it("defaults to qa/com", () => {
    expect(DEFAULT_VARIANT).toBe("qa/com");
  });
});
