import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeTableData } from "./table.js";
import type {
  PresentationDocument,
  PresentationElement,
  PresentationSlideDocument,
} from "./types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cssColor(value: unknown, fallback = "transparent"): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  return value.startsWith("#") ? value : `#${value}`;
}

function imageSource(src: string): string {
  if (path.isAbsolute(src)) return pathToFileURL(src).href;
  return src;
}

function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"');
}

function runFontCss(font: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof font.name === "string") parts.push(`font-family:${escapeHtml(font.name)}`);
  if (typeof font.size === "number") parts.push(`font-size:${font.size}px`);
  if (typeof font.font_weight === "number") parts.push(`font-weight:${font.font_weight}`);
  parts.push(`font-style:${font.italic === true ? "italic" : "normal"}`);
  const decorations = [
    font.underline === true ? "underline" : "",
    font.strike === true ? "line-through" : "",
  ].filter(Boolean).join(" ");
  parts.push(`text-decoration-line:${decorations || "none"}`);
  if (typeof font.color === "string") parts.push(`color:${cssColor(font.color)}`);
  return parts.join(";");
}

function paragraphCss(paragraph: Record<string, unknown>): string {
  const parts: string[] = [];
  if (paragraph.alignment === 2) parts.push("text-align:center");
  else if (paragraph.alignment === 3) parts.push("text-align:right");
  else if (paragraph.alignment === 4) parts.push("text-align:justify");
  if (typeof paragraph.line_height === "number" && paragraph.line_height > 0) {
    parts.push(`line-height:${paragraph.line_height}`);
  }
  const spacing = record(paragraph.spacing);
  if (typeof spacing.top === "number" && spacing.top > 0) parts.push(`margin-top:${spacing.top}px`);
  if (typeof spacing.bottom === "number" && spacing.bottom > 0) parts.push(`margin-bottom:${spacing.bottom}px`);
  return parts.join(";");
}

/** Run-level paragraph blocks. Returns blocks html plus the plain-text lines. */
function paragraphBlocksHtml(rawParagraphs: unknown[]): { html: string; plain: string } {
  const blocks: string[] = [];
  const plainLines: string[] = [];
  for (const entry of rawParagraphs) {
    const paragraph = record(entry);
    const paragraphFont = record(paragraph.font);
    const runs = Array.isArray(paragraph.text_runs) ? paragraph.text_runs : null;
    let inner: string;
    let line: string;
    if (runs) {
      inner = runs.map((runEntry) => {
        const run = record(runEntry);
        const text = typeof run.text === "string" ? run.text : "";
        const font = { ...paragraphFont, ...record(run.font) };
        return `<span style="${runFontCss(font)}">${escapeHtml(text).replaceAll("\n", "<br>")}</span>`;
      }).join("");
      line = runs.map((runEntry) => {
        const run = record(runEntry);
        return typeof run.text === "string" ? run.text : "";
      }).join("");
    } else if (typeof paragraph.text === "string") {
      line = plainText(paragraph.text);
      inner = `<span style="${runFontCss(paragraphFont)}">${escapeHtml(line).replaceAll("\n", "<br>")}</span>`;
    } else {
      line = "";
      inner = "";
    }
    plainLines.push(line);
    const style = paragraphCss(paragraph);
    blocks.push(`<div${style ? ` style="${style}"` : ""}>${inner || "<br>"}</div>`);
  }
  return { html: blocks.join(""), plain: plainLines.join("\n") };
}

/**
 * Run-level paragraph markup for text/shape elements. Returns null when the
 * stored paragraphs no longer match `element.text` (legacy plain-text edits),
 * in which case the caller falls back to the plain rendering.
 */
function richParagraphsHtml(element: PresentationElement, source: Record<string, unknown>): string | null {
  if (element.type !== "text" && element.type !== "shape") return null;
  const rawParagraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  if (rawParagraphs.length === 0) return null;
  const { html, plain } = paragraphBlocksHtml(rawParagraphs);
  if (plain !== element.text) return null;
  return html;
}

/**
 * Container markup honoring an element-level hyperlink: the anchor itself
 * carries the absolute positioning so the PDF link annotation covers the
 * whole element box.
 */
function containerHtml(element: PresentationElement, styles: string[], inner: string): string {
  if (element.hyperlink) {
    // position:absolute already makes the anchor block-formatted.
    return `<a href="${escapeHtml(element.hyperlink)}" style="${[...styles, "color:inherit", "text-decoration:none"].join(";")}">${inner}</a>`;
  }
  return `<div style="${styles.join(";")}">${inner}</div>`;
}

