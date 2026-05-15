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
npm run dev:standalone
npm run build
npm run check
npm run validate
```

`npm run dev:standalone` is the first local development path. It is a bridge to local tools, not a production backend.
