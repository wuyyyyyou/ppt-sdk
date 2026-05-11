# PPT Task State Machine

This module persists and drives PPT task workflow state under a project-local
`task-state/` directory, and generates a derived `promote/` instruction layer
for PPT AI Agent consumption.

Core files:

- `task.json`: stable task identity, active revision, completion marker.
- `state.json`: current deck/page state, blockers, allowed transitions.
  It may also carry selected template group id/name after the template group is
  forked.
- `current-page.json`: active page state and latest render artifact paths.
- `requirements.json`: confirmed user requirements.
- `outline.json`: confirmed narrative outline.
- `page-plan.json`: per-page implementation plan.
- `artifacts.json`: generated artifact index.
- `events.jsonl`: append-only event log.
- `promote/`: derived stage instructions for the current deck or page state.

JSON-RPC tools are exposed through `describeTaskStateMachine` and
`invokeTaskStateMachine`, then merged into `example_plugin.js` alongside the
existing template-engine tools.

Important behavior:

- Page authoring is page-level: select, author, render, review, fix, accept,
  then lock.
- `record_requirements` defaults to `mode: "merge"` so repeated calls preserve
  existing requirement fields that the latest input does not mention. Use
  `mode: "replace_all"` only when the full requirement record should be
  replaced.
- `query_task_state` returns available template group summaries during
  `requirements_collected`; the Agent should present that full list to the user,
  then call `record_template_selection` with the confirmed `template_group`.
- `record_template_selection` overwrites and forks the selected template group
  into `<projectDir>/template`, records the selected template group, and advances
  the deck to `project_forked`.
- `recordPageProgress` marks the deck as `deck_html_ready` only after every
  page in `page-plan.json` has a `page_locked` event.
- Checkpoints snapshot `task`, `state`, `current-page`, `page-plan`, and
  `artifacts`.
- Recovery is explicit through `recover_task_project`; normal `open_task_project`
  remains read-oriented except for the `project_opened` event.
- `query_task_state` also materializes `promote/current.md` and the current
  stage-specific `promote/*.md` guidance file before returning recommendation
  metadata.
- Large RPC responses can be returned through a top-level `__file_transport`
  pointer. When `cwd` is provided in the RPC arguments, the transport file is
  written under `cwd/.executa-file-transport/`; otherwise it falls back to the
  plugin temp directory.
