import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
    return `<div style="${base.join(";")}"><img src="${escapeHtml(imageSource(element.src))}" style="display:block;width:100%;height:100%;object-fit:${objectFit === "contain" || objectFit === "fill" ? objectFit : "cover"}"></div>`;
  }
  if (element.type === "unsupported") {
    if (element.metadata.sourceShapeType === "connector") {
      const thickness = typeof source.thickness === "number" ? source.thickness : 2;
      return `<svg style="${base.join(";")}" viewBox="0 0 ${element.width} ${element.height}"><line x1="0" y1="0" x2="${element.width}" y2="${element.height}" stroke="${cssColor(source.color, "#6b7280")}" stroke-width="${thickness}"/></svg>`;
    }
    return "";
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
  const shapeStyles = element.type === "shape"
    ? [
        `border-radius:${element.shapeType === "rounded_rectangle" ? Math.max(Number(source.border_radius) || 0, 12) : Number(source.border_radius) || 0}px`,
        typeof stroke.thickness === "number"
          ? `border:${stroke.thickness}px solid ${cssColor(stroke.color)}`
          : "",
      ]
    : [];
  return `<div style="${[
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
  ].filter(Boolean).join(";")}">${escapeHtml(element.text)}</div>`;
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
