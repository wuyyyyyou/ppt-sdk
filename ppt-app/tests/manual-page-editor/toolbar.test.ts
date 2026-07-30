import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { messages } from "../../src/i18n/messages";

const SHELL = "src/features/manual-page-editor/ManualPageEditorShell.tsx";
const STYLES = "src/features/manual-page-editor/manual-page-editor.css";

async function shellSource(): Promise<string> {
  return readFile(path.resolve(SHELL), "utf8");
}

describe("manual page editor toolbar", () => {
  it("no longer offers an opacity control", async () => {
    const source = await shellSource();
    const styles = await readFile(path.resolve(STYLES), "utf8");

    assert.doesNotMatch(source, /style\.opacity/);
    assert.doesNotMatch(source, /"opacity"/);
    assert.doesNotMatch(source, /type="range"/);
    assert.doesNotMatch(styles, /manual-toolbar-popover\.opacity/);
    for (const locale of ["en", "zh"] as const) {
      assert.ok(!("opacity" in messages[locale].manualEditor));
    }
  });

  it("puts line height and space after on the toolbar with their own icons", async () => {
    const source = await shellSource();

    assert.doesNotMatch(source, /togglePopover\("paragraph"\)/);
    assert.match(
      source,
      /manual-toolbar-field" title=\{t\.lineHeight\}>\s*\n\s*<AlignVerticalSpaceAround/,
    );
    assert.match(
      source,
      /manual-toolbar-field" title=\{t\.spaceAfter\}>\s*\n\s*<AlignVerticalJustifyStart/,
    );
    // A divider separates the paragraph controls from the alignment buttons.
    assert.match(
      source,
      /t\.alignRight[\s\S]*?<span className="manual-toolbar-divider" \/>[\s\S]*?title=\{t\.lineHeight\}/,
    );
    // The icon replaces the visible label, so the select still needs a name.
    assert.match(source, /manual-toolbar-select line-height" aria-label=\{t\.lineHeight\}/);
    assert.match(source, /manual-toolbar-select space-after" aria-label=\{t\.spaceAfter\}/);
    assert.match(source, /element\.style\.lineHeight = event\.target\.value/);
    assert.match(source, /element\.style\.marginBottom = `\$\{event\.target\.value\}px`/);
  });

  it("keeps only the popovers that still exist", async () => {
    const source = await shellSource();

    assert.match(source, /type ToolbarPopover = "fill" \| "border" \| "more" \| null;/);
    for (const locale of ["en", "zh"] as const) {
      const editor = messages[locale].manualEditor;
      assert.ok(!("paragraph" in editor));
      assert.ok(editor.lineHeight.length > 0);
      assert.ok(editor.spaceAfter.length > 0);
    }
  });
});
