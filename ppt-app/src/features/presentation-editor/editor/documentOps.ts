import type {
  PresentationDocument,
  PresentationElement,
  PresentationSlideDocument,
  PresentationTableCell,
  PresentationTableData,
  PresentationTableElement,
  PresentationTableStyle,
} from "../../../api/types";

export function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function orderedSlides(document: PresentationDocument): PresentationSlideDocument[] {
  return [...document.slides].sort((left, right) => left.order - right.order);
}

export function cloneSlideWithNewIds(
  slide: PresentationSlideDocument,
  order: number,
): PresentationSlideDocument {
  const next = structuredClone(slide);
  next.id = nextId("slide");
  next.order = order;
  next.elements = next.elements.map((element) => ({
    ...element,
    id: nextId("element"),
    sourceElementId: element.sourceElementId,
  }));
  return next;
}

/** Insert a duplicate of the slide right after it. Returns the new slide id. */
export function duplicateSlide(document: PresentationDocument, slideId: string): string | null {
  const source = document.slides.find((item) => item.id === slideId);
  if (!source) return null;
  const duplicate = cloneSlideWithNewIds(source, source.order + 1);
  document.slides.forEach((item) => {
    if (item.order > source.order) item.order += 1;
  });
  document.slides.push(duplicate);
  return duplicate.id;
}

/** Append an empty slide at the end. Returns the new slide id. */
export function addBlankSlide(document: PresentationDocument, template?: PresentationSlideDocument): string {
  const order = document.slides.length;
  const slide: PresentationSlideDocument = {
    id: nextId("slide"),
    order,
    background: template?.background ? structuredClone(template.background) : { color: "FFFFFF", opacity: 1 },
    elements: [],
    metadata: { sourceSlideIndex: template?.metadata.sourceSlideIndex ?? 0 },
  };
  document.slides.push(slide);
  return slide.id;
}

/** Remove a slide and re-pack orders. Returns the id of the nearest remaining slide. */
export function deleteSlide(document: PresentationDocument, slideId: string): string | null {
  if (document.slides.length <= 1) return null;
  const ordered = orderedSlides(document);
  const index = ordered.findIndex((item) => item.id === slideId);
  if (index < 0) return null;
  document.slides = ordered
    .filter((item) => item.id !== slideId)
    .map((item, order) => ({ ...item, order }));
  const nearest = document.slides[Math.min(index, document.slides.length - 1)];
  return nearest?.id ?? null;
}

/** Move a slide to a target position (index within ordered list). */
export function moveSlideTo(document: PresentationDocument, slideId: string, targetIndex: number): void {
  const ordered = orderedSlides(document);
  const fromIndex = ordered.findIndex((item) => item.id === slideId);
  if (fromIndex < 0) return;
  const clamped = Math.max(0, Math.min(targetIndex, ordered.length - 1));
  if (clamped === fromIndex) return;
  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(clamped, 0, moved!);
  ordered.forEach((item, index) => {
    const slide = document.slides.find((candidate) => candidate.id === item.id);
    if (slide) slide.order = index;
  });
}

export interface AddElementResult {
  elementId: string;
}

export function addTextElement(document: PresentationDocument, slideId: string): AddElementResult | null {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return null;
  const id = nextId("element");
  const width = 420;
  const height = 64;
  const x = Math.round((document.width - width) / 2);
  const y = Math.round((document.height - height) / 2);
  slide.elements.push({
    id,
    sourceElementId: id,
    type: "text",
    x,
    y,
    width,
    height,
    zIndex: topZIndex(slide) + 1,
    text: "New text",
    metadata: { sourceShapeIndex: -1, sourceShapeType: "textbox" },
    sourceData: {
      shape_type: "textbox",
      position: { left: x, top: y, width, height },
      text_wrap: true,
      paragraphs: [{
        text: "New text",
        font: { name: "Microsoft YaHei", size: 24, font_weight: 400, italic: false, color: "111827" },
      }],
    },
  });
  return { elementId: id };
}

