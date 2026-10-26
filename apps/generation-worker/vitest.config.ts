import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL:
        process.env.GENERATION_TEST_DATABASE_URL ??
        "postgresql://thumbcraft:thumbcraft@localhost:5432/generation_test",
    },
  },
});
