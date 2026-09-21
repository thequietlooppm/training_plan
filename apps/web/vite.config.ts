import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
// `vitest/config`'s defineConfig is a superset of Vite's — this lets the one
// config file drive both `vite build`/`vite dev` and `vitest` off the same
// plugins/aliases, per the plan ("shares Vite's existing config/transform
// pipeline").
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    // src/lib/health.ts throws at import time if this is unset (fail-fast
    // guard against a silently-undefined API base URL). Tests don't hit a
    // real network — fetch is stubbed per-test — so any value works here.
    env: {
      VITE_API_BASE_URL: "http://localhost:3001",
    },
  },
});
