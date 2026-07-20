---
status: superseded by ADR-0033
---

# Maintain an Anna-owned dom-to-pptx fork

Anna will maintain a remote fork of `dom-to-pptx` as the independently releasable source of the PPTX conversion dependency while continuing to synchronize suitable upstream changes and contribute general fixes upstream. PPT-SDK will consume an exact released version from this fork rather than copy its conversion source or wait for upstream releases, so Anna-specific fixes can ship without moving `dom-to-pptx` ownership into `ppt-engine`.

The fork will publish a browser-only distribution for PPT-SDK. It will contain the browser conversion bundle and required runtime assets but exclude the Node exporter, Puppeteer, and browser acquisition logic; `ppt-engine` remains responsible for its managed browser and Binary packaging.