function elementHtml(element: PresentationElement): string {
  if (element.hidden) return "";
  const source = record(element.sourceData);
  const base = [
    "position:absolute",
    `left:${element.x}px`,
    `top:${element.y}px`,
    `width:${element.width}px`,
    `height:${element.height}px`,
    `z-index:${element.zIndex}`,
    `opacity:${element.opacity ?? 1}`,
    "box-sizing:border-box",
    "overflow:hidden",
  ];

  if (element.type === "image") {
    const objectFit = record(source.object_fit).fit;
    return containerHtml(element, base, `<img src="${escapeHtml(imageSource(element.src))}" style="display:block;width:100%;height:100%;object-fit:${objectFit === "contain" || objectFit === "fill" ? objectFit : "cover"}">`);
  }
  if (element.type === "unsupported") {
    if (element.metadata.sourceShapeType === "connector") {
      const thickness = typeof source.thickness === "number" ? source.thickness : 2;
      return `<svg style="${base.join(";")}" viewBox="0 0 ${element.width} ${element.height}"><line x1="0" y1="0" x2="${element.width}" y2="${element.height}" stroke="${cssColor(source.color, "#6b7280")}" stroke-width="${thickness}"/></svg>`;
    }
    return "";
  }
  if (element.type === "table") {
    const { cells, style } = normalizeTableData(element.table);
    const columnCount = cells[0]?.length ?? 0;
    if (cells.length === 0 || columnCount === 0) return "";
    const cellsHtml = cells.map((row) =>
      row.map((cell) => {
        const { html } = paragraphBlocksHtml(cell.paragraphs);
        return `<div style="${[
          "display:flex",
          "flex-direction:column",
          "justify-content:center",
          "overflow:hidden",
          "box-sizing:border-box",
          "padding:2px 6px",
          `border:1px solid ${cssColor(style.borderColor, "#e5e7eb")}`,
          `background:${cssColor(cell.fill, "#ffffff")}`,
          `color:${cssColor(style.textColor, "#1f2937")}`,
          "white-space:pre-wrap",
          "word-break:normal",
          "overflow-wrap:break-word",
        ].join(";")}">${html}</div>`;
      }).join("")).join("");
    return `<div style="${[
      ...base,
      "display:grid",
      `grid-template-columns:repeat(${columnCount},1fr)`,
      `grid-template-rows:repeat(${cells.length},1fr)`,
      `font-family:${escapeHtml(style.fontName)}`,
      `font-size:${style.fontSize}px`,
    ].join(";")}">${cellsHtml}</div>`;
  }

  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  const paragraph = record(paragraphs[0]);
  const runs = Array.isArray(paragraph.text_runs) ? paragraph.text_runs : [];
  const font = record(paragraph.font ?? record(runs[0]).font);
  const fill = record(source.fill);
  const margin = record(source.margin);
  const stroke = record(source.stroke);
  const alignment = paragraph.alignment === 2 ? "center" : paragraph.alignment === 3 ? "right" : "left";
  const justify = source.vertical_alignment === 3 ? "center" : source.vertical_alignment === 4 ? "flex-end" : "flex-start";
  const shapeStyles = [
    element.type === "shape"
      ? `border-radius:${element.shapeType === "rounded_rectangle" ? Math.max(Number(source.border_radius) || 0, 12) : Number(source.border_radius) || 0}px`
      : "",
    typeof stroke.thickness === "number" && stroke.thickness > 0
      ? `border:${stroke.thickness}px solid ${cssColor(stroke.color)}`
      : "",
  ];
  const containerStyles = [
    ...base,
    "display:flex",
    "flex-direction:column",
    `justify-content:${justify}`,
    `font-family:${escapeHtml(typeof font.name === "string" ? font.name : "Arial")}`,
    `font-size:${typeof font.size === "number" ? font.size : 20}px`,
    `font-weight:${typeof font.font_weight === "number" ? font.font_weight : 400}`,
    `font-style:${font.italic === true ? "italic" : "normal"}`,
    `color:${cssColor(font.color, "#111827")}`,
    `text-align:${alignment}`,
    `background:${cssColor(fill.color)}`,
    `padding:${Number(margin.top) || 0}px ${Number(margin.right) || 0}px ${Number(margin.bottom) || 0}px ${Number(margin.left) || 0}px`,
    // Keep digits and latin words intact: no-wrap boxes must never wrap and
    // wrapping boxes may only break between words (plus normal CJK breaks).
    source.text_wrap === false ? "white-space:pre" : "white-space:pre-wrap",
    "word-break:normal",
    source.text_wrap === false ? "overflow-wrap:normal" : "overflow-wrap:break-word",
    ...shapeStyles,
  ].filter(Boolean);
  const richHtml = richParagraphsHtml(element, source);
  return containerHtml(element, containerStyles, richHtml ?? escapeHtml(element.text));
}

function slideHtml(document: PresentationDocument, slide: PresentationSlideDocument): string {
  const elements = [...slide.elements]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map(elementHtml)
    .join("\n");
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${document.width}px;height:${document.height}px;overflow:hidden}
#presentation-slides-wrapper{position:relative;width:${document.width}px;height:${document.height}px;overflow:hidden;background:${cssColor(slide.background?.color, "#ffffff")}}
</style></head><body><div id="presentation-slides-wrapper" data-presenton-render-status="ready">${elements}</div></body></html>`;
}

export async function writePresentationDocumentHtmlSlides(input: {
  document: PresentationDocument;
  outputDir: string;
}): Promise<string[]> {
  await mkdir(input.outputDir, { recursive: true });
  const ordered = [...input.document.slides].sort((left, right) => left.order - right.order);
  const paths: string[] = [];
  for (const [index, slide] of ordered.entries()) {
    const filePath = path.join(input.outputDir, `slide-${String(index + 1).padStart(3, "0")}.html`);
    await writeFile(filePath, slideHtml(input.document, slide), "utf8");
    paths.push(filePath);
  }
  return paths;
}
