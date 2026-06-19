import { describe, it, expect } from "vitest";
import { verdict } from "./verdict";

describe("verdict", () => {
  it("maps backends to label + color", () => {
    expect(verdict("vercel").label).toBe("✅ Vercel");
    expect(verdict("nginx").label).toBe("🟧 nginx");
    expect(verdict("redirect-exp").label).toBe("↪️ → experience");
    expect(verdict("404").label).toBe("❌ 404");
    expect(verdict("error").label).toBe("⚠️ error");
    expect(verdict("vercel").className).toContain("bg-");
  });
});
