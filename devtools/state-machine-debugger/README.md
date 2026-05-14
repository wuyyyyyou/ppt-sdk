# State Machine Debugger

Local web debugger for `presenton-template-engine` task state machine projects.

It runs a thin Node server that calls the real `invokeTaskStateMachine()` implementation, plus a Vite/React frontend. The debugger does not duplicate state transition logic.

## Start

From the repository root:

```bash
cd devtools/state-machine-debugger
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:4318
```

`npm run dev` starts both services:

```text
Vite frontend: http://127.0.0.1:4318
API server:    http://127.0.0.1:4319
```

Use an absolute `project_dir` that contains a `task-state/` directory, or create one with `create_task_project`.

If you want to test the production bundle:

```bash
npm run build
npm run server
```

Then open `http://127.0.0.1:4319`.

The server imports `../../presenton-template-engine/dist/index.js`, so rebuild `presenton-template-engine` after changing state-machine source code:

```bash
cd ../../presenton-template-engine
npm run build
```

## What It Shows

- Current deck/page state and recommended next action.
- VS Code-style tree for `task-state/*` and `promote/*`.
- Monaco editor views for JSON, JSONL, and Markdown files.
- A Monaco JSON args editor with tool-specific defaults.
- Before/after snapshots for each tool invocation.

## Notes

- This is a local development tool. It intentionally has no auth layer.
- The browser talks only to the local debug server; file reads and RPC calls happen in Node.
- Large RPC responses using `__file_transport` are passed through as returned by the state machine.
