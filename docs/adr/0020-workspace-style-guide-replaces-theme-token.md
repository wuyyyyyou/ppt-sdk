---
status: accepted
---

# Workspace Style Guide replaces runtime theme tokens

Workspace Style Guide Creation will synthesize the user's style intent and deck context into a Workspace-owned style guidance artifact before Page Authoring. The artifact may contain exact palette and typography values together with qualitative visual rules and allowed variation; every Page Authoring Agent reads it and implements the chosen values in its Page Source rather than relying on renderer-injected theme variables.

Creation receives the original Brief together with the Confirmed Presentation Requirements and Confirmed Outline. The Brief remains useful original user context, but the prompt must identify the later confirmed artifacts as authoritative when their wording conflicts with the Brief. Style Profile features are sealed during the first Page Source migration and are not parallel inputs.

Workspace Style Guide Creation uses a normal LLM completion rather than an Agent session. The PPT App assembles the prompt and receives the Markdown, then transports it to the engine for persistence. The model does not read or edit local files and does not need Agent file-tool access; Page Authoring remains the stage that uses file-editing Agent sessions. Style Guide completions and retries use their own `style-guide` AI logging domain.

The Style Guide prompt does not inspect or inline the Workspace Authoring Kit, Foundation Modules, or Reference Library. It only states the fixed medium constraints needed for actionable visual guidance: the output is a PPT deck, each page is implemented as a TSX Page Source, and the slide canvas is 1280 by 720. Page Authoring Agents, not Style Guide Creation, inspect the Authoring Kit when implementing individual pages.

The prompt asks the model to prefer common system fonts but does not require explicit fallback font stacks. Browser, HTML-to-PPTX, and presentation-viewer font fallback is accepted; the workflow does not maintain a font allowlist or check whether a named font is installed.

Creation receives up to three normal LLM completion attempts when the call fails or returns blank text. Retries resend the complete prompt and may note that the previous attempt did not produce a non-empty Style Guide; they do not parse the Markdown or construct content-specific repair instructions. Exhausting the three attempts blocks Page Authoring. A later user retry or Deck Generation Resume starts a fresh three-attempt budget.

The first workflow implementation uses artifact existence as the readiness gate instead of maintaining dependency fingerprints or separate freshness metadata. Deck Generation Resume reuses the existing Workspace Style Guide. Changing Visual Tone or reconfirming an Outline whose title, page set, or page intent changed deletes the existing artifact; the next generation run creates a new one. Reordering otherwise unchanged Outline entries does not invalidate it.

Workspace Style Guide Creation is an automatic blocking generation step with no separate user confirmation stage in the first implementation. Page Authoring starts only after a non-empty artifact has been written. Creation failure is recoverable by retrying or resuming the generation workflow, but it never falls back to a default style guide.

The Workspace Authoring Kit is installed before Style Guide Creation, but Page Sources are created or reset only after the Style Guide succeeds. This prevents a failed Style Guide completion from modifying current Page Sources and gives Deck Generation Resume a clean pre-authoring recovery point.

No separate Style Guide status artifact is introduced. A non-empty `style-guide.md` is the readiness fact, while `page-progress.json` top-level recovery records whether creation is running, failed, or interrupted and the `style-guide` AI Interaction Log records individual completion attempts. Resume rechecks the file rather than trusting recovery metadata as proof of readiness.

Deck Generation Resume may recreate a missing Style Guide only before Page Authoring has begun. If any Page Generation Unit has advanced beyond its initial pending state, a missing Style Guide makes the generation unresumable because a newly generated document could differ from the visual authority used by existing pages; the user must return through Outline Confirmation and start a new full generation.

Invalidation is owned atomically by the engine operations that change Style Guide inputs. Updating Presentation Requirements deletes the artifact when Visual Tone changes. Ordinary Outline persistence—manual Draft save, Rewrite Request automatic save, and Confirmation—compares the currently persisted Outline with the incoming normalized content and deletes the artifact when the deck title, page set, or page intent changes, but not when otherwise unchanged entries are only reordered. Deck Refinement Commit is the explicit exception: its prepared planning decision chooses whether to preserve or replace the Style Guide while reconciling the Outline, so the ordinary automatic invalidation rule must not override that decision. This avoids retaining accidental stale guidance in normal Outline Review without forcing every content-only Deck Refinement into a whole-deck style rewrite.

Outline invalidation is a deterministic comparison of normalized artifacts rather than an LLM semantic judgment. Because every Outline Confirmation assigns fresh page identities, the engine compares the deck title and the multiset of normalized entry `title`, `core_message`, and `required_content` values without using `page_id` or array order. A changed title, changed page content, added page, or deleted page invalidates; reordering otherwise identical entries does not. Timestamps and other lifecycle metadata are ignored.

The authoritative artifact is the fixed Workspace-root file `style-guide.md`; it is not stored inside the read-only Workspace Authoring Kit. The PPT App transports generated Markdown to `ppt-engine` as a `text/markdown` Host Upload, and the engine checks only that the content is non-empty before atomically committing it to the fixed path. The workflow deliberately does not impose required Markdown sections or attempt deterministic design-quality validation; prompt quality and the LLM response own the document's detail. The Host Upload is transport only and is never retained as the Page Authoring reference. The commit operation returns a bounded receipt such as the canonical path, byte size, SHA-256, and update time instead of returning the Markdown or a full Workspace snapshot.

This supersedes ADR-0013 and ADR-0014: Template Theme Contracts, Workspace Theme Tokens, JSON Schema theme validation, token fallback, and runtime theme injection are removed. A changed Workspace Style Guide makes affected Page Sources stale and requires re-authoring and review instead of theme-only rerendering.

**Considered Options**

- Keep Theme Token as the sole style source. Rejected because a fixed JSON shape cannot express visual hierarchy, proportional use, semantic restrictions, typography character, composition guidance, and page-level creative freedom with enough fidelity.
- Keep both a Style Guide artifact and generated Theme Token. Rejected because they would create two style sources that can drift and would preserve runtime coupling in Foundation Modules and Reference Implementations.

**Consequences**

- Foundation Modules expose explicit visual inputs or inherit Page Source styles instead of importing a shared theme object.
- Reference Implementations use neutral fallbacks and are adapted according to the Workspace Style Guide.
- The PPT App owns Style Guide generation and persistence; the rendering engine provides no default, fallback, format-specific storage contract, readiness gate, or runtime dependency on it.
- The workflow owns invalidation by deleting the Workspace Style Guide when one of its visual or deck-context inputs changes; no parallel stale marker is required in the first implementation.
- The Workspace Style Guide may be inspected as a Workspace artifact, but the first implementation does not introduce a dedicated review page or confirmation lifecycle.
- Page Authoring reads the local Workspace `style-guide.md`; it never reads the temporary Host Upload object used to create it.
- A Deck Refinement that replaces the Workspace Style Guide re-authors every retained page, even when its Outline Entry is otherwise unchanged. This is accepted because a shared visual-direction change can affect composition, hierarchy, spacing, image treatment, and typography, and retaining old Page Sources would mix two visual authorities in one Deck.
- Deck Refinement Style Guide generation receives the current Workspace Style Guide as its baseline together with the refinement request and reconciled deck authorities, but returns one complete replacement Markdown document rather than a patch. Unrequested visual rules should remain stable so refinement does not introduce arbitrary style drift.
