import { defineConfig } from "vitest/config";
import path from "node:path";

// Next.js 16 + TypeScript repo — tests live under top-level `tests/`,
// mirroring the `src/` layout. Source uses the `@/*` -> `src/*` alias
// (see tsconfig.json); mirrored here so test files can import the same way.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
