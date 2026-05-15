# PPT App

`ppt-app` is the Anna App shell for the existing PPT generation toolchain.

The app is intentionally thin:

- UI is shipped as a static SPA bundle.
- Production backend calls go through `AnnaAppRuntime.tools.invoke`.
- Local standalone calls go through `dev-server` and JSON-RPC over stdio.
- Workflow logic should live in `ppt-engine` app-facing tools, not in the frontend.

## Scripts

```bash
npm run dev
npm run dev:ui
npm run dev:standalone
npm run build
npm run check
npm run validate
```

`npm run dev` starts the Anna App harness.

`npm run dev:standalone` starts the local HTTP-to-JSON-RPC bridge. It is a bridge to local tools, not a production backend.

`npm run dev:ui` starts the Vite UI at `http://127.0.0.1:5174` and proxies `/api` to the standalone bridge at `http://127.0.0.1:8787`. For local plugin-backed UI testing, run both:

```bash
npm run dev:standalone
npm run dev:ui
```
