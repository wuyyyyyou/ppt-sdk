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
    external: ["esbuild", "typescript"],
  },
  {
    entry: {
      "browser/render-slide": "src/browser/render-slide-auto.ts",
      "browser/render-deck": "src/browser/render-deck-auto.ts",
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
  {
    entry: {
      "browser/local-render-slide": "src/browser/local-render-slide.ts",
      "browser/local-render-deck": "src/browser/local-render-deck.ts",
      "browser/template-entry": "src/browser/template-entry.ts",
    },
    format: ["esm"],
    platform: "browser",
    target: "es2020",
    outDir: "dist",
    splitting: false,
    sourcemap: false,
    clean: false,
    minify: false,
    dts: false,
    shims: false,
    external: ["react", "react-dom", "react-dom/client", "zod"],
  },
]);
