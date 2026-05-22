# PPT App Glossary

This context defines the project language for the PPT authoring workflow and keeps the terms stable across UI, prompts, and artifacts.

## Language

**Workspace**:
The container for one PPT request and its artifacts.

**Brief**:
The user's initial input that describes what the deck should cover.

**Outline**:
An ordered list of slide-level entries, each with a title and a short outline.

**Outline Draft**:
An outline that is still open to manual edits or LLM revision.

**Confirmed Outline**:
An outline that has been accepted for downstream generation.

**Outline Review**:
The user step where the outline is inspected, edited, or revised before continuing.

**Template**:
The selected visual style family used to shape the deck.

**Page Plan**:
The slide-by-slide mapping from outline entries to planned pages.

**Deck**:
The finished presentation content before export.

## Example Dialogue

Dev: "The workspace has a draft outline, but not a confirmed outline yet."

Expert: "Good. Let the user review the outline first, then confirm it before creating the page plan."

Dev: "If they edit the outline after confirmation, what happens?"

Expert: "It becomes a draft again until they confirm it one more time."
