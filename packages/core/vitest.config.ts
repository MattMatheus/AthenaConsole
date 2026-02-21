import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/index.ts",
        "src/shared/contracts.ts",
        "src/control-plane/interfaces.ts",
        "src/personas/types.ts"
      ],
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 75,
        lines: 70,
        "src/api/router.ts": {
          statements: 95,
          branches: 95,
          functions: 100,
          lines: 95
        }
      }
    }
  }
});
