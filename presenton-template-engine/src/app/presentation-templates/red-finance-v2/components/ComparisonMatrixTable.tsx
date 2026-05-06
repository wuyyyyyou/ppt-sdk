import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";

type ComparisonMatrixColumn = {
  label: string;
  width?: number | string;
};

type ComparisonMatrixCell = {
  lead: string;
  support?: string;
  tone?: "default" | "accent";
};

type ComparisonMatrixRow = {
  dimension: string;
  cells: ComparisonMatrixCell[];
};

type ComparisonMatrixTableProps = {
  dimensionHeader: string;
  columns: ComparisonMatrixColumn[];
  rows: ComparisonMatrixRow[];
  density?: "normal" | "compact" | "dense";
};

const ComparisonMatrixTable = ({
  dimensionHeader,
  columns,
  rows,
  density = "normal",
}: ComparisonMatrixTableProps) => {
  const isCompact = density === "compact";
  const isDense = density === "dense";
  const headerFontSize = isDense ? 13 : 15;
  const rowTitleFontSize = isDense ? 13 : 14;
  const cellLeadFontSize = isDense ? 13 : 14;
  const cellSupportFontSize = isDense ? 10 : 11;
  const headerPaddingY = isDense ? 12 : 15;
  const cellPaddingY = isDense ? 11 : isCompact ? 12 : 14;

  return (
    <div
      className="h-full overflow-hidden rounded-[8px] border"
      style={{
        backgroundColor: redFinanceTheme.colors.background,
        borderColor: "#E0E0E0",
        boxShadow: "0 4px 6px rgba(0,0,0,0.03)",
      }}
    >
      <table
        className="h-full w-full border-collapse"
        style={{ tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: 110 }} />
          {columns.map((column, index) => (
            <col
              key={`${column.label}-${index}`}
              style={{
                width:
                  typeof column.width === "number"
                    ? `${column.width}px`
                    : column.width,
              }}
            />
          ))}
        </colgroup>
        <thead>
          <tr
            style={{
              backgroundColor: redFinanceTheme.colors.primary,
              color: redFinanceTheme.colors.primaryText,
            }}
          >
            <th
              className="px-[15px] text-center font-bold"
              style={{
                paddingTop: headerPaddingY,
                paddingBottom: headerPaddingY,
                fontSize: headerFontSize,
              }}
            >
              {dimensionHeader}
            </th>
            {columns.map((column, index) => (
              <th
                key={`${column.label}-${index}`}
                className="px-[15px] text-center font-bold"
                style={{
                  paddingTop: headerPaddingY,
                  paddingBottom: headerPaddingY,
                  fontSize: headerFontSize,
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={`${row.dimension}-${rowIndex}`}
              style={{
                height: `${100 / rows.length}%`,
                backgroundColor: rowIndex % 2 === 1 ? "#FAFAFA" : "#FFFFFF",
                borderTop:
                  rowIndex === 0 ? "none" : `1px solid ${redFinanceTheme.colors.stroke}`,
              }}
            >
              <td
                className="align-middle px-[15px] text-center"
                style={{
                  paddingTop: cellPaddingY,
                  paddingBottom: cellPaddingY,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <div
                  className="font-bold"
                  style={{
                    fontSize: rowTitleFontSize,
                    color: redFinanceTheme.colors.backgroundText,
                  }}
                >
                  {row.dimension}
                </div>
              </td>
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={`${row.dimension}-${cellIndex}`}
                  className="align-middle px-[15px] text-center"
                  style={{
                    paddingTop: cellPaddingY,
                    paddingBottom: cellPaddingY,
                    backgroundColor:
                      cell.tone === "accent" ? "rgba(183, 28, 28, 0.03)" : undefined,
                  }}
                >
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div
                      style={{
                        marginBottom: cell.support ? 4 : 0,
                        fontSize: cellLeadFontSize,
                        fontWeight: cell.tone === "accent" ? 700 : 400,
                        color:
                          cell.tone === "accent"
                            ? redFinanceTheme.colors.primary
                            : redFinanceTheme.colors.mutedText,
                      }}
                    >
                      {cell.lead}
                    </div>
                    {cell.support ? (
                      <div
                        style={{
                          fontSize: cellSupportFontSize,
                          color: cell.tone === "accent" ? "#9D2E2E" : "#8F8F8F",
                        }}
                      >
                        {cell.support}
                      </div>
                    ) : null}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonMatrixTable;