export function addShapeElement(document: PresentationDocument, slideId: string): AddElementResult | null {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return null;
  const id = nextId("element");
  const width = 280;
  const height = 140;
  const x = Math.round((document.width - width) / 2);
  const y = Math.round((document.height - height) / 2);
  slide.elements.push({
    id,
    sourceElementId: id,
    type: "shape",
    shapeType: "rounded_rectangle",
    x,
    y,
    width,
    height,
    zIndex: topZIndex(slide) + 1,
    text: "",
    metadata: { sourceShapeIndex: -1, sourceShapeType: "autoshape" },
    sourceData: {
      shape_type: "autoshape",
      type: 5,
      position: { left: x, top: y, width, height },
      text_wrap: true,
      fill: { color: "DDD6FE", opacity: 1 },
      paragraphs: [],
    },
  });
  return { elementId: id };
}

export function addImageElement(
  document: PresentationDocument,
  slideId: string,
  src: string,
): AddElementResult | null {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return null;
  const id = nextId("element");
  const width = 480;
  const height = 320;
  const x = Math.round((document.width - width) / 2);
  const y = Math.round((document.height - height) / 2);
  slide.elements.push({
    id,
    sourceElementId: id,
    type: "image",
    src,
    x,
    y,
    width,
    height,
    zIndex: topZIndex(slide) + 1,
    metadata: { sourceShapeIndex: -1, sourceShapeType: "picture" },
    sourceData: {
      shape_type: "picture",
      position: { left: x, top: y, width, height },
      clip: false,
      picture: { is_network: /^https?:\/\//i.test(src), path: src },
    },
  });
  return { elementId: id };
}

export const TABLE_DEFAULT_STYLE: PresentationTableStyle = {
  borderColor: "E5E7EB",
  textColor: "1F2937",
  fontSize: 14,
  fontName: "Microsoft YaHei",
};

function tableCellParagraphs(
  text: string,
  style: PresentationTableStyle,
  options: { bold?: boolean; color?: string } = {},
): Array<Record<string, unknown>> {
  return text.split("\n").map((line) => ({
    alignment: 2,
    text: line,
    font: {
      name: style.fontName,
      size: style.fontSize,
      font_weight: options.bold ? 700 : 400,
      italic: false,
      color: options.color ?? style.textColor,
    },
  }));
}

function emptyTableCell(style: PresentationTableStyle, fill?: string): PresentationTableCell {
  return {
    paragraphs: tableCellParagraphs("", style),
    ...(fill ? { fill } : {}),
  };
}

/**
 * Normalize a table payload that may still use the legacy
 * `{ rows, headerRow, style }` shape into the current `{ cells, style }`
 * shape. Mirrors the engine-side normalizer in
 * executas/ppt-engine/src/presentation-document/table.ts.
 */
export function normalizeTableData(raw: unknown): PresentationTableData {
  const table = asRecord(raw);
  const styleRaw = asRecord(table.style);
  const style: PresentationTableStyle = {
    borderColor: typeof styleRaw.borderColor === "string" ? styleRaw.borderColor : TABLE_DEFAULT_STYLE.borderColor,
    textColor: typeof styleRaw.textColor === "string" ? styleRaw.textColor : TABLE_DEFAULT_STYLE.textColor,
    fontSize: typeof styleRaw.fontSize === "number" ? styleRaw.fontSize : TABLE_DEFAULT_STYLE.fontSize,
    fontName: typeof styleRaw.fontName === "string" ? styleRaw.fontName : TABLE_DEFAULT_STYLE.fontName,
  };

  if (Array.isArray(table.cells)) {
    const cells = (table.cells as unknown[]).map((row) => {
      if (!Array.isArray(row)) return [emptyTableCell(style)];
      return row.map((entry): PresentationTableCell => {
        const cell = asRecord(entry);
        const paragraphs = Array.isArray(cell.paragraphs)
          ? cell.paragraphs.map((item) => asRecord(item))
          : tableCellParagraphs(typeof cell.text === "string" ? cell.text : "", style);
        return {
          paragraphs: paragraphs.length > 0 ? paragraphs : tableCellParagraphs("", style),
          ...(typeof cell.fill === "string" && cell.fill ? { fill: cell.fill } : {}),
        };
      });
    });
    return { cells: cells.length > 0 ? cells : [[emptyTableCell(style)]], style };
  }

  // Legacy format: rows: string[][], headerRow, style with headerFill/stripeFills.
  const rows = Array.isArray(table.rows) ? table.rows as unknown[] : [];
  const headerRow = table.headerRow === true;
  const headerFill = typeof styleRaw.headerFill === "string" ? styleRaw.headerFill : "0F172A";
  const headerColor = typeof styleRaw.headerColor === "string" ? styleRaw.headerColor : "FFFFFF";
  const stripeFills = Array.isArray(styleRaw.stripeFills)
    ? styleRaw.stripeFills.filter((item): item is string => typeof item === "string")
    : ["FFFFFF", "F3F4F6"];
  const cells: PresentationTableCell[][] = rows.map((row, rowIndex) => {
    const isHeader = headerRow && rowIndex === 0;
    const dataRowIndex = headerRow ? rowIndex - 1 : rowIndex;
    const fill = isHeader
      ? headerFill
      : stripeFills[dataRowIndex % Math.max(stripeFills.length, 1)] ?? "FFFFFF";
    const cellsInRow = Array.isArray(row) ? row : [];
    return cellsInRow.map((cell) => ({
      paragraphs: tableCellParagraphs(
        typeof cell === "string" ? cell : "",
        style,
        isHeader ? { bold: true, color: headerColor } : undefined,
      ),
      fill,
    }));
  });
  return { cells: cells.length > 0 ? cells : [[emptyTableCell(style)]], style };
}

/** Rewrite a table element in place so it uses the current cells format. */
export function ensureTableFormat(element: PresentationElement): PresentationTableElement | null {
  if (element.type !== "table") return null;
  const raw = element.table as unknown as Record<string, unknown>;
  if (!Array.isArray(raw.cells)) {
    element.table = normalizeTableData(element.table);
  }
  return element;
}

export function addTableElement(
  document: PresentationDocument,
  slideId: string,
  rowCount = 4,
  columnCount = 3,
): AddElementResult | null {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return null;
  const id = nextId("element");
  const width = Math.min(640, document.width - 80);
  const height = Math.min(64 * rowCount, document.height - 80);
  const x = Math.round((document.width - width) / 2);
  const y = Math.round((document.height - height) / 2);
  const style: PresentationTableStyle = { ...TABLE_DEFAULT_STYLE };
  const cells = Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, () => emptyTableCell(style, "FFFFFF")));
  slide.elements.push({
    id,
    sourceElementId: id,
    type: "table",
    x,
    y,
    width,
    height,
    zIndex: topZIndex(slide) + 1,
    metadata: { sourceShapeIndex: -1, sourceShapeType: "table" },
    table: { cells, style },
  });
  return { elementId: id };
}

