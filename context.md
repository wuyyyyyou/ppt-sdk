# PPT App LLM/Agent Integration Context

This file records the design decisions for wiring `ppt-app` into real Anna LLM and local writable Agent flows. Because the development machine uses a case-insensitive filesystem, do not create a separate `CONTEXT.md`; keep glossary terms and implementation notes in this file.

## Language

**Workspace**:
A local project folder for one presentation generation attempt. A Workspace contains planning artifacts, page source files, logs, previews, and final review output.
_Avoid_: Task folder, job directory

**Page Plan**:
The plan that maps each outline item to a specific generated page, including its intended template blueprint and page identity. One Page Plan has many Planned Pages.
_Avoid_: Pages file, manifest draft

**Planned Page**:
One page entry in a Page Plan. A Planned Page owns the authoring intent for a single slide-like page before it is accepted.
_Avoid_: Slide when discussing planning state

**Page Progress**:
The current lifecycle state for each Planned Page while the deck is being generated. Page Progress records whether a page is pending, being authored, being rendered, under review, accepted, or failed.
_Avoid_: Page Plan, final pages

**Agent Session**:
A short-lived Anna Agent conversation used to perform local file-editing work for presentation generation. Agent Sessions are operational resources, not user-facing presentation content.
_Avoid_: Deck session when discussing resource lifetime

**Agent Run**:
One request sent to an Agent Session for a specific authoring, repair, or visual review task. A Planned Page may require multiple Agent Runs before it is accepted.
_Avoid_: Agent Session

**Agent Infrastructure Failure**:
A failure to create, keep, or use an Agent Session. It is distinct from a page authoring failure because it says the Agent resource was unavailable, not that the page content was bad.
_Avoid_: Agent failure when the cause is session minting, expiry, or transport

**Page Runtime Identity**:
The identity used by the renderer to bind one Planned Page to its local TSX component at render time. It must be unique per Planned Page even when multiple pages start from the same template blueprint.
_Avoid_: Blueprint id, layout id when uniqueness per page is required

## Goal

Clicking "create presentation" after selecting a template should run the full flow:

1. Use Anna LLM to generate an outline from user prompt and workspace settings.
2. Save the outline to `outline.json`.
3. Use Anna LLM to create a page plan from the outline and selected template catalog.
4. Save the plan to `page-plan.json`.
5. Ask the backend to prepare page files from that plan.
6. Use short-lived local writable Agent Sessions, with one or more Agent Runs per page.
7. For each page, let the Agent edit workspace files, render/check the page, screenshot it, self-review it, and fix it until it passes or reaches limits.
8. Run final HTML-only deck render and show the result in `ReviewPage`.

## Confirmed Boundaries

- The Agent is a local writable Agent. It can read and modify local files.
- The frontend starts/drives Agent Sessions through Anna Runtime, but the Agent itself modifies files.
- No extra in-app authorization modal is needed; rely on Anna/Agent runtime permissions.
- The frontend must not directly read/write local files. Backend app-facing tools handle workspace artifact writes and render/screenshot tasks.
- `ppt-app` should use real Anna locally. The user has already run `anna-dev login`.
- It is acceptable to test with `anna-app dev`; run `npm run build` first. If the bridge errors with `python bridge did not signal ready in 8s`, retry startup a few times.
- Anna app-side `anna.agent.session({ submode: "auto" })` currently does not support `ttl_seconds`; session lifetime must be managed by `ppt-app`.

## Artifact Model

- `outline.json`: LLM-generated content outline.
- `page-plan.json`: LLM-generated plan mapping each outline page to a template blueprint and target files.
- `page-progress.json`: current per-page authoring/render/self-review state.
- `pages.json`: final rendered HTML page result for ReviewPage/recovery.
- `.log/*.jsonl`: detailed attempt logs.
- `task.json.artifacts` should list `page_plan` and `page_progress` in addition to the older task/setting/outline/pages artifacts.

Do not overload `pages.json` with planning or progress state.

## AI Call Logging

Agent and LLM calls should write local JSONL logs under the workspace `.log/` directory so failures can be debugged outside the Anna RPC Log panel.

Use two Agent log layers:

- `.log/ai-page-agent.jsonl`: one structured summary per Agent Run, including `run_id`, `page_id`, run kind, prompt hash or prompt summary, start/end timestamps, completed/error/expired status, final text, parsed summary or parsed review when available, changed files, error message, and token usage when available.
- `.log/ai-page-agent-stream.jsonl`: compressed stream events, not every protocol chunk. Record merged model content deltas, tool activity summaries such as `fs_read_file` / `fs_write_file` path and size, error events, and task completion metadata.

Do not default to storing every raw `rpc.stream` chunk. Full raw streams are noisy, large, and may persist workspace paths, prompts, and file contents. A separate debug switch can be added later if exact wire-level traces are needed.

## Page Plan

The frontend calls Anna LLM to generate `page_plan`. The backend only records and validates it, then prepares files from it.

