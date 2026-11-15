import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "convex/**/*.test.ts",
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
    ],
    environment: "edge-runtime",
  },
});
