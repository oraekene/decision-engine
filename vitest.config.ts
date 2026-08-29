import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["workers/**/*.test.ts", "frontend/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 60000,
  },
});
