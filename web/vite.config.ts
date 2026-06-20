import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

// `dist` is the Worker's [assets] dir and must stay tracked (via dist/.gitkeep)
// so the vitest workers-pool can validate wrangler.toml. vite's emptyOutDir wipes
// it on every build; recreate it after the build so a local build never stages
// the placeholder's deletion (which has silently broken CI before).
function keepGitkeep() {
  return {
    name: "keep-dist-gitkeep",
    closeBundle() {
      fs.writeFileSync(path.resolve(__dirname, "dist/.gitkeep"), "");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), keepGitkeep()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { proxy: { "/api": "http://localhost:8787" } }, // wrangler dev port
  build: { outDir: "dist" },
});