/** Replace a cell's content with the rich paragraphs committed by the editor. */
export function setTableCellContent(
  element: PresentationElement,
  row: number,
  column: number,
  paragraphs: Array<Record<string, unknown>>,
): void {
  const table = ensureTableFormat(element);
  if (!table) return;
  const cells = table.table.cells[row];
  if (!cells || column < 0 || column >= cells.length) return;
  const cell = cells[column]!;
  cell.paragraphs = paragraphs.length > 0
    ? paragraphs
    : tableCellParagraphs("", table.table.style);
}

export function insertTableRow(element: PresentationElement, afterIndex?: number): void {
  const table = ensureTableFormat(element);
  if (!table) return;
  const cells = table.table.cells;
  const columnCount = cells[0]?.length ?? 0;
  if (columnCount === 0) return;
  const index = Math.max(0, Math.min(afterIndex ?? cells.length - 1, cells.length - 1));
  const template = cells[index]!;
  cells.splice(index + 1, 0, Array.from({ length: columnCount }, (_, columnIndex) =>
    emptyTableCell(table.table.style, template[columnIndex]?.fill)));
}

export function deleteTableRow(element: PresentationElement, index?: number): void {
  const table = ensureTableFormat(element);
  if (!table) return;
  const cells = table.table.cells;
  if (cells.length <= 1) return;
  const target = Math.max(0, Math.min(index ?? cells.length - 1, cells.length - 1));
  cells.splice(target, 1);
}

