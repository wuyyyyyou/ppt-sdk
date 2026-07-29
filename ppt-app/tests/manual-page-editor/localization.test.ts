import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { messages } from "../../src/i18n/messages";

const SHELL = "src/features/manual-page-editor/ManualPageEditorShell.tsx";

function flatten(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (Array.isArray(value)) return value.flatMap((item, index) => flatten(item, `${prefix}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => flatten(item, prefix ? `${prefix}.${key}` : key));
  }
  return [];
}

describe("manual page editor localization", () => {
  it("keeps every editor label in the locale bundle", async () => {
    const source = await readFile(path.resolve(SHELL), "utf8");

    assert.doesNotMatch(source, /[\u4e00-\u9fff]/);
    assert.match(source, /const t = props\.t\.manualEditor;/);
  });

  it("ships the same editor keys in both locales", () => {
    assert.deepEqual(
      flatten(messages.en.manualEditor).sort(),
      flatten(messages.zh.manualEditor).sort(),
    );
  });

  it("translates the labels the editor renders directly", () => {
    for (const locale of ["en", "zh"] as const) {
      const editor = messages[locale].manualEditor;
      assert.ok(editor.saveStatus.saved.length > 0);
      assert.ok(editor.restoreConfirm.confirm.length > 0);
      assert.ok(editor.unsavedConfirm.discard.length > 0);
      assert.match(editor.loadFailed, /\{status\}/);
    }
    assert.notEqual(messages.en.manualEditor.title, messages.zh.manualEditor.title);
  });

  it("hands the editor the locale bundle App already holds", async () => {
    const app = await readFile(path.resolve("src/app/App.tsx"), "utf8");
    const mount = app.slice(app.indexOf("<ManualPageEditorShell"));

    assert.match(mount.slice(0, mount.indexOf("/>")), /t=\{t\}/);
  });
});
