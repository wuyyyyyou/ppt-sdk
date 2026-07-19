---
status: accepted
---

# Prepare Deck Refinement before committing Workspace state

Deck Refinement enters the visible generation experience immediately after submission, but its page reconciliation and replacement Workspace Style Guide are prepared before any accepted Workspace authority is changed. Only a fully prepared result is committed as the new active generation state; planning or Style Guide failure leaves the existing Outline, Style Guide, Page Sources, progress, and rendered Deck intact.

**Consequences**

- Deck Refinement Preparation reports progress in the generation UI even though it has not yet changed authoritative Workspace artifacts.
- Deck Refinement Planning remains text-grounded: it uses the request, Brief, Confirmed Presentation Requirements, Confirmed Outline, and current Workspace Style Guide, but does not inspect rendered screenshots, HTML, or Page Source code. Current-page visual context is consumed later by the targeted Page Authoring run.
- Deck Refinement Planning uses up to three complete parse, deterministic-validation, and repair attempts. Tolerant JSON extraction may recover JSON from code fences or surrounding text, but a syntactically valid response is accepted only after its route, Style Guide decision, ordered operations, existing page coverage, page identities, and complete Outline Entries satisfy the planning contract.
- Reconciled Deck titles and Outline Entry content use the current confirmed output language, or the explicit new output language when the refinement changes it, regardless of the language used to submit the request. Internal planning and page-level reason fields may remain English for consistent downstream prompting and diagnostics.
- Planning `update` and `add` operations use the same structured Outline Entry contract as Outline Creation: one-line `title`, one-line `core_message`, and a non-empty array of single-line `required_content` strings. Validation converts the array into the Workspace Markdown representation only after the complete planning result passes.
- Planning and replacement Style Guide generation can be retried without recovering or rolling back a partially modified Deck.
- Preparation failure offers a full retry from Deck Refinement Planning or a return to the unchanged accepted Deck; it is not presented as Resume. A planning-level `no_op` returns to the Deck as a successful no-change result rather than a failure.
- The Deck Refinement Commit is the boundary after which interruption is persisted and continued through Deck Refinement Resume.
- Commit reconciles the Confirmed Outline, Workspace Style Guide decision, Manifest, Page Progress, added Page Source Bootstraps, removed active pages, target-page recovery information, and invalidated final render as one active generation transition.
- Commit prevalidates every artifact, prepares temporary files, replaces official files only after preparation succeeds, and rolls back ordinary tool-call failures. It does not introduce a transaction journal or promise crash-atomic multi-file replacement if the engine process is forcibly terminated between filesystem operations.
- Deck Refinement uses a dedicated app-facing commit operation rather than a generic refinement tool with optional shared-artifact mutations. The operation owns Outline, output-language, Style Guide, Manifest, added Page Source, Page Progress, recovery, and final-render reconciliation as one explicit boundary.
- Commit resets each target page's execution status, attempt budgets, errors, and review result while temporarily preserving its last successful HTML and screenshot as refinement baseline context. A new successful render replaces those references; added pages start without a baseline, and unaffected pages retain their accepted progress unchanged.
- Every committed refinement target must produce a real Page Source fingerprint change, with bounded no-change repair before failure. `keep` pages that are not global language or Style Guide targets do not run Page Authoring, while planning-level `no_op` commits nothing.
- The Deck Refinement Request and target page's planning reason remain present through initial authoring, no-change repair, render repair, and visual-review repair. Later repair instructions address technical or usability failures without superseding the committed refinement intent.
- Resume reuses the existing `page-progress.json` top-level recovery record for only the run kind, active step, target page ids, refinement request, and page-level reasons. No separate recovery or refinement-plan artifact is introduced, and the complete LLM planning response is not copied into Page Progress.
- After commit, Deck Refinement is forward-recovering rather than transactional rollback: completed target pages remain accepted, failed and unstarted targets remain resumable, and the invalidated previous final Deck render is not promoted as the current result. A new final render is created only after every active page is accepted.
- A committed refinement containing only deletion, reordering, or Deck-title changes skips Page Authoring for retained pages and proceeds directly to Final Deck Render. Added pages always require authoring, while output-language or Workspace Style Guide changes target every retained page.
