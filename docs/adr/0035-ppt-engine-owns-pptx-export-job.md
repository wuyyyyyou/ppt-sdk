---
status: accepted
---

# ppt-engine owns the complete PPTX export job

PPTX export will be one `ppt-engine` backend job that validates the existing `deck.html`, converts it with `dom-to-pptx` in managed headless Chrome, atomically publishes `output/deck.pptx`, and records the Workspace Export Artifact before reporting completion. The PPT App frontend only starts the job and polls its status; it does not prepare a PPTX model, invoke a second generator, transfer file bytes, or separately record the completed artifact.

The public job states are `idle`, `queued`, `validating`, `converting`, `completed`, and `failed`. This replaces the current frontend-orchestrated `ppt-engine` model preparation, `ppt-gener` generation, and `ppt-engine` artifact-recording sequence, preventing a frontend interruption from leaving a generated PPTX unrecorded.

Each Workspace has at most one active PPTX export job. Repeated starts while the job is queued, validating, or converting return that job, while a completed or failed job may be followed by a new attempt. A single `ppt-engine` process executes at most one PPTX conversion at a time and queues jobs from different Workspaces in arrival order to bound Chrome and Blob memory; an active conversion is not implicitly cancelled by another start request.

The backend job continues independently of the current frontend page or connection. After an Executa process restart, a persisted `queued`, `validating`, or `converting` job is failed rather than resumed from partial queue, browser, or file state; a new attempt cleans its fixed temporary output and starts from the validated Deck HTML.

A Workspace has only one current PPTX and no Export History. Starting a replacement export invalidates and removes the previous PPTX artifact record rather than retaining it as fallback; success publishes the new fixed `output/deck.pptx`, while failure leaves no valid PPTX. The job may still write a temporary file and atomically rename it solely to prevent a partial ZIP from being exposed as the current artifact.

Runtime output validation is intentionally minimal: conversion must succeed, transferred byte accounting must match, output must be non-empty, and the file must begin with a ZIP signature before atomic publication. Deeper OOXML, page-count, and rendering validation belongs to tests and Binary smoke rather than every export job.

Converter and browser warnings are captured as structured backend diagnostics associated with the job and page where possible. The first frontend contract shows only success or failure and does not expose a warning list; a condition that makes the artifact materially incomplete must fail the job rather than be hidden as a warning.

Export uses bounded backend timeouts and exposes no user-configurable timeout in the first frontend contract. Timeout closes the managed browser resources, removes temporary output, and fails the job; concrete limits remain implementation configuration informed by real Deck measurements.

The generated presentation title uses the current Workspace Deck title, while author metadata remains unset and is not inferred from the user, machine, Brief, or paths. The authoritative Workspace filename remains `output/deck.pptx`; the existing Export Artifact layer derives the sanitized user-facing download filename.

The Executa exposes only the Workspace-owned PPTX export job, not a general arbitrary HTML-path-to-PPTX tool. The Deck HTML conversion Module remains internal so callers cannot bypass the fixed Deck contract, output ownership, validation, and Export Artifact lifecycle; development scripts and tests may call that internal Module directly.

The public PPTX tools are `app_start_pptx_export` and `app_get_pptx_export_status`, each accepting only `workspace_dir`. The migration deletes the old export-model preparation, model-job start, generator invocation, and separate artifact-recording tools without compatibility aliases.

The PPTX frontend action starts this job directly and does not pre-load, refresh, or rebuild Deck HTML as a fallback. Normal Final Deck Render and explicit review refresh own Deck regeneration; a missing or invalid recorded Deck document is surfaced by the export job.

Failure records structured stage, page-local diagnostics, and warnings in existing Workspace/backend logs but creates no export-specific HTML, screenshot, Blob dump, or other diagnostic artifact. Troubleshooting that needs files uses the existing Workspace Diagnostic Bundle.

Each Workspace persists the compact asynchronous job receipt at `output/pptx-export.json` with schema version 2 so polling, frontend reconnection, queue ownership, and interrupted-process detection survive the initiating call. It contains job status, timing, current PPTX path, bounded error data, and warning count but no model path, model-ready stage, or generator result; legacy `generate_ppt.json` is neither read nor migrated.

The job retains a monotonic user-facing `percent` as staged pseudo-progress rather than measured converter progress. Queueing and validation use fixed early milestones, conversion may advance gradually but never reaches completion prematurely, and only a successfully recorded Export Artifact reports 100%; the UI does not infer remaining time from this value.

The first contract has no PPTX export cancellation tool or frontend cancel action. An active job ends through success, failure, timeout, or process termination; repeated starts return it instead of spawning replacement work.
