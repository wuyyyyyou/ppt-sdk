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

  it("uses one crop action instead of image-fit modes", async () => {
    const source = await shellSource();
    const styles = await readFile(path.resolve(STYLES), "utf8");

    assert.match(source, /manual-editor\.image\.crop/);
    assert.match(source, /manual-editor\.image\.reset-crop/);
    assert.doesNotMatch(source, /manual-toolbar-select image-fit/);
    assert.doesNotMatch(source, /style\.objectFit = event\.target\.value/);
    assert.doesNotMatch(styles, /manual-toolbar-select\.image-fit/);
    for (const locale of ["en", "zh"] as const) {
      const editor = messages[locale].manualEditor;
      assert.ok(editor.cropImage.length > 0);
      assert.ok(editor.resetCrop.length > 0);
      assert.ok(!("imageFit" in editor));
      assert.ok(!("imageFitCover" in editor));
      assert.ok(!("imageFitContain" in editor));
      assert.ok(!("imageFitFill" in editor));
    }
  });

  it("keeps insert actions at the far left and commits an active crop first", async () => {
    const source = await shellSource();
    const toolbarStart = source.indexOf('className="manual-editor-toolbar"');
    const addText = source.indexOf('manual-editor.element.add-text', toolbarStart);
    const addShape = source.indexOf('manual-editor.element.add-shape', toolbarStart);
    const addImage = source.indexOf('manual-editor.element.add-image', toolbarStart);
    const undo = source.indexOf('manual-editor.undo', toolbarStart);

    assert.ok(toolbarStart >= 0);
    assert.ok(toolbarStart < addText && addText < addShape && addShape < addImage && addImage < undo);
    assert.doesNotMatch(
      source.slice(toolbarStart, addText),
      /!selected/,
    );
    assert.match(source, /const addElement = \(kind: "text" \| "shape"\) => \{\s*\n\s*finishCropRef\.current\(\);/);
    assert.match(
      source,
      /manual-editor\.element\.add-image[\s\S]*?onClick=\{\(\) => \{ finishCropRef\.current\(\); setImageMode\("add"\);/,
    );
  });

  it("removes layer controls and shows one ungrouped font list", async () => {
    const source = await shellSource();

    assert.doesNotMatch(source, /manual-editor\.layer\./);
    assert.doesNotMatch(source, /manualPageEditorStacking/);
    assert.doesNotMatch(source, /<optgroup/);
    assert.match(source, /managedFontLibrary\.map/);
    assert.match(source, /systemFontOptions\.map/);
    for (const locale of ["en", "zh"] as const) {
      const editor = messages[locale].manualEditor;
      assert.ok(!("managedFonts" in editor));
      assert.ok(!("localFonts" in editor));
      assert.ok(!("layers" in editor));
      assert.ok(!("bringToFront" in editor));
      assert.ok(!("bringForward" in editor));
      assert.ok(!("sendBackward" in editor));
      assert.ok(!("sendToBack" in editor));
    }
  });

  it("hides the ordinary selection transform origin", async () => {
    const source = await shellSource();

    assert.match(source, /<Moveable[\s\S]*?target=\{selected\}[\s\S]*?origin=\{false\}/);
  });
});
