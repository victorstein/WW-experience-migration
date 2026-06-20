import { describe, it, expect } from "vitest";
import { verdict, changeSummary } from "./verdict";

describe("verdict", () => {
  it("maps backends to label + color", () => {
    expect(verdict("vercel").label).toBe("Vercel");
    expect(verdict("nginx").label).toBe("nginx");
    expect(verdict("redirect-exp").label).toBe("→ experience");
    expect(verdict("404").label).toBe("404");
    expect(verdict("error").label).toBe("error");
    expect(verdict("vercel").className).toContain("bg-");
  });

  it("annotates nginx as the old workshop finder; others have no note", () => {
    expect(verdict("nginx").note).toBe("old workshop finder");
    expect(verdict("vercel").note).toBeUndefined();
  });
});

describe("changeSummary", () => {
  it("says 'no changes since tracked' when stable since the first check", () => {
    expect(changeSummary({ since_ts: 100, first_ts: 100 })).toBe("no changes since tracked");
  });
  it("reports a real flip when since_ts moved past first_ts", () => {
    expect(changeSummary({ since_ts: 100, first_ts: 50 })).toMatch(/^flipped /);
  });
});
