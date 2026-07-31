import assert from "node:assert/strict";
import test from "node:test";
import type { ManagedFontRuntimeFamily } from "../../src/api/types";
import {
  managedFontFileMimeType,
  mergeRuntimeFontFamily,
  runtimeManagedFontCss,
} from "../../src/features/manual-page-editor/manualPageEditorFonts";

function family(
  name: string,
  url: string,
  variant: "regular" | "bold" = "regular",
): ManagedFontRuntimeFamily {
  return {
    family: name,
    variants: {
      [variant]: {
        variant,
        format: "ttf",
        mime_type: "font/ttf",
        size_bytes: 123,
        source_upload: {
          transport: "host_upload",
          r2_key: `${name}-${variant}`,
          url,
          mime_type: "font/ttf",
          size_bytes: 123,
        },
      },
    },
  };
}

test("受管字体运行时 CSS 使用上传 URL 和正确变体", () => {
  const css = runtimeManagedFontCss([
    family("Demo Sans", "https://example.test/regular.ttf"),
    family("Demo Sans Bold", "https://example.test/bold.ttf", "bold"),
  ]);

  assert.match(css, /font-family: "Demo Sans"/);
  assert.match(css, /url\("https:\/\/example\.test\/regular\.ttf"\)/);
  assert.match(css, /font-weight: 400/);
  assert.match(css, /font-weight: 700/);
});

test("同名字体运行时数据直接替换且保持排序", () => {
  const merged = mergeRuntimeFontFamily(
    [family("Zulu", "https://example.test/old.ttf"), family("Alpha", "https://example.test/a.ttf")],
    family("Zulu", "https://example.test/new.ttf"),
  );

  assert.deepEqual(merged.map((font) => font.family), ["Alpha", "Zulu"]);
  assert.equal(merged[1]?.variants.regular?.source_upload.url, "https://example.test/new.ttf");
});

test("字体上传只接受约定的四种扩展名", () => {
  assert.equal(managedFontFileMimeType("a.ttf"), "font/ttf");
  assert.equal(managedFontFileMimeType("a.OTF"), "font/otf");
  assert.equal(managedFontFileMimeType("a.woff"), "font/woff");
  assert.equal(managedFontFileMimeType("a.woff2"), "font/woff2");
  assert.equal(managedFontFileMimeType("a.zip"), null);
});
