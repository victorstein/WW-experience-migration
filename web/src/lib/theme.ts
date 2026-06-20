import { useState, useEffect } from "react";

export type Theme = "light" | "dark";

/**
 * Light/dark theme, persisted to localStorage and applied as the `.dark` class
 * on <html> (matching the no-flash bootstrap in index.html). Defaults to dark —
 * the WeightWatchers experience page that inspired the look is dark.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore storage failures (private mode, etc.) */
    }
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
