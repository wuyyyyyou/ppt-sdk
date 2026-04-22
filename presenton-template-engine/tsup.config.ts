import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "http/server": "src/http/server.ts",
      cli: "src/cli.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    target: "node20",
    outDir: "dist",
    shims: false,
    external: ["typescript"],
  },
  {
    entry: {
      "browser/render-slide": "src/browser/render-slide.tsx",
      "browser/render-deck": "src/browser/render-deck.tsx",
    },
    format: ["iife"],
    platform: "browser",
    target: "es2020",
    outDir: "dist",
    splitting: false,
    sourcemap: false,
    clean: false,
    minify: false,
    dts: false,
    shims: false,
  },
]);
