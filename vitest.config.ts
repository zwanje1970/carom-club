import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["modules/**/*.spec.ts", "modules/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./") },
  },
});
