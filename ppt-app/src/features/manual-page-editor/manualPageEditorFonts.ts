import type {
  ManagedFontRuntimeFamily,
  ManagedFontRuntimeVariant,
} from "../../api/types";
import { MOVEABLE_EDITOR_CLASS } from "./manualPageEditorInteractions";

export const MANAGED_FONT_FAMILY_ATTRIBUTE = "data-ppt-editor-font-family";
export const MANAGED_FONT_STYLE_ATTRIBUTE = "data-ppt-editor-fonts";
export const FONT_UPLOAD_VALUE = "__upload_managed_font__";

function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");
}

function variantRule(family: string, variant: ManagedFontRuntimeVariant): string {
  const bold = variant.variant === "bold" || variant.variant === "boldItalic";
  const italic = variant.variant === "italic" || variant.variant === "boldItalic";
  const format = variant.format === "ttf"
    ? "truetype"
    : variant.format === "otf"
      ? "opentype"
      : variant.format;
  return [
    "@font-face {",
    `  font-family: "${escapeCssString(family)}";`,
    `  src: url("${escapeCssString(variant.source_upload.url)}") format("${format}");`,
    `  font-weight: ${bold ? 700 : 400};`,
    `  font-style: ${italic ? "italic" : "normal"};`,
    "  font-display: block;",
    "}",
  ].join("\n");
}

export function runtimeManagedFontCss(fonts: readonly ManagedFontRuntimeFamily[]): string {
  return fonts.flatMap((font) =>
    Object.values(font.variants)
      .filter((variant): variant is ManagedFontRuntimeVariant => Boolean(variant))
      .map((variant) => variantRule(font.family, variant))
  ).join("\n");
}

export function installRuntimeManagedFonts(
  document: Document,
  fonts: readonly ManagedFontRuntimeFamily[],
): void {
  for (const node of Array.from(document.querySelectorAll(
    `style[${MANAGED_FONT_STYLE_ATTRIBUTE}="true"], style[data-ppt-editor-runtime-fonts="true"]`,
  ))) {
    node.remove();
  }
  const css = runtimeManagedFontCss(fonts);
  if (!css) return;
  const style = document.createElement("style");
  style.className = MOVEABLE_EDITOR_CLASS;
  style.dataset.pptEditorRuntimeFonts = "true";
  style.textContent = css;
  document.head.append(style);
}

export async function verifyRuntimeManagedFonts(
  document: Document,
  fonts: readonly ManagedFontRuntimeFamily[],
): Promise<void> {
  if (!document.fonts) throw new Error("This browser cannot verify managed fonts.");
  for (const font of fonts) {
    const family = `"${escapeCssString(font.family)}"`;
    for (const variant of Object.values(font.variants)) {
      if (!variant) continue;
      const bold = variant.variant === "bold" || variant.variant === "boldItalic";
      const italic = variant.variant === "italic" || variant.variant === "boldItalic";
      const faces = await document.fonts.load(
        `${italic ? "italic" : "normal"} ${bold ? 700 : 400} 16px ${family}`,
        "BESbswy",
      );
      if (faces.length === 0 || faces.some((face) => face.status !== "loaded")) {
        throw new Error(`Managed font failed to load: ${font.family} (${variant.variant})`);
      }
    }
  }
}

export function mergeRuntimeFontFamily(
  current: readonly ManagedFontRuntimeFamily[],
  next: ManagedFontRuntimeFamily,
): ManagedFontRuntimeFamily[] {
  return [
    ...current.filter((font) => font.family !== next.family),
    next,
  ].sort((left, right) => left.family.localeCompare(right.family));
}

export function managedFontFileMimeType(filename: string): string | null {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (extension === ".ttf") return "font/ttf";
  if (extension === ".otf") return "font/otf";
  if (extension === ".woff") return "font/woff";
  if (extension === ".woff2") return "font/woff2";
  return null;
}