export function insertTableColumn(element: PresentationElement, afterIndex?: number): void {
  const table = ensureTableFormat(element);
  if (!table) return;
  const cells = table.table.cells;
  const columnCount = cells[0]?.length ?? 0;
  if (columnCount === 0) return;
  const index = Math.max(0, Math.min(afterIndex ?? columnCount - 1, columnCount - 1));
  for (const row of cells) {
    row.splice(index + 1, 0, emptyTableCell(table.table.style, row[index]?.fill));
  }
}

export function deleteTableColumn(element: PresentationElement, index?: number): void {
  const table = ensureTableFormat(element);
  if (!table) return;
  const cells = table.table.cells;
  const columnCount = cells[0]?.length ?? 0;
  if (columnCount <= 1) return;
  const target = Math.max(0, Math.min(index ?? columnCount - 1, columnCount - 1));
  for (const row of cells) row.splice(target, 1);
}

export function patchTableStyle(
  element: PresentationElement,
  patch: Partial<PresentationTableStyle>,
): void {
  const table = ensureTableFormat(element);
  if (!table) return;
  table.table.style = { ...table.table.style, ...patch };
}

export interface TableCellRef {
  row: number;
  col: number;
}

function targetTableCells(
  table: PresentationTableElement,
  cell: TableCellRef | null,
): PresentationTableCell[] {
  if (cell) {
    const target = table.table.cells[cell.row]?.[cell.col];
    return target ? [target] : [];
  }
  return table.table.cells.flat();
}

/** Fill color for one cell, or for every cell when `cell` is null. */
export function patchTableCellFill(
  element: PresentationElement,
  cell: TableCellRef | null,
  fill: string,
): void {
  const table = ensureTableFormat(element);
  if (!table) return;
  for (const target of targetTableCells(table, cell)) {
    if (fill) target.fill = fill;
    else delete target.fill;
  }
}

/**
 * Apply a font patch to every paragraph (and run) of the targeted cell(s),
 * mirroring patchElementFont for text/shape elements.
 */
export function patchTableCellFont(
  element: PresentationElement,
  cell: TableCellRef | null,
  patch: Partial<{
    name: string;
    size: number;
    font_weight: number;
    italic: boolean;
    color: string;
    underline: boolean;
    strike: boolean;
  }>,
): void {
  const table = ensureTableFormat(element);
  if (!table) return;
  const baseFont = {
    name: table.table.style.fontName,
    size: table.table.style.fontSize,
    font_weight: 400,
    italic: false,
    color: table.table.style.textColor,
  };
  for (const target of targetTableCells(table, cell)) {
    for (const entry of target.paragraphs) {
      const paragraph = asRecord(entry);
      const runs = Array.isArray(paragraph.text_runs) ? paragraph.text_runs : [];
      const paragraphFont = asRecord(paragraph.font ?? asRecord(runs[0]).font);
      paragraph.font = { ...baseFont, ...paragraphFont, ...patch };
      for (const runEntry of runs) {
        const run = asRecord(runEntry);
        run.font = { ...baseFont, ...paragraphFont, ...asRecord(run.font), ...patch };
      }
    }
  }
}