Minimal `page-plan.json` direction:

```json
{
  "version": 1,
  "status": "planned",
  "title": "Deck title",
  "source": {
    "outline_updated_at": "ISO timestamp",
    "template_group": "red-finance-v3",
    "template_manifest_path": "/abs/path/template/manifest.json",
    "generated_by": "llm.complete"
  },
  "pages": [
    {
      "page_id": "page-01",
      "index": 0,
      "title": "Page title",
      "outline": "Page goal",
      "blueprint_id": "cover-statement",
      "blueprint_source": "./blueprints/CoverStatement.tsx",
      "slide_path": "./slides/page-01-cover.tsx",
      "data_path": "./data/page-01-cover.json",
      "manifest_slide_id": "page-01-cover",
      "reason": "Why this blueprint fits"
    }
  ],
  "updated_at": "ISO timestamp"
}
```

Backend validation:

- `pages.length` equals outline length.
- indexes are continuous.
- `blueprint_id` exists in `template/catalog.json`.
- `slide_path` must be `./slides/*.tsx`.
- `data_path` must be `./data/*.json`.
- paths stay inside the selected workspace template directory.
- `manifest_slide_id` values are unique.

## Page File Preparation

- Backend reads `page-plan.json`.
- Backend copies the selected `blueprints/*.tsx` to `slides/page-XX-*.tsx`.
- Backend writes minimal initial `data/page-XX-*.json`, not full Schema-specific business data.
- Initial data should contain page intent and plan metadata, for example title, outline, speaker note, and `_plan`.
- Backend rewrites `manifest.json.slides` completely from `page-plan.json`.
- The manifest should reference only generated `./slides/*.tsx` entries.
- Existing demo slides/data can remain on disk but must not be referenced by manifest.
- Runtime binding must use each manifest slide id/page id as the unique Page Runtime Identity. Do not rely on the template `layoutId` as a unique runtime key because multiple generated pages can share the same blueprint/layout id.
- A generated page's exported `layoutId` keeps its template/blueprint meaning; it does not need to be rewritten just to make runtime registration unique.

## Agent Session Model

- Agent Sessions are short-lived operational resources, not deck/page state.
- Use one short-lived Agent Session per Agent Run. Authoring, self-review, self-review-fix, and render-fix each create a session, run once, then delete promptly.
- Record session `createdAt` and returned `expires_in`; if a session has less than 60 seconds remaining, delete/recreate before starting the next run instead of waiting for a 401.
- If an Agent stream reports session/token expiry, close the stale session, create a new `anna.agent.session({ submode: "auto" })`, and retry the current run with the same prompt.
- Agent Infrastructure Failures such as session mint 429, token expiry, or transport/session failures must not consume the per-page `agent_failures` content-authoring limit.
- Record Agent Infrastructure Failures separately from content authoring failures. `agent_failures` remains the content/run failure counter; infrastructure/session failures use their own status/counter.
- A page blocked by Agent infrastructure should use a distinct progress state such as `agent_infrastructure_failed`, not `agent_failed`.
- If session minting fails with the dev-mode active session cap, surface a session infrastructure error that tells the user old sessions must be deleted/revoked or the dev harness restarted.
- In current `anna-app dev`, `agent.session.delete` can only delete server-side sessions while the dev process still has the minted session token cached. After restarting `anna-app dev`, unknown old session UUIDs cannot be deleted by the app-side delete call; they require server-side revoke/cleanup or whatever cleanup mechanism Anna provides.
- Each Agent Run should only work on the current page unless explicitly needed.

Default file modification scope:

- Allowed by default:
  - current `template/slides/page-XX-*.tsx`
  - current `template/data/page-XX-*.json`
- Allowed only with reason:
  - `template/components/*.tsx`
  - `template/theme/*.ts`
  - current manifest slide entry if absolutely necessary
- Read-only:
  - `template/blueprints/`
  - `template/reference-slides/`
- Backend-owned:
  - `.log/`
  - `output/`
  - `outline.json`
  - `page-plan.json`
  - `page-progress.json`
  - `pages.json`
- Never modify workspace-external files.

## Agent Return Protocol

Agent authoring/fix runs should preferably return a small JSON summary, not full TSX:

```json
{
  "status": "ready_for_render",
  "changed_files": ["template/slides/page-03-market.tsx"],
  "summary": "What changed",
  "needs_render": true,
  "notes": []
}
```

Blocked example:

```json
{
  "status": "blocked",
  "changed_files": [],
  "summary": "Why blocked",
  "needs_render": false,
  "notes": ["What is needed"]
}
```

Authoring/fix JSON is telemetry only, not a hard gate. The actual authoring gate is: the Agent stream completes without a runtime/session error, then backend render validates the file state. If authoring output can be parsed as JSON, record it as structured summary; if not, record the raw final text and continue to render. This avoids failing pages where the Agent successfully edited files but returned a non-JSON final summary.

