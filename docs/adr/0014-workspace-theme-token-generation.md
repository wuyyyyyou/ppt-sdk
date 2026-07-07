# Workspace theme token generation

PPT App generation uses Workspace Theme Creation to create a Workspace Theme Token from the selected Template Theme Contract, the user's brief, and general context rows. The fixed `theme_id` and preset theme catalog are no longer part of the generation theme source, and Context Suggestion no longer returns a theme field.

Workspace Theme Creation runs after template selection and Context Suggestion, before Uploaded Source Analysis, and does not use uploaded-source analysis results or optional token preset files. Its template-side inputs are the theme schema, default token, and theme README; template implementation files and preset token variants are not prompt inputs. The generated token must satisfy the selected Template Theme Contract; if generation retries fail, the workspace uses the template default theme token and continues, while a missing Template Theme Contract blocks generation instead of falling back to legacy manifest theme data.

Default-token fallback is user-visible through a lightweight notification or generation status message, while detailed failure reasons remain in the AI Interaction Log.

Theme creation is a lightweight user-visible generation step so users can see progress while the theme token is being generated.

Theme creation does not expand the existing cancellation boundary for generation preflight work. In this phase it follows the current pre-deck-generation behavior: once the theme step starts, a successful result may be written, and broader cancellation support for preflight steps is left to a separate design.

Deck Refinement Intent Review may decide that a whole-deck theme change is required. Theme-only Deck Refinement is valid: accepted pages stay accepted and are not re-authored solely for a theme change, but final rendering must run again because the deck-level theme source changed.

When Deck Refinement rewrites the theme, the current Workspace Theme Token is included as the refinement baseline alongside the theme schema, default token, theme README, and refinement request. The model returns the Workspace Theme Token JSON directly, with no envelope, rationale field, or patch format; every successful generation is a complete replacement token.

Theme generation uses the existing AI Interaction Log pattern with a dedicated operation for theme-token generation attempts, validation errors, retries, success, and default-token fallback. The Workspace Theme Token artifact stores only the final token JSON, not explanatory rationale.

No separate workspace status artifact is created for theme generation. The authoritative theme artifact is the Workspace Theme Token itself; process details belong in AI Interaction Log entries.

Workspace theme contract reads, token validation, and token writes are owned by `ppt-engine` app-facing tools. `ppt-app` orchestrates the LLM generation and retries through `PptBackend`, but does not directly read or write workspace template files.

Template Theme Contract validation uses a standard JSON Schema validator, such as Ajv with Draft 2020-12 support, rather than a handwritten partial validator. The current token schemas already use standard JSON Schema features including `$defs`, `$ref`, `const`, `enum`, `required`, `additionalProperties`, `pattern`, and `minLength`.

**Considered Options**

- Keep fixed `theme_id` selection in Context Suggestion. Rejected because it keeps the old preset system as a hidden source of theme truth.
- Use Uploaded Source Analysis as theme-generation input. Rejected for this phase because theme creation should not wait on source parsing and brand-file interpretation needs its own design.
- Treat theme-generation failure as deck-generation failure. Rejected because the template default theme is a valid baseline and should allow generation to continue.
- Let `ppt-app` directly read and write the theme token file. Rejected because workspace file access belongs behind `PptBackend` and the engine can enforce template-directory containment and contract validation.
- Handwrite a limited schema validator for theme tokens. Rejected because the theme contracts are already standard JSON Schema documents and partial validator behavior would be harder to trust and maintain.