export function patchTableCellAlignment(
  element: PresentationElement,
  cell: TableCellRef | null,
  alignment: 1 | 2 | 3,
): void {
  const table = ensureTableFormat(element);
  if (!table) return;
  for (const target of targetTableCells(table, cell)) {
    for (const entry of target.paragraphs) {
      asRecord(entry).alignment = alignment;
    }
  }
}

/** Toolbar state for the targeted cell (or the first cell). */
export function readTableCellFont(element: PresentationElement, cell: TableCellRef | null) {
  if (element.type !== "table") return null;
  const normalized = normalizeTableData(element.table);
  const target = (cell ? normalized.cells[cell.row]?.[cell.col] : undefined)
    ?? normalized.cells[0]?.[0];
  if (!target) return null;
  const paragraph = asRecord(target.paragraphs[0]);
  const runs = Array.isArray(paragraph.text_runs) ? paragraph.text_runs : [];
  const font = asRecord(paragraph.font ?? asRecord(runs[0]).font);
  return {
    name: typeof font.name === "string" ? font.name : normalized.style.fontName,
    size: typeof font.size === "number" ? font.size : normalized.style.fontSize,
    bold: typeof font.font_weight === "number" ? font.font_weight >= 600 : false,
    italic: font.italic === true,
    underline: font.underline === true,
    strike: font.strike === true,
    color: typeof font.color === "string" ? font.color : normalized.style.textColor,
    alignment: paragraph.alignment === 2 ? 2 : paragraph.alignment === 3 ? 3 : 1,
  } as const;
}

export function readTableCellFill(element: PresentationElement, cell: TableCellRef | null): string {
  if (element.type !== "table") return "";
  const normalized = normalizeTableData(element.table);
  const target = (cell ? normalized.cells[cell.row]?.[cell.col] : undefined)
    ?? normalized.cells[0]?.[0];
  return target?.fill ?? "";
}

/** Paste a copied element into the slide with a fresh id and slight offset. */
export function pasteElement(
  document: PresentationDocument,
  slideId: string,
  element: PresentationElement,
): AddElementResult | null {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return null;
  const id = nextId("element");
  const copy = structuredClone(element);
  copy.id = id;
  copy.sourceElementId = id;
  copy.x = Math.min(element.x + 16, Math.max(0, document.width - element.width));
  copy.y = Math.min(element.y + 16, Math.max(0, document.height - element.height));
  copy.zIndex = topZIndex(slide) + 1;
  copy.hidden = false;
  copy.metadata = { ...copy.metadata, sourceShapeIndex: -1 };
  slide.elements.push(copy);
  return { elementId: id };
}

/**
 * Delete an element. Elements added in the editor are removed entirely;
 * elements that originate from the source model are hidden so the source
 * mapping stays intact.
 */
export function deleteElement(document: PresentationDocument, slideId: string, elementId: string): void {
  const slide = document.slides.find((item) => item.id === slideId);
  const element = slide?.elements.find((item) => item.id === elementId);
  if (!slide || !element || element.type === "unsupported") return;
  if (element.metadata.sourceShapeIndex === -1) {
    slide.elements = slide.elements.filter((item) => item.id !== elementId);
  } else {
    element.hidden = true;
  }
}

export type ArrangeAction = "front" | "back" | "forward" | "backward";

export function arrangeElement(
  document: PresentationDocument,
  slideId: string,
  elementId: string,
  action: ArrangeAction,
): void {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return;
  const stacked = [...slide.elements].sort((left, right) => left.zIndex - right.zIndex);
  const index = stacked.findIndex((item) => item.id === elementId);
  if (index < 0) return;
  const target = index + (action === "front" ? stacked.length : action === "back" ? -stacked.length : action === "forward" ? 1 : -1);
  const clamped = Math.max(0, Math.min(target, stacked.length - 1));
  if (clamped === index) return;
  const [moved] = stacked.splice(index, 1);
  stacked.splice(clamped, 0, moved!);
  stacked.forEach((item, zIndex) => {
    item.zIndex = zIndex;
  });
}

