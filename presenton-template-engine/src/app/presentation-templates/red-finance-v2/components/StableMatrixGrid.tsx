import React, { type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.js";

type StableMatrixGridTone = "default" | "accent";
type StableMatrixGridAlign = "left" | "center" | "right";

export type StableMatrixGridColumn = {
  id?: string;
  label: string;
  width?: number | string;
  headerAlign?: StableMatrixGridAlign;
  cellAlign?: StableMatrixGridAlign;
  tone?: StableMatrixGridTone;
};

export type StableMatrixGridCell = {
  lead: string;
  support?: string;
  content?: ReactNode;
  tone?: StableMatrixGridTone;
  align?: StableMatrixGridAlign;
  backgroundColor?: string;
  leadColor?: string;
  supportColor?: string;
  leadWeight?: 400 | 500 | 600 | 700;
};

export type StableMatrixGridRow = {
  id?: string;
  header: string;
  headerAlign?: StableMatrixGridAlign;
  headerBackgroundColor?: string;
  backgroundColor?: string;
  cells: StableMatrixGridCell[];
};

type StableMatrixGridProps = {
  rowHeaderLabel: string;
  rowHeaderWidth?: number | string;
  columns: StableMatrixGridColumn[];
  rows: StableMatrixGridRow[];
  density?: "normal" | "compact" | "dense";
  outerBorderColor?: string;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  rowDividerColor?: string;
  stripeColors?: [string, string];
  rowHeaderBackgroundColor?: string;
  shadow?: string;
  borderRadius?: number;
};

function resolveTextAlign(align?: StableMatrixGridAlign): "left" | "center" | "right" {
  return align ?? "center";
}

function resolveFlexAlignment(align?: StableMatrixGridAlign): "flex-start" | "center" | "flex-end" {
  if (align === "left") {
    return "flex-start";
  }
  if (align === "right") {
    return "flex-end";
  }
  return "center";
}

function resolveColumnWidth(width: number | string | undefined, fallback: string): string {
  if (typeof width === "number") {
    return `${width}px`;
  }
  if (typeof width === "string" && width.length > 0) {
    return width;
  }
  return fallback;
}

const StableMatrixGrid = ({
  rowHeaderLabel,
  rowHeaderWidth = 110,
  columns,
  rows,
  density = "normal",
  outerBorderColor = "#E0E0E0",
  headerBackgroundColor = redFinanceTheme.colors.primary,
  headerTextColor = redFinanceTheme.colors.primaryText,
  rowDividerColor = redFinanceTheme.colors.stroke,
  stripeColors = ["#FFFFFF", "#FAFAFA"],
  rowHeaderBackgroundColor = "#FFFFFF",
  shadow = "0 4px 6px rgba(0,0,0,0.03)",
  borderRadius = 8,
}: StableMatrixGridProps) => {
  const isCompact = density === "compact";
  const isDense = density === "dense";
  const headerFontSize = isDense ? 13 : 15;
  const rowHeaderFontSize = isDense ? 13 : 14;
  const cellLeadFontSize = isDense ? 13 : 14;
  const cellSupportFontSize = isDense ? 10 : 11;
  const headerPaddingY = isDense ? 12 : 15;
  const cellPaddingY = isDense ? 11 : isCompact ? 12 : 14;
  const columnTemplate = [
    resolveColumnWidth(rowHeaderWidth, "110px"),
    ...columns.map((column, index) =>
      resolveColumnWidth(
        column.width,
        index === columns.length - 1 ? "minmax(0, 1fr)" : "1fr",
      )),
  ].join(" ");

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        backgroundColor: redFinanceTheme.colors.background,
        boxShadow: shadow,
        borderRadius,
      }}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateRows: `auto repeat(${rows.length}, minmax(0, 1fr))`,
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: columnTemplate,
            backgroundColor: headerBackgroundColor,
            color: headerTextColor,
          }}
        >
          <div
            className="flex items-center px-[15px] font-bold"
            style={{
              justifyContent: "center",
              paddingTop: headerPaddingY,
              paddingBottom: headerPaddingY,
              fontSize: headerFontSize,
              textAlign: "center",
            }}
          >
            {rowHeaderLabel}
          </div>
          {columns.map((column, index) => (
            <div
              key={column.id ?? `${column.label}-${index}`}
              className="flex items-center px-[15px] font-bold"
              style={{
                justifyContent: resolveFlexAlignment(column.headerAlign),
                paddingTop: headerPaddingY,
                paddingBottom: headerPaddingY,
                fontSize: headerFontSize,
                textAlign: resolveTextAlign(column.headerAlign),
              }}
            >
              {column.label}
            </div>
          ))}
        </div>

        {rows.map((row, rowIndex) => {
          const baseRowBackground = row.backgroundColor ?? stripeColors[rowIndex % 2];
          return (
            <div
              key={row.id ?? `${row.header}-${rowIndex}`}
              className="grid"
              style={{
                gridTemplateColumns: columnTemplate,
                backgroundColor: baseRowBackground,
                borderTop: rowIndex === 0 ? "none" : `1px solid ${rowDividerColor}`,
              }}
            >
              <div
                className="flex px-[15px]"
                style={{
                  alignItems: "center",
                  justifyContent: resolveFlexAlignment(row.headerAlign),
                  textAlign: resolveTextAlign(row.headerAlign),
                  paddingTop: cellPaddingY,
                  paddingBottom: cellPaddingY,
                  backgroundColor: row.headerBackgroundColor ?? rowHeaderBackgroundColor,
                }}
              >
                <div
                  className="font-bold"
                  style={{
                    fontSize: rowHeaderFontSize,
                    color: redFinanceTheme.colors.backgroundText,
                  }}
                >
                  {row.header}
                </div>
              </div>

              {row.cells.map((cell, cellIndex) => {
                const column = columns[cellIndex];
                const tone = cell.tone ?? column?.tone ?? "default";
                const align = cell.align ?? column?.cellAlign;
                return (
                  <div
                    key={`${row.id ?? row.header}-${cellIndex}`}
                    className="flex px-[15px]"
                    style={{
                      alignItems: "center",
                      justifyContent: resolveFlexAlignment(align),
                      textAlign: resolveTextAlign(align),
                      paddingTop: cellPaddingY,
                      paddingBottom: cellPaddingY,
                      backgroundColor:
                        cell.backgroundColor ??
                        (tone === "accent" ? "rgba(183, 28, 28, 0.03)" : undefined),
                    }}
                  >
                    <div
                      className="flex h-full flex-col"
                      style={{
                        alignItems: resolveFlexAlignment(align),
                        justifyContent: "center",
                        textAlign: resolveTextAlign(align),
                      }}
                    >
                      {cell.content ? (
                        cell.content
                      ) : (
                        <>
                          <div
                            style={{
                              marginBottom: cell.support ? 4 : 0,
                              fontSize: cellLeadFontSize,
                              fontWeight: cell.leadWeight ?? (tone === "accent" ? 700 : 400),
                              color:
                                cell.leadColor ??
                                (tone === "accent"
                                  ? redFinanceTheme.colors.primary
                                  : redFinanceTheme.colors.mutedText),
                            }}
                          >
                            {cell.lead}
                          </div>
                          {cell.support ? (
                            <div
                              style={{
                                fontSize: cellSupportFontSize,
                                color:
                                  cell.supportColor ??
                                  (tone === "accent" ? "#9D2E2E" : "#8F8F8F"),
                              }}
                            >
                              {cell.support}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div
        className="pointer-events-none absolute inset-0 border"
        style={{
          borderColor: outerBorderColor,
          borderRadius,
        }}
      />
    </div>
  );
};

export default StableMatrixGrid;
