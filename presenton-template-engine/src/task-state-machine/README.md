# PPT Task State Machine

This module persists and drives PPT task workflow state under a project-local
`task-state/` directory.

Core files:

- `task.json`: stable task identity, active revision, completion marker.
- `state.json`: current deck/page state, blockers, allowed transitions.
- `current-page.json`: active page state and latest render artifact paths.
- `requirements.json`: confirmed user requirements.
- `outline.json`: confirmed narrative outline.
- `page-plan.json`: per-page implementation plan.
- `artifacts.json`: generated artifact index.
- `events.jsonl`: append-only event log.

JSON-RPC tools are exposed through `describeTaskStateMachine` and
`invokeTaskStateMachine`, then merged into `example_plugin.js` alongside the
existing template-engine tools.

Important behavior:

- Page authoring is page-level: select, author, render, review, fix, accept,
  then lock.
- `recordPageProgress` marks the deck as `deck_html_ready` only after every
  page in `page-plan.json` has a `page_locked` event.
- Checkpoints snapshot `task`, `state`, `current-page`, `page-plan`, and
  `artifacts`.
- Recovery is explicit through `recover_task_project`; normal `open_task_project`
  remains read-oriented except for the `project_opened` event.
- Large RPC responses can be returned through a top-level `__trans_file__`
  pointer. The outer plugin also emits `__file_transport` for compatibility.