function topZIndex(slide: PresentationSlideDocument): number {
  return slide.elements.reduce((max, item) => Math.max(max, item.zIndex), -1);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const DEFAULT_FONT = {
  name: "Microsoft YaHei",
  size: 20,
  font_weight: 400,
  italic: false,
  color: "111827",
};

/**
 * Apply a font patch to every paragraph (and text run) of a text/shape
 * element's source data so the change survives the round trip back to the
 * PPTX model.
 */
export function patchElementFont(
  element: PresentationElement,
  patch: Partial<{
    name: string;
    size: number;
    font_weight: number;
    italic: boolean;
    color: string;
    underline: boolean;
    strike: boolean;
  }>,
): void {
  if (element.type !== "text" && element.type !== "shape") return;
  const source = asRecord(element.sourceData);
  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  if (paragraphs.length === 0) {
    source.paragraphs = [{ text: element.text, font: { ...DEFAULT_FONT, ...patch } }];
    element.sourceData = source;
    return;
  }
  for (const entry of paragraphs) {
    const paragraph = asRecord(entry);
    const runs = Array.isArray(paragraph.text_runs) ? paragraph.text_runs : [];
    const baseFont = asRecord(paragraph.font ?? asRecord(runs[0]).font);
    paragraph.font = { ...DEFAULT_FONT, ...baseFont, ...patch };
    for (const runEntry of runs) {
      const run = asRecord(runEntry);
      if (run.font) run.font = { ...DEFAULT_FONT, ...asRecord(run.font), ...patch };
    }
  }
}

export function patchElementAlignment(element: PresentationElement, alignment: 1 | 2 | 3): void {
  if (element.type !== "text" && element.type !== "shape") return;
  const source = asRecord(element.sourceData);
  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  if (paragraphs.length === 0) {
    source.paragraphs = [{ text: element.text, alignment, font: { ...DEFAULT_FONT } }];
    element.sourceData = source;
    return;
  }
  for (const entry of paragraphs) {
    asRecord(entry).alignment = alignment;
  }
}

export function patchElementFill(
  element: PresentationElement,
  patch: Partial<{ color: string; opacity: number }>,
): void {
  if (element.type !== "text" && element.type !== "shape") return;
  const source = asRecord(element.sourceData);
  const fill = asRecord(source.fill);
  source.fill = {
    color: typeof fill.color === "string" ? fill.color : "FFFFFF",
    opacity: typeof fill.opacity === "number" ? fill.opacity : 1,
    ...patch,
  };
}

export function clearElementFill(element: PresentationElement): void {
  if (element.type !== "text" && element.type !== "shape") return;
  const source = asRecord(element.sourceData);
  delete source.fill;
}

export function patchElementStroke(
  element: PresentationElement,
  patch: Partial<{ color: string; thickness: number; opacity: number }>,
): void {
  if (element.type !== "shape" && element.type !== "text") return;
  const source = asRecord(element.sourceData);
  const stroke = asRecord(source.stroke);
  source.stroke = {
    color: typeof stroke.color === "string" ? stroke.color : "111827",
    thickness: typeof stroke.thickness === "number" ? stroke.thickness : 0,
    opacity: typeof stroke.opacity === "number" ? stroke.opacity : 1,
    ...patch,
  };
}

/**
 * Apply line-height / paragraph spacing to every paragraph of a text or shape
 * element. `line_height` is a multiplier; spacing values are points, mapped to
 * `spacing.top` (space before) and `spacing.bottom` (space after) which is
 * what the PPTX generator reads.
 */
export function patchElementParagraphSpacing(
  element: PresentationElement,
  patch: Partial<{ lineHeight: number; spaceBefore: number; spaceAfter: number }>,
): void {
  if (element.type !== "text" && element.type !== "shape") return;
  const source = asRecord(element.sourceData);
  let paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  if (paragraphs.length === 0) {
    paragraphs = [{ text: element.text, font: { ...DEFAULT_FONT } }];
    source.paragraphs = paragraphs;
    element.sourceData = source;
  }
  for (const entry of paragraphs) {
    const paragraph = asRecord(entry);
    if (patch.lineHeight !== undefined) paragraph.line_height = patch.lineHeight;
    if (patch.spaceBefore !== undefined || patch.spaceAfter !== undefined) {
      const spacing = asRecord(paragraph.spacing);
      paragraph.spacing = {
        top: patch.spaceBefore ?? (typeof spacing.top === "number" ? spacing.top : 0),
        bottom: patch.spaceAfter ?? (typeof spacing.bottom === "number" ? spacing.bottom : 0),
        left: typeof spacing.left === "number" ? spacing.left : 0,
        right: typeof spacing.right === "number" ? spacing.right : 0,
      };
    }
  }
}

export function readElementParagraphSpacing(element: PresentationElement) {
  const source = asRecord(element.sourceData);
  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  const paragraph = asRecord(paragraphs[0]);
  const spacing = asRecord(paragraph.spacing);
  return {
    lineHeight: typeof paragraph.line_height === "number" ? paragraph.line_height : 0,
    spaceBefore: typeof spacing.top === "number" ? spacing.top : 0,
    spaceAfter: typeof spacing.bottom === "number" ? spacing.bottom : 0,
  };
}

export function setElementHyperlink(element: PresentationElement, url: string): void {
  if (element.type !== "text" && element.type !== "shape" && element.type !== "image") return;
  const trimmed = url.trim();
  if (trimmed) element.hyperlink = trimmed;
  else delete element.hyperlink;
}

export function patchImageFit(element: PresentationElement, fit: "cover" | "contain" | "fill"): void {
  if (element.type !== "image") return;
  const source = asRecord(element.sourceData);
  const objectFit = asRecord(source.object_fit);
  source.object_fit = { ...objectFit, fit };
}

export function readElementFont(element: PresentationElement) {
  const source = asRecord(element.sourceData);
  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs : [];
  const paragraph = asRecord(paragraphs[0]);
  const runs = Array.isArray(paragraph.text_runs) ? paragraph.text_runs : [];
  const font = asRecord(paragraph.font ?? asRecord(runs[0]).font);
  return {
    name: typeof font.name === "string" ? font.name : DEFAULT_FONT.name,
    size: typeof font.size === "number" ? font.size : DEFAULT_FONT.size,
    bold: typeof font.font_weight === "number" ? font.font_weight >= 600 : false,
    italic: font.italic === true,
    underline: font.underline === true,
    strike: font.strike === true,
    color: typeof font.color === "string" ? font.color : DEFAULT_FONT.color,
    alignment: paragraph.alignment === 2 ? 2 : paragraph.alignment === 3 ? 3 : 1,
  } as const;
}

export function readElementFill(element: PresentationElement) {
  const source = asRecord(element.sourceData);
  const fill = asRecord(source.fill);
  return {
    color: typeof fill.color === "string" ? fill.color : "",
    opacity: typeof fill.opacity === "number" ? fill.opacity : 1,
  };
}

export function readElementStroke(element: PresentationElement) {
  const source = asRecord(element.sourceData);
  const stroke = asRecord(source.stroke);
  return {
    color: typeof stroke.color === "string" ? stroke.color : "",
    thickness: typeof stroke.thickness === "number" ? stroke.thickness : 0,
  };
}

export function readImageFit(element: PresentationElement): "cover" | "contain" | "fill" {
  const source = asRecord(element.sourceData);
  const fit = asRecord(source.object_fit).fit;
  return fit === "contain" || fit === "fill" ? fit : "cover";
}

export function cssHexColor(value: string, fallback = "#111827"): string {
  if (!value) return fallback;
  const hex = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

export function modelHexColor(value: string): string {
  return value.replace(/^#/, "").toUpperCase();
}
