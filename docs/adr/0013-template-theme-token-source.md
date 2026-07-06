# Template theme token source

Tokenized presentation templates use template-local theme token files as their theme source. A workspace reads `theme/token.json` first and falls back to `theme/token.default.json`. Source templates commit `theme/token.schema.json`, `theme/token.default.json`, and `theme/README.md`; source templates do not commit `theme/token.json`. Forking a tokenized template initializes workspace `theme/token.json` from `theme/token.default.json`.

`manifest.theme.colors` remains the compatibility path for non-tokenized templates, but tokenized templates do not read from it. The `red-finance-v3` template is the pilot and removes `manifest.theme` entirely. The app's existing preset theme selection is ignored for tokenized templates in this phase; LLM-generated theme token creation is a later phase.

Each tokenized template owns its first schema. Shared schema extraction can happen after multiple templates have converged on common fields. For `red-finance-v3`, components consume semantic CSS variables derived from token paths, such as `--theme-color-canvas` and `--theme-shadow-card`. The render layer also injects RGB variables for hex colors, such as `--theme-color-accent-rgb`, so templates can use controlled alpha helpers without hardcoding colors.

**Considered Options**

- Keep using `manifest.theme.colors` as the main source. Rejected because it keeps template theme state split between manifest data and component tokens.
- Commit both `token.default.json` and `token.json` in source templates. Rejected because the two files would drift while representing the same default theme.
- Introduce a global token schema immediately. Rejected because the pilot fields are template-specific and should not become a premature cross-template contract.
- Map the existing preset theme into `token.json` for tokenized templates. Rejected for this phase because it would keep the fixed preset system influencing the new token source.

**Consequences**

- Tokenized template detection is based on the presence of token files under `theme/`.
- Fork/build tooling must preserve token files and initialize workspace `token.json`.
- Rendering must load token files and inject semantic CSS variables before component render.
- Template data should not provide colors by default; chart and fallback visuals should use token-controlled defaults unless a business-specific override is explicitly needed.
- Hardcoded color scanning is deferred; the pilot migration relies on review and focused template changes first.
