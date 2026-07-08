# PPT App

`ppt-app` is the Anna App shell for the PPT generation toolchain.

The app is intentionally thin:

- UI is shipped as a static SPA bundle.
- Production backend calls go through `AnnaAppRuntime.tools.invoke`.
- Local development uses `anna-app dev` with bundled Executa source directories.
- Workflow logic should live in `ppt-engine` app-facing tools, not in the frontend.

## Scripts

```bash
npm run dev
npm run dev:mock-llm
npm run dev:mock-llm:retry
npm run build
npm run check
npm run validate
```

`npm run dev` starts the Anna App harness via `anna-app dev`.

For this mode the app root contains bundled Executa projects under `executas/`:

```text
executas/
├── anna-search/
│   ├── executa.json
│   └── example_plugin.py
├── ppt-engine/
│   ├── executa.json
│   ├── app_stdio.js
│   └── example_plugin.js
└── ppt-gener/
    ├── executa.json
    └── example_plugin.py
```

`anna-app dev` discovers those `executa.json` files, registers their `tool_id`
values with the local Anna bridge, and lazy-starts the command when the bundle
calls `anna.tools.invoke(...)`.

The app manifest references tools with stable bundled handles:

```text
bundled:ppt-engine
bundled:ppt-gener
bundled:anna-search
```

`anna-app dev` and app publishing generate `anna-tool-ids.js`, which assigns
`window.__ANNA_TOOL_IDS__`. The frontend must read real tool ids from that
sidecar and fail when it is missing; it does not use `.env` or hard-coded tool
id fallbacks.

The important invariant is split by layer:

- `manifest.json` `required_executas[].tool_id` uses `bundled:<handle>`.
- `manifest.json` `ui.host_api.tools` uses `required:bundled:<handle>`.
- `manifest.json` `required_executas[].min_version` follows each Executa manifest version.
- `app.json` `bundled_executas` maps each handle to its bundled Executa project directory.
- `executas/*/executa.json` keeps the real local `tool_id`.
- the real plugin `describe` manifest `name` matches the real local `tool_id`.

Current real ids:

```text
ppt-engine:  tool-lightvoss_5433-ppt-engine-6443rj2a
ppt-gener:   tool-lightvoss_5433-ppt-gener-dc7ftcep
anna-search: tool-lightvoss-anna-search-xkx84a3z
```

The engine adapter starts `executas/ppt-engine/example_plugin.js` through
`app_stdio.js`, preserving pointer response compatibility for Anna runtime.
The generator and search Executas start their plugin entries through `uv run`.

Before using the harness, rebuild the static bundle:

```bash
npm run build
npm run dev
```

This mode uses the real Anna LLM bridge. The local machine must have a valid
developer PAT from:

```bash
anna-app login --host <nexus-url>
```

If the local machine has not logged in, the harness can start with LLM disabled:

```bash
npm run dev -- --no-llm
```

`--no-llm` is only useful for UI and tool-invoke checks. It cannot test outline
generation because Anna mode calls `anna.llm.complete(...)`, which returns
`llm_disabled` in this mode.

For deterministic outline testing, use the mock LLM fixture:

```bash
npm run build
npm run dev:mock-llm
```

This runs:

```bash
anna-app dev --mock-llm fixtures/mock-outline.jsonl
```

The fixture format is JSONL. Each line is one canned host response:

```json
{"ns":"llm","method":"complete","match":{"contentIncludes":"optional text"},"result":{"role":"assistant","content":{"type":"text","text":"{\"title\":\"...\",\"items\":[{\"title\":\"...\",\"outline\":\"...\"}]}"},"model":"mock","stopReason":"endTurn"}}
```

`match.contentIncludes` is optional. When omitted, the response is the fallback
for the matching `ns` and `method`. `fixtures/mock-outline.jsonl` returns a valid
outline object with `title` and `items[].{title,outline}` and 5 pages, which
satisfies the default automatic slide-count range of 3 to 15 pages.

There is also a retry fixture:

```bash
npm run build
npm run dev:mock-llm:retry
```

`fixtures/mock-outline-retry.jsonl` returns invalid JSON for the first
`llm.complete` call and valid JSON for the repair call. Current
`@anna-ai/cli@0.1.12` matches `contentIncludes` against `String(args.messages)`,
so this fixture uses the current message-count string shape to target the repair
request.
