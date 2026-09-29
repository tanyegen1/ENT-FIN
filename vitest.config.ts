import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose — keeps the app's build config
// untouched and lets this stay a plain Node test environment (the engine
// under test is pure logic with no DOM dependency).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
