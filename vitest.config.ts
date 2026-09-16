import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Pure-logic tests never touch the database; stub the Next.js server-only guard.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
