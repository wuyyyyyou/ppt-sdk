import type {
  PresentationTableCell,
  PresentationTableData,
  PresentationTableStyle,
} from "./types.js";

const DEFAULT_STYLE: PresentationTableStyle = {
  borderColor: "E5E7EB",
  textColor: "1F2937",
  fontSize: 14,
  fontName: "Microsoft YaHei",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cellPlainText(cell: PresentationTableCell): string {
  return cell.paragraphs.map((paragraph) => {
    const raw = asRecord(paragraph);
    if (Array.isArray(raw.text_runs)) {
      return raw.text_runs.map((run) => {
        const entry = asRecord(run);
        return typeof entry.text === "string" ? entry.text : "";
      }).join("");
    }
    return typeof raw.text === "string" ? raw.text : "";
  }).join("\n");
}

export function plainTextFromParagraphs(paragraphs: Array<Record<string, unknown>>): string {
  return cellPlainText({ paragraphs });
}

export function paragraphsFromPlainText(
  text: string,
  style: PresentationTableStyle,
  options: { bold?: boolean; color?: string } = {},
): Array<Record<string, unknown>> {
  const lines = text.split("\n");
  return (lines.length > 0 ? lines : [""]).map((line) => ({
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

function emptyCell(style: PresentationTableStyle, fill?: string): PresentationTableCell {
  return {
    paragraphs: paragraphsFromPlainText("", style),
    ...(fill ? { fill } : {}),
  };
}

/**
 * Normalize a table payload that may still use the legacy
 * `{ rows, headerRow, style }` shape into the current `{ cells, style }` shape.
 * Mutates nothing: always returns a fresh structure.
 */
export function normalizeTableData(raw: unknown): PresentationTableData {
  const table = asRecord(raw);
  const styleRaw = asRecord(table.style);
  const style: PresentationTableStyle = {
    borderColor: typeof styleRaw.borderColor === "string" ? styleRaw.borderColor : DEFAULT_STYLE.borderColor,
    textColor: typeof styleRaw.textColor === "string" ? styleRaw.textColor : DEFAULT_STYLE.textColor,
    fontSize: typeof styleRaw.fontSize === "number" ? styleRaw.fontSize : DEFAULT_STYLE.fontSize,
    fontName: typeof styleRaw.fontName === "string" ? styleRaw.fontName : DEFAULT_STYLE.fontName,
  };

  if (Array.isArray(table.cells)) {
    const cells = (table.cells as unknown[]).map((row) => {
      if (!Array.isArray(row)) return [emptyCell(style)];
      return row.map((entry) => {
        const cell = asRecord(entry);
        const paragraphs = Array.isArray(cell.paragraphs)
          ? cell.paragraphs.map((item) => asRecord(item))
          : paragraphsFromPlainText(
              typeof cell.text === "string" ? cell.text : "",
              style,
            );
        return {
          paragraphs: paragraphs.length > 0 ? paragraphs : paragraphsFromPlainText("", style),
          ...(typeof cell.fill === "string" && cell.fill ? { fill: cell.fill } : {}),
        } satisfies PresentationTableCell;
      });
    });
    return { cells: cells.length > 0 ? cells : [[emptyCell(style)]], style };
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
      paragraphs: paragraphsFromPlainText(
        typeof cell === "string" ? cell : "",
        style,
        isHeader ? { bold: true, color: headerColor } : undefined,
      ),
      fill,
    }));
  });
  return {
    cells: cells.length > 0 ? cells : [[emptyCell(style)]],
    style,
  };
}

export function tableCellPlainText(cell: PresentationTableCell): string {
  return cellPlainText(cell);
}

export { DEFAULT_STYLE as TABLE_DEFAULT_STYLE };