Self-review output remains a hard JSON contract because it decides whether the page is accepted or needs another fix.

## Render/Screenshot/Self-Review Loop

- Render errors must be sent back to the Agent for current-page repair.
- Screenshot self-review failures must be sent back to the Agent for current-page repair.
- Final page failure only occurs after page-level limits are exhausted.

Limits:

- Render repair limit: 10 per page.
- Visual self-review repair limit: 3 per page.
- Agent content-authoring/run failure limit: 3 per page.
- Agent Infrastructure Failure limit is separate from the page content-authoring limit and should be handled as an operational failure.

Checks:

- Backend performs hard checks: render succeeded, wrapper status ready, PNG exists/non-empty, expected dimensions, optional blank/solid-color guard.
- Agent performs subjective visual review: follows outline, complete PPT page, no overlap/cutoff/blank areas, readable text, template consistency.

Self-review JSON:

```json
{
  "pass": true,
  "score": 8,
  "issues": [],
  "revision_request": "",
  "confidence": "medium"
}
```

Pass requires `pass: true` and `score >= 7`.

## Lightweight Screenshot Requirement

Do not use the old heavy screenshot/PPT model pipeline for app-facing page review.

Add a lightweight single-page screenshot function/tool that only:

- reads manifest,
- prepares one page,
- renders the page in Puppeteer,
- screenshots `#presentation-slides-wrapper`,
- writes one PNG.

It must not generate PPT model, extract screenshot fallback assets, or loop the whole deck.

Suggested app-facing tool name: `app_render_workspace_page_preview`.

## Prompt Strategy

- Workspace files are available to the local Agent by path. Give paths and require the Agent to read them.
- Repo `.docs` files may not exist on user machines. Include a hand-written compact rules summary in prompt code.
- First version should hand-write fixed rule summaries, not auto-extract from `.docs`.

Rules summary must cover:

- fixed 1280x720 slide,
- required exports: `Schema`, default component, `layoutId`, `layoutName`, `layoutDescription`,
- content should come from data where practical,
- manifest references only `./slides/*.tsx`,
- do not modify `blueprints` or `reference-slides`,
- key text stays as real DOM text,
- avoid fragile mixed inline text, pseudo-elements, critical gradients, critical opacity/transform tricks,
- chart/graphic regions may use `data-pptx-export="screenshot"` while key text remains DOM,
- local imports should use `.js` suffix.

Language:

- Output content follows `setting.output_language` / `setting.language`.
- Fall back to UI locale.
- JSON field names and protocol schemas stay stable/English.

No research phase in v1:

- Do not require web/data retrieval.
- Do not invent verifiable facts/sources.
- Use illustrative numbers as illustrative/internal estimates when needed.

## UI/UX

- Do not show only a spinner.
- Add a coarse generation progress UI:
  - outline,
  - page planning,
  - file preparation,
  - per-page authoring,
  - render fixing attempts,
  - visual self-review attempts,
  - accepted/failed/cancelled.
- No token-level stream UI required in v1.
- Add soft cancel:
  - set a cancel flag,
  - let the current non-cancellable call return,
  - stop before next step/page,
  - preserve artifacts and mark cancelled.
- Default resume behavior: continue from first not accepted page. If prompt/settings/template changed, downstream artifacts become stale and should restart from outline/page plan.
- When workspace setting `slide_count` is `auto`, an explicit page count in the user's prompt still wins and should be used for LLM outline validation.

Generation UI should show readable streaming progress, not raw RPC logs:

- Show current phase and page, for example Agent editing, reading files, writing files, waiting for output, rendering, or reviewing.
- Show merged model text from `choices[].delta.content` for the current page, capped to a recent window such as the last 30 lines.
- Show a compact recent activity list for tool activity and errors, for example reading `catalog.json`, writing a page TSX/data file, or Agent session token expiry.
- Keep completed pages collapsed to status, attempts, and final summary. Only the current page needs expanded streaming detail.
- Do not display raw tool argument fragments, full prompts, or every `rpc.stream` chunk in the UI. Detailed diagnosis belongs in `.log/`.

## Manifest / Runtime

- Add Anna agent grant in `ppt-app/manifest.json`:
  - keep `llm: ["complete"]`,
  - add `agent.session.auto`.
- Validate against current `anna-app` schema; if strict schema rejects agent key, inspect supported manifest shape.

## Suggested Implementation Slices

1. Backend app-workspace artifacts/tools:
   - planning context,
   - record/get page plan,
   - prepare page files,
   - get/record page progress,
   - lightweight single-page preview/screenshot.
2. Frontend runtime/clients:
   - Anna agent runtime type,
   - AgentClient,
   - page plan LLM prompt/parser.
3. Frontend orchestrator/progress UI:
   - outline -> page plan -> prepare files -> per-page Agent loop -> final HTML-only render.
4. Build and run real Anna with `npm run build` then `anna-app dev`; inspect through Chrome MCP.
