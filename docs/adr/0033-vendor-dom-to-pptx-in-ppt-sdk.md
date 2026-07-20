---
status: accepted
---

# Vendor dom-to-pptx in PPT-SDK

PPT-SDK will keep a complete, reviewable `dom-to-pptx` source snapshot under `third_party/dom-to-pptx/`. The vendored source is the authoritative conversion dependency, so a checkout contains everything required to build and package `ppt-engine` without an npm publishing account, a private registry, an external repository checkout, or a machine-specific path.

The vendored source may be modified directly. Upstream changes are reviewed and selectively ported instead of being applied by an automatic synchronization script, with the imported upstream revision and retained Anna changes recorded alongside the source. Its browser distribution is an ignored derived artifact: local development builds it explicitly, and CI and Binary packaging build it from the vendored source before `ppt-engine` consumes it. No committed-distribution consistency check is required because the distribution is not committed.

The vendored project retains its independent pnpm workspace metadata and frozen lockfile rather than merging its build dependencies into `ppt-engine`'s npm dependency graph. PPT-SDK build and release workflows build this project first, then build and package `ppt-engine` with the resulting browser distribution.

The snapshot retains the source, tests, useful example fixtures, CLI, package and pnpm workspace metadata, frozen lockfile, build and test configuration, documentation, license, and contributor attribution required to develop it independently. Repository administration files and generated or machine-local content such as nested Git metadata, `node_modules`, `dist`, coverage, screenshots, and generated PPTX files are excluded. An Anna-owned `UPSTREAM.md` records provenance and maintained differences.

The existing release workflow is not expanded into a full vendored-project test suite. It installs the frozen pnpm dependencies and builds the browser distribution required for packaging; changes to the vendored converter run its full tests locally as needed, while the final `ppt-engine` Binary smoke test exercises a real offline Deck HTML to PPTX conversion.

`ppt-engine`'s normal build invokes the vendored pnpm build and copies its required browser runtime assets into the engine distribution, but it never installs the vendored dependencies implicitly or at runtime. A missing pnpm installation or dependency tree fails with an explicit setup command; local, release, and Binary builds use this same build path.

The engine distribution places the browser runtime, animation and transition styles, license, and provenance under `dist/vendor/dom-to-pptx/`. Runtime code resolves these files relative to `import.meta.url`, never from the repository `third_party/` path; Binary packaging receives them through the existing external `lib/app/dist` copy, while `lib/browser/` remains reserved for the managed Chrome runtime.

The original MIT license, copyright, and contributor attribution remain with the vendored source. License and provenance accompany the Binary runtime distribution, and a repository third-party notice may index them without replacing the original texts.

The upstream CLI and Node exporter remain available only inside the vendored development project for converter maintenance. They are not exposed as PPT-SDK product commands and are not copied into the `ppt-engine` distribution or Binary; product and development pipeline integration use the engine's managed-browser Module.

The vendored development dependency graph, including its Puppeteer and browser-acquisition packages, remains intact for upstream CLI maintenance but stays isolated from `ppt-engine` dependencies and Binary contents. Release installation disables Puppeteer's browser download, and only the built browser runtime assets selected by the engine build are distributed.

The initial snapshot is based on upstream commit `45ee026e73b33d3fa525ebff34babbad3810d2a0` and explicitly retains executable CLI entry modes plus pnpm build approval for `esbuild` and `puppeteer`. The vendored package fixes its Corepack toolchain with `packageManager: pnpm@11.15.1`; later upstream ports update provenance deliberately rather than importing an external dirty tree wholesale.

The supported build baseline is Node.js 22, shared with `ppt-engine` release workflows and Binary preparation; local Node.js 24 development remains allowed but does not define release compatibility.

The engine initially runs the vendored project's complete upstream Rollup build and selects only the browser bundle, animation and transition styles, license, and provenance for distribution. Additional library and Node-exporter outputs remain ignored development artifacts and do not justify a separate browser-only build target until build cost demonstrates a need.

Runtime export never invokes the upstream Node exporter or its browser acquisition logic; `ppt-engine` continues to own its managed Chrome runtime.

This supersedes ADR-0032. A separately published Anna fork or npm package may be introduced later for collaboration, but it is not part of the PPT-SDK build dependency.
