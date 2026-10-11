import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "shared/**/*.test.ts", "workers/**/src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
