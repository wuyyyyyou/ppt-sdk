import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "bundle",
    emptyOutDir: true,
    assetsInlineLimit: (filePath) => {
      const normalizedPath = filePath.replaceAll("\\", "/");
      return normalizedPath.includes("/src/features/templates/presets/") ||
        normalizedPath.endsWith("/src/features/deck-workspace/assets/default-project-cover.svg")
        ? false
        : undefined;
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  }
});
