import type { PresentationElement } from "../../../api/types";

/**
 * Rich text support for the inline editor.
 *
 * The editable DOM is kept flat and fully controlled: one <div data-pprops>
 * per paragraph, one <span style> per run. Committing parses the DOM back
 * into `paragraphs` (with complete per-run fonts, as required by the PPTX
 * generator) plus the plain `element.text`. Selection-level styling re-writes
 * the paragraph data and regenerates the DOM, so visuals, model and export
 * always agree.
 */

export interface RichFont {
  name: string;
  size: number;
  font_weight: number;
  italic: boolean;
  color: string;
  underline?: boolean;
  strike?: boolean;
}

export interface RichRun {
  text: string;
  font?: RichFont;
}

export interface RichSpacing {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface RichParagraph {
  alignment?: number;
  line_height?: number;
  spacing?: RichSpacing;
  font?: RichFont;
  text_runs: RichRun[];
}

export const RICH_DEFAULT_FONT: RichFont = {
  name: "Microsoft YaHei",
  size: 20,
  font_weight: 400,
  italic: false,
  color: "111827",
};

const EDITOR_SELECTOR = '[data-rich-text-editor="true"]';
const BLOCK_TAGS = new Set(["DIV", "P", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function resolveRichFont(base: unknown, fallback: RichFont = RICH_DEFAULT_FONT): RichFont {
  const font = record(base);
  const resolved: RichFont = {
    name: typeof font.name === "string" ? font.name : fallback.name,
    size: typeof font.size === "number" ? font.size : fallback.size,
    font_weight: typeof font.font_weight === "number" ? font.font_weight : fallback.font_weight,
    italic: typeof font.italic === "boolean" ? font.italic : fallback.italic,
    color: typeof font.color === "string" ? font.color : fallback.color,
  };
  const underline = typeof font.underline === "boolean" ? font.underline : fallback.underline;
  const strike = typeof font.strike === "boolean" ? font.strike : fallback.strike;
  if (underline !== undefined) resolved.underline = underline;
  if (strike !== undefined) resolved.strike = strike;
  return resolved;
}

function sameFont(left?: RichFont, right?: RichFont): boolean {
  if (!left || !right) return left === right;
  return left.name === right.name
    && left.size === right.size
    && left.font_weight === right.font_weight
    && left.italic === right.italic
    && left.color === right.color
    && (left.underline ?? false) === (right.underline ?? false)
    && (left.strike ?? false) === (right.strike ?? false);
}

function mergeAdjacentRuns(runs: RichRun[]): RichRun[] {
  const merged: RichRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const previous = merged[merged.length - 1];
    if (previous && sameFont(previous.font, run.font)) previous.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
}

function cssColorToModelHex(value: string): string | null {
  const trimmed = value.trim();
  const hexMatch = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (hexMatch) return hexMatch[1]!.toUpperCase();
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (shortMatch) {
    return shortMatch[1]!.split("").map((c) => c + c).join("").toUpperCase();
  }
  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(trimmed);
  if (rgbMatch) {
    return [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
      .map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return null;
}

export function modelColorToCss(value: string, fallback = "#111827"): string {
  if (!value) return fallback;
  const hex = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

function firstFontFamily(value: string): string {
  const first = value.split(",")[0] ?? "";
  return first.trim().replace(/^["']|["']$/g, "");
}

/** Effective font of a DOM node: tag semantics + inline styles, inner wins. */
function applyNodeStyles(font: RichFont, element: HTMLElement): RichFont {
  const next = { ...font };
  const tag = element.tagName;
  if (tag === "B" || tag === "STRONG") next.font_weight = 700;
  if (tag === "I" || tag === "EM") next.italic = true;
  if (tag === "U") next.underline = true;
  if (tag === "S" || tag === "STRIKE" || tag === "DEL") next.strike = true;
  const style = element.style;
  if (style.fontWeight) {
    next.font_weight = style.fontWeight === "bold" ? 700
      : style.fontWeight === "normal" ? 400
        : Number(style.fontWeight) || next.font_weight;
  }
  if (style.fontStyle) next.italic = style.fontStyle === "italic";
  const decoration = style.textDecorationLine || style.textDecoration;
  if (decoration) {
    next.underline = decoration.includes("underline");
    next.strike = decoration.includes("line-through");
  }
  if (style.color) {
    const hex = cssColorToModelHex(style.color);
    if (hex) next.color = hex;
  }
  if (style.fontSize) {
    const size = Number.parseFloat(style.fontSize);
    if (Number.isFinite(size) && size > 0) next.size = size;
  }
  if (style.fontFamily) {
    const family = firstFontFamily(style.fontFamily);
    if (family) next.name = family;
  }
  return next;
}

function collectRuns(nodes: Iterable<Node>, baseFont: RichFont): RichRun[] {
  const runs: RichRun[] = [];
  const walk = (node: Node, font: RichFont) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // contentEditable inserts &nbsp; for consecutive spaces; the model (and
      // the adapter's plain-text extraction) always uses regular spaces.
      const text = (node as Text).data.replaceAll("\u00A0", " ");
      if (text) runs.push({ text, font });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      runs.push({ text: "\n", font });
      return;
    }
    const nextFont = applyNodeStyles(font, node);
    for (const child of Array.from(node.childNodes)) walk(child, nextFont);
  };
  for (const node of nodes) walk(node, baseFont);
  return mergeAdjacentRuns(runs);
}

/** Parse a model paragraph `text` html snippet (e.g. "a<b>b</b>") into runs. */
function parseInlineHtmlToRuns(html: string, baseFont: RichFont): RichRun[] {
  const scratch = document.createElement("div");
  scratch.innerHTML = html;
  return collectRuns(Array.from(scratch.childNodes), baseFont);
}

function paragraphPlainText(paragraph: RichParagraph): string {
  return paragraph.text_runs.map((run) => run.text).join("");
}

export function paragraphsPlainText(paragraphs: RichParagraph[]): string {
  return paragraphs.map(paragraphPlainText).join("\n");
}

function paragraphFromText(line: string, template?: RichParagraph): RichParagraph {
  const font = template?.font ? { ...template.font } : { ...RICH_DEFAULT_FONT };
  return {
    ...(template?.alignment !== undefined ? { alignment: template.alignment } : {}),
    ...(template?.line_height !== undefined ? { line_height: template.line_height } : {}),
    ...(template?.spacing ? { spacing: { ...template.spacing } } : {}),
    font,
    text_runs: line ? [{ text: line, font: { ...font } }] : [],
  };
}

/** Normalize raw model paragraphs (runs materialized, fonts completed). */
export function normalizeRichParagraphs(
  rawParagraphs: unknown[],
  fallbackFont: RichFont = RICH_DEFAULT_FONT,
): RichParagraph[] {
  return rawParagraphs.map((entry) => {
    const raw = record(entry);
    const font = resolveRichFont(raw.font, fallbackFont);
    const rawRuns = Array.isArray(raw.text_runs) ? raw.text_runs : null;
    let runs: RichRun[];
    if (rawRuns) {
      runs = mergeAdjacentRuns(rawRuns.map((runEntry) => {
        const run = record(runEntry);
        return {
          text: typeof run.text === "string" ? run.text : "",
          font: resolveRichFont(run.font, font),
        };
      }));
    } else if (typeof raw.text === "string") {
      runs = parseInlineHtmlToRuns(raw.text, font);
    } else {
      runs = [];
    }
    const spacing = record(raw.spacing);
    const hasSpacing = typeof spacing.top === "number" || typeof spacing.bottom === "number";
    return {
      ...(typeof raw.alignment === "number" ? { alignment: raw.alignment } : {}),
      ...(typeof raw.line_height === "number" ? { line_height: raw.line_height } : {}),
      ...(hasSpacing
        ? {
            spacing: {
              top: Number(spacing.top) || 0,
              bottom: Number(spacing.bottom) || 0,
              left: Number(spacing.left) || 0,
              right: Number(spacing.right) || 0,
            },
          }
        : {}),
      font,
      text_runs: runs,
    };
  });
}

/**
 * Normalized paragraphs for a text or shape element. When `element.text` no
 * longer matches the stored paragraphs (older plain-text commits), the text
 * wins and styling is rebuilt from the first paragraph.
 */
export function elementRichParagraphs(element: PresentationElement): RichParagraph[] {
  if (element.type !== "text" && element.type !== "shape") return [];
  const source = record(element.sourceData);
  const rawParagraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  const paragraphs = normalizeRichParagraphs(rawParagraphs);

  if (paragraphsPlainText(paragraphs) === element.text) return paragraphs;
  // Stale paragraphs: rebuild from the plain text, keeping first-paragraph style.
  const template = paragraphs[0];
  return element.text.split("\n").map((line) => paragraphFromText(line, template));
}

function fontCss(font: RichFont): string {
  const decorations = [
    font.underline ? "underline" : "",
    font.strike ? "line-through" : "",
  ].filter(Boolean).join(" ");
  return [
    `font-family:${font.name}`,
    `font-size:${font.size}px`,
    `font-weight:${font.font_weight}`,
    `font-style:${font.italic ? "italic" : "normal"}`,
    `text-decoration-line:${decorations || "none"}`,
    `color:${modelColorToCss(font.color)}`,
  ].join(";");
}

function paragraphCss(paragraph: RichParagraph): string {
  const parts: string[] = [];
  if (paragraph.alignment === 2) parts.push("text-align:center");
  else if (paragraph.alignment === 3) parts.push("text-align:right");
  else if (paragraph.alignment === 4) parts.push("text-align:justify");
  if (paragraph.line_height) parts.push(`line-height:${paragraph.line_height}`);
  if (paragraph.spacing) {
    if (paragraph.spacing.top) parts.push(`margin-top:${paragraph.spacing.top}px`);
    if (paragraph.spacing.bottom) parts.push(`margin-bottom:${paragraph.spacing.bottom}px`);
  }
  return parts.join(";");
}

function paragraphProps(paragraph: RichParagraph): Record<string, unknown> {
  return {
    ...(paragraph.alignment !== undefined ? { alignment: paragraph.alignment } : {}),
    ...(paragraph.line_height !== undefined ? { line_height: paragraph.line_height } : {}),
    ...(paragraph.spacing ? { spacing: paragraph.spacing } : {}),
    ...(paragraph.font ? { font: paragraph.font } : {}),
  };
}

export function paragraphsToEditorHtml(paragraphs: RichParagraph[]): string {
  const blocks = paragraphs.length > 0 ? paragraphs : [paragraphFromText("")];
  return blocks.map((paragraph) => {
    const props = escapeHtml(JSON.stringify(paragraphProps(paragraph)));
    const style = paragraphCss(paragraph);
    const runsHtml = paragraph.text_runs
      .map((run) => `<span style="${escapeHtml(fontCss(resolveRichFont(run.font, paragraph.font)))}">${
        escapeHtml(run.text).replaceAll("\n", "<br>")
      }</span>`)
      .join("");
    return `<div data-pprops="${props}"${style ? ` style="${escapeHtml(style)}"` : ""}>${runsHtml || "<br>"}</div>`;
  }).join("");
}

interface EditorBlock {
  element: HTMLElement | null;
  nodes: Node[];
}

function editorBlocks(root: HTMLElement): EditorBlock[] {
  const blocks: EditorBlock[] = [];
  let inline: Node[] = [];
  const flush = () => {
    if (inline.length > 0) {
      blocks.push({ element: null, nodes: inline });
      inline = [];
    }
  };
  for (const child of Array.from(root.childNodes)) {
    if (child instanceof HTMLElement && BLOCK_TAGS.has(child.tagName)) {
      flush();
      blocks.push({ element: child, nodes: Array.from(child.childNodes) });
    } else {
      inline.push(child);
    }
  }
  flush();
  if (blocks.length === 0) blocks.push({ element: null, nodes: [] });
  return blocks;
}

function readParagraphProps(element: HTMLElement | null): Partial<RichParagraph> {
  if (!element) return {};
  const raw = element.getAttribute("data-pprops");
  if (!raw) return {};
  try {
    const parsed = record(JSON.parse(raw));
    const result: Partial<RichParagraph> = {};
    if (typeof parsed.alignment === "number") result.alignment = parsed.alignment;
    if (typeof parsed.line_height === "number") result.line_height = parsed.line_height;
    const spacing = record(parsed.spacing);
    if (typeof spacing.top === "number" || typeof spacing.bottom === "number") {
      result.spacing = {
        top: Number(spacing.top) || 0,
        bottom: Number(spacing.bottom) || 0,
        left: Number(spacing.left) || 0,
        right: Number(spacing.right) || 0,
      };
    }
    if (parsed.font) result.font = resolveRichFont(parsed.font);
    return result;
  } catch {
    return {};
  }
}

/** Parse the editable DOM back into normalized paragraphs + plain text. */
export function editorDomToParagraphs(
  root: HTMLElement,
  fallbackFont: RichFont = RICH_DEFAULT_FONT,
): { text: string; paragraphs: RichParagraph[] } {
  let lastFont = fallbackFont;
  const paragraphs = editorBlocks(root).map((block) => {
    const props = readParagraphProps(block.element);
    const font = props.font ?? lastFont;
    lastFont = font;
    const runs = collectRuns(block.nodes, font);
    // A lone trailing newline is the placeholder <br> of an empty paragraph.
    const normalizedRuns = runs.length === 1 && runs[0]!.text === "\n" ? [] : runs;
    return {
      ...props,
      font,
      text_runs: normalizedRuns,
    };
  });
  return { text: paragraphsPlainText(paragraphs), paragraphs };
}

interface SelectionPoint {
  paragraph: number;
  offset: number;
}

export interface EditorSelectionOffsets {
  start: SelectionPoint;
  end: SelectionPoint;
}

function nodeTextLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return (node as Text).data.length;
  if (node instanceof HTMLElement && node.tagName === "BR") return 1;
  let total = 0;
  for (const child of Array.from(node.childNodes)) total += nodeTextLength(child);
  return total;
}

function blockTextLength(block: EditorBlock): number {
  return block.nodes.reduce((sum, node) => sum + nodeTextLength(node), 0);
}

function resolvePoint(container: Node, offset: number): { node: Node; textOffset: number; after: boolean } {
  if (container.nodeType === Node.TEXT_NODE) return { node: container, textOffset: offset, after: false };
  const children = container.childNodes;
  if (children.length === 0) return { node: container, textOffset: 0, after: false };
  if (offset >= children.length) return { node: children[children.length - 1]!, textOffset: 0, after: true };
  return { node: children[offset]!, textOffset: 0, after: false };
}

function pointToOffsets(blocks: EditorBlock[], container: Node, offset: number): SelectionPoint | null {
  const point = resolvePoint(container, offset);
  for (const [index, block] of blocks.entries()) {
    const owner = block.element ?? null;
    const contains = point.node === owner
      || block.nodes.some((node) => node === point.node || node.contains(point.node));
    if (!contains) continue;
    if (point.node === owner) {
      return { paragraph: index, offset: point.after ? blockTextLength(block) : 0 };
    }
    let count = 0;
    let found: number | null = null;
    const visit = (node: Node): boolean => {
      if (node === point.node) {
        found = point.after
          ? count + nodeTextLength(node)
          : count + (node.nodeType === Node.TEXT_NODE ? point.textOffset : 0);
        return true;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        count += (node as Text).data.length;
        return false;
      }
      if (node instanceof HTMLElement && node.tagName === "BR") {
        count += 1;
        return false;
      }
      for (const child of Array.from(node.childNodes)) {
        if (visit(child)) return true;
      }
      return false;
    };
    for (const node of block.nodes) {
      if (visit(node)) break;
    }
    return { paragraph: index, offset: found ?? count };
  }
  return null;
}

export function selectionOffsetsIn(root: HTMLElement): EditorSelectionOffsets | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  if (range.startContainer === root && range.startOffset === 0 && root.childNodes.length === 0) {
    return { start: { paragraph: 0, offset: 0 }, end: { paragraph: 0, offset: 0 } };
  }
  const blocks = editorBlocks(root);
  const start = pointToOffsets(blocks, range.startContainer, range.startOffset);
  const end = pointToOffsets(blocks, range.endContainer, range.endOffset);
  if (!start || !end) return null;
  return { start, end };
}

function domPointAt(block: EditorBlock, target: number): { node: Node; offset: number } {
  let count = 0;
  let result: { node: Node; offset: number } | null = null;
  const visit = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = (node as Text).data.length;
      if (count + length >= target) {
        result = { node, offset: target - count };
        return true;
      }
      count += length;
      return false;
    }
    if (node instanceof HTMLElement && node.tagName === "BR") {
      if (count + 1 > target) {
        const parent = node.parentNode!;
        result = { node: parent, offset: Array.from(parent.childNodes).indexOf(node) };
        return true;
      }
      count += 1;
      return false;
    }
    for (const child of Array.from(node.childNodes)) {
      if (visit(child)) return true;
    }
    return false;
  };
  for (const node of block.nodes) {
    if (visit(node)) break;
  }
  if (result) return result;
  const anchor = block.element;
  if (anchor) return { node: anchor, offset: anchor.childNodes.length };
  const last = block.nodes[block.nodes.length - 1];
  if (last) {
    return last.nodeType === Node.TEXT_NODE
      ? { node: last, offset: (last as Text).data.length }
      : { node: last, offset: last.childNodes.length };
  }
  return { node: anchor ?? block.nodes[0]!, offset: 0 };
}

export function restoreSelectionIn(root: HTMLElement, offsets: EditorSelectionOffsets): void {
  const blocks = editorBlocks(root);
  const clampBlock = (index: number) => Math.max(0, Math.min(index, blocks.length - 1));
  const startBlock = blocks[clampBlock(offsets.start.paragraph)]!;
  const endBlock = blocks[clampBlock(offsets.end.paragraph)]!;
  const start = domPointAt(startBlock, Math.min(offsets.start.offset, blockTextLength(startBlock)));
  const end = domPointAt(endBlock, Math.min(offsets.end.offset, blockTextLength(endBlock)));
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  try {
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
  } catch {
    return;
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

// The most recent selection inside the active editor, kept while the user
// interacts with the toolbar (which steals focus and may clear the live
// selection).
let savedSelection: EditorSelectionOffsets | null = null;

export function rememberEditorSelection(root: HTMLElement): void {
  const offsets = selectionOffsetsIn(root);
  if (offsets) savedSelection = offsets;
}

export function clearRememberedSelection(): void {
  savedSelection = null;
}

function activeEditorRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>(EDITOR_SELECTOR);
}

function orderedOffsets(offsets: EditorSelectionOffsets): EditorSelectionOffsets {
  const { start, end } = offsets;
  const reversed = end.paragraph < start.paragraph
    || (end.paragraph === start.paragraph && end.offset < start.offset);
  return reversed ? { start: end, end: start } : offsets;
}

function isCollapsed(offsets: EditorSelectionOffsets): boolean {
  return offsets.start.paragraph === offsets.end.paragraph
    && offsets.start.offset === offsets.end.offset;
}

function fullRange(paragraphs: RichParagraph[]): EditorSelectionOffsets {
  const last = Math.max(0, paragraphs.length - 1);
  return {
    start: { paragraph: 0, offset: 0 },
    end: { paragraph: last, offset: paragraphPlainText(paragraphs[last] ?? { text_runs: [] }).length },
  };
}

function applyFontPatchToRange(
  paragraphs: RichParagraph[],
  offsets: EditorSelectionOffsets,
  patch: Partial<RichFont>,
): void {
  const { start, end } = orderedOffsets(offsets);
  for (let index = start.paragraph; index <= end.paragraph && index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index]!;
    const total = paragraphPlainText(paragraph).length;
    const from = index === start.paragraph ? start.offset : 0;
    const to = index === end.paragraph ? end.offset : total;
    if (from >= to) continue;
    const nextRuns: RichRun[] = [];
    let position = 0;
    for (const run of paragraph.text_runs) {
      const length = run.text.length;
      const overlapStart = Math.max(from, position);
      const overlapEnd = Math.min(to, position + length);
      if (overlapEnd <= overlapStart) {
        nextRuns.push(run);
      } else {
        const localStart = overlapStart - position;
        const localEnd = overlapEnd - position;
        const before = run.text.slice(0, localStart);
        const middle = run.text.slice(localStart, localEnd);
        const after = run.text.slice(localEnd);
        if (before) nextRuns.push({ text: before, font: run.font });
        nextRuns.push({
          text: middle,
          font: { ...resolveRichFont(run.font, paragraph.font), ...patch },
        });
        if (after) nextRuns.push({ text: after, font: run.font });
      }
      position += length;
    }
    paragraph.text_runs = mergeAdjacentRuns(nextRuns);
  }
}

function withActiveEditor(
  mutate: (paragraphs: RichParagraph[], offsets: EditorSelectionOffsets) => void,
): boolean {
  const root = activeEditorRoot();
  if (!root) return false;
  const { paragraphs } = editorDomToParagraphs(root);
  let offsets = selectionOffsetsIn(root) ?? savedSelection;
  if (!offsets || isCollapsed(offsets)) offsets = null;
  const effective = offsets ?? fullRange(paragraphs);
  mutate(paragraphs, effective);
  root.innerHTML = paragraphsToEditorHtml(paragraphs);
  root.focus();
  restoreSelectionIn(root, effective);
  savedSelection = effective;
  root.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/**
 * Apply a font patch to the current selection of the active inline editor.
 * Falls back to the whole content when there is no usable selection.
 * Returns false when no rich editor is active (caller should patch the model).
 */
export function applyFontToActiveEditor(patch: Partial<RichFont>): boolean {
  return withActiveEditor((paragraphs, offsets) => {
    applyFontPatchToRange(paragraphs, offsets, patch);
  });
}

/**
 * Apply paragraph-level properties inside the active inline editor.
 * `scope: "selection"` targets paragraphs touched by the selection (cursor
 * paragraph when collapsed); `scope: "all"` targets every paragraph.
 */
export function applyParagraphPropsToActiveEditor(
  patch: Partial<{ alignment: number; line_height: number; spacing: Partial<{ top: number; bottom: number }> }>,
  scope: "selection" | "all",
): boolean {
  const root = activeEditorRoot();
  if (!root) return false;
  const { paragraphs } = editorDomToParagraphs(root);
  const live = selectionOffsetsIn(root) ?? savedSelection;
  const offsets = scope === "all" || !live ? fullRange(paragraphs) : orderedOffsets(live);
  for (let index = offsets.start.paragraph; index <= offsets.end.paragraph && index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index]!;
    if (patch.alignment !== undefined) paragraph.alignment = patch.alignment;
    if (patch.line_height !== undefined) paragraph.line_height = patch.line_height;
    if (patch.spacing !== undefined) {
      paragraph.spacing = {
        top: patch.spacing.top ?? paragraph.spacing?.top ?? 0,
        bottom: patch.spacing.bottom ?? paragraph.spacing?.bottom ?? 0,
        left: paragraph.spacing?.left ?? 0,
        right: paragraph.spacing?.right ?? 0,
      };
    }
  }
  root.innerHTML = paragraphsToEditorHtml(paragraphs);
  root.focus();
  const restore = live ?? fullRange(paragraphs);
  restoreSelectionIn(root, restore);
  savedSelection = restore;
  root.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/** Parse a detached HTML snapshot of the editor (used for commit-on-unmount). */
export function editorHtmlToParagraphs(
  html: string,
  fallbackFont: RichFont = RICH_DEFAULT_FONT,
): { text: string; paragraphs: RichParagraph[] } {
  const scratch = document.createElement("div");
  scratch.innerHTML = html;
  return editorDomToParagraphs(scratch, fallbackFont);
}
