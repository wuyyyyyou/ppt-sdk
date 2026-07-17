---
status: accepted
---

# Outline is a required independent Workspace stage

Outline is a required Workspace stage between Confirmed Presentation Requirements and downstream Deck Generation. Presentation Requirements Confirmation clears the current Outline and automatically starts Outline Creation; the resulting valid Outline Draft must always pass through Outline Review and explicit Outline Confirmation before downstream work begins.

Outline Creation and Rewrite Requests consume Confirmed Presentation Requirements directly, without legacy context rows or Outline-owned output language, and run before template handling or visual theme creation. The Outline artifact owns only its title, lifecycle, and ordered entries; each entry contains a title, Core Message, and Required Content Markdown.

Manual edits remain local until Save or Outline Confirmation, while successful Rewrite Requests save automatically. `ppt-engine` owns deterministic Outline validation and the unified save and confirmation operations that also synchronize Presentation Requirements `slide_count` and the Workspace title. Existing legacy Outline tools and schemas are removed rather than migrated during local development.

**Consequences**

- Outline lifecycle is `empty`, `draft`, or `confirmed`; transient creation and failure states remain UI and interaction-log concerns.
- Outline Review supports editing the presentation title, editing all entry fields, adding and deleting entries, and reordering entries.
- Every persisted Outline Draft and Confirmed Outline is complete and valid: the title is non-empty, at least one entry exists, every entry has a one-line title and Core Message, and Required Content contains at least one non-empty line. Outline Review accepts plain lines or Markdown list markers and deterministically normalizes every saved line into the canonical `- ` list form.
- Outline page count is flexible. Saving a valid Outline synchronizes the confirmed Presentation Requirements `slide_count` to the saved entry count without reopening Presentation Requirements Review.
- During Active Deck Generation, navigation away from generation and Outline editing are disabled. After generation completes, a saved Outline Draft may coexist with the previous Deck until the user confirms the Outline; confirmation replaces the old generation state and starts full regeneration.
- The Workspace stores only the current Outline and does not retain a separate prior Confirmed Outline or parallel Deck version.
