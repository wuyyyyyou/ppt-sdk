import React from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";
import ThemePanelShell from "./ThemePanelShell.tsx";

type ComparisonTableAlign = "left" | "center" | "right";

export type ComparisonTableColumn = {
  label: string;
  width?: string;
  align?: ComparisonTableAlign;
  tone?: RedBlueTone;
};

export type ComparisonTableCell = {
  value: string;
  note?: string;
  tone?: RedBlueTone;
  emphasis?: boolean;
  align?: ComparisonTableAlign;
};

export type ComparisonTableRow = {
  cells: ComparisonTableCell[];
};

type ComparisonTablePanelProps = {
  title: string;
  subtitle?: string;
  columns: ComparisonTableColumn[];
  rows: ComparisonTableRow[];
  footerNote?: string;
  tone?: RedBlueTone;
  className?: string;
};

const alignClassName = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
} as const;

const parseColumnWeight = (column: ComparisonTableColumn) => {
  const width = column.width?.trim();
  if (!width) {
    return 1;
  }

  const frMatch = width.match(/^(\d+(?:\.\d+)?)fr$/);
  if (!frMatch) {
    return 1;
  }

  const value = Number(frMatch[1]);
  return Number.isFinite(value) && value > 0 ? value : 1;
};

const TableGridLines = ({
  columns,
  rowCount,
  color,
}: {
  columns: ComparisonTableColumn[];
  rowCount: number;
  color: string;
}) => {
  const columnWeights = columns.map(parseColumnWeight);
  const totalWeight = columnWeights.reduce((sum, weight) => sum + weight, 0) || columns.length || 1;
  const innerVerticalPositions = columnWeights.slice(0, -1).reduce<number[]>((positions, weight, index) => {
    const previous = positions[index - 1] ?? 0;
    positions.push(previous + (weight / totalWeight) * 100);
    return positions;
  }, []);
  const verticalLinePositions = [0, ...innerVerticalPositions, 100];
  const horizontalLinePositions = [
    "0px",
    "36px",
    ...Array.from({ length: Math.max(rowCount - 1, 0) }, (_, index) =>
      `calc(36px + (100% - 36px) * ${(index + 1) / rowCount})`,
    ),
    "100%",
  ];

  return (
    <div aria-hidden="true" data-validation-ignore="true" className="pointer-events-none absolute inset-0 z-20">
      {verticalLinePositions.map((left, index) => (
        <div
          key={`vertical-${index}`}
          style={{
            position: "absolute",
            left: index === 0 ? 0 : index === verticalLinePositions.length - 1 ? "calc(100% - 1px)" : `calc(${left}% - 0.5px)`,
            top: 0,
            width: 1,
            height: "100%",
            backgroundColor: color,
          }}
        />
      ))}
      {horizontalLinePositions.map((top, index) => (
        <div
          key={`horizontal-${index}`}
          style={{
            position: "absolute",
            left: 0,
            top: index === horizontalLinePositions.length - 1 ? "calc(100% - 1px)" : top,
            width: "100%",
            height: 1,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
};

const ComparisonTablePanel = ({
  title,
  subtitle,
  columns,
  rows,
  footerNote,
  tone = "purple",
  className,
}: ComparisonTablePanelProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];
  const gridTemplateColumns = columns.map((column) => column.width ?? "minmax(0, 1fr)").join(" ");
  const gridLineColor = "#DDD8F7";

  return (
    <ThemePanelShell
      className={["flex h-full min-h-0 flex-col", className].filter(Boolean).join(" ")}
      padding={18}
      radius={redBlueComparisonTheme.radius.lg}
    >
      <div className="mb-[14px] flex flex-none items-start gap-[10px]">
        <div className="mt-[3px] h-[34px] w-[5px] flex-none rounded-full" style={{ backgroundColor: toneValue.color }} />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[18px] font-black"
            style={{
              color: redBlueComparisonTheme.colors.backgroundText,
              fontFamily: redBlueComparisonTheme.fonts.heading,
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              className="mt-[5px] truncate text-[12px] font-medium"
              style={{ color: redBlueComparisonTheme.colors.mutedText }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className="relative h-full min-h-0 overflow-hidden rounded-[8px]"
        >
          <div
            className="relative z-10 grid h-full min-h-0"
            style={{
              gridTemplateRows: `36px repeat(${rows.length}, minmax(0, 1fr))`,
            }}
          >
            <div
              className="grid min-h-0"
              style={{
                gridTemplateColumns,
                backgroundColor: redBlueComparisonTheme.colors.purpleTint,
              }}
            >
              {columns.map((column, index) => {
                const columnTone = column.tone ? redBlueComparisonTheme.tone[column.tone] : toneValue;

                return (
                  <div
                    key={`${column.label}-${index}`}
                    className={[
                      "flex min-w-0 flex-col justify-center px-[10px] text-[11px] font-black uppercase leading-[1.15]",
                      alignClassName[column.align ?? "left"],
                    ].join(" ")}
                    style={{
                      color: columnTone.color,
                    }}
                  >
                    <span className="min-w-0 truncate">{column.label}</span>
                  </div>
                );
              })}
            </div>

            {rows.map((row, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                className="grid min-h-0"
                style={{
                  gridTemplateColumns,
                  backgroundColor: redBlueComparisonTheme.colors.card,
                }}
              >
                {columns.map((column, cellIndex) => {
                  const cell = row.cells[cellIndex] ?? { value: "" };
                  const cellTone = cell.tone ? redBlueComparisonTheme.tone[cell.tone] : undefined;
                  const align = cell.align ?? column.align ?? "left";

                  return (
                    <div
                      key={`cell-${rowIndex}-${cellIndex}`}
                      className={[
                        "flex min-w-0 flex-col justify-center px-[10px] py-[7px]",
                        alignClassName[align],
                      ].join(" ")}
                      style={{
                        backgroundColor: cell.emphasis && cellTone ? cellTone.tint : "transparent",
                        color: cellTone?.color ?? redBlueComparisonTheme.colors.backgroundText,
                      }}
                    >
                      <div
                        className="min-w-0 overflow-hidden text-[13px] font-black leading-[1.2]"
                        style={{ maxHeight: 32 }}
                      >
                        {cell.value}
                      </div>
                      {cell.note ? (
                        <div
                          data-validation-role="multi-line-body-text"
                          className="mt-[4px] min-w-0 overflow-hidden text-[10.5px] font-medium leading-[1.28]"
                          style={{
                            color: redBlueComparisonTheme.colors.mutedText,
                            maxHeight: 28,
                          }}
                        >
                          {cell.note}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <TableGridLines
            columns={columns}
            rowCount={rows.length}
            color={gridLineColor}
          />
        </div>
      </div>

      {footerNote ? (
        <div
          data-validation-role="multi-line-body-text"
          className="mt-[12px] flex h-[26px] flex-none items-center overflow-hidden truncate whitespace-nowrap rounded-[6px] px-[12px] text-[10.5px] font-bold leading-none"
          style={{
            color: toneValue.color,
            backgroundColor: toneValue.tint,
            border: `1px solid ${toneValue.border}`,
          }}
        >
          {footerNote}
        </div>
      ) : null}
    </ThemePanelShell>
  );
};

export default ComparisonTablePanel;
