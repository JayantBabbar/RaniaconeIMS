import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// ═══════════════════════════════════════════════════════════
// Vitest config — jsdom env, React plugin, path alias mirroring
// tsconfig.json ("@/*" → "./src/*"), global setup file.
// ═══════════════════════════════════════════════════════════

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Separate coverage ignore — we don't want to cover generated / vendor paths.
    coverage: {
      exclude: [
        "node_modules/",
        ".next/",
        "src/app/**/*.tsx", // page layouts are integration-tested
        "**/*.d.ts",
        "src/test/**",
      ],
    },
    css: false, // Tailwind / CSS is not relevant in tests
  },
});
