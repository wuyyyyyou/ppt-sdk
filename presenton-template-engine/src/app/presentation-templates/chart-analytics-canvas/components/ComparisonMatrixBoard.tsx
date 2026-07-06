import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import { AnalyticsIcon, type AnalyticsIconName } from "./AnalyticsIcons.tsx";

export type ComparisonMatrixEntity = {
  name: string;
  tagline: string;
  accentColor?: string;
  tintColor?: string;
  icon?: AnalyticsIconName | string;
};

export type ComparisonMatrixCell = {
  icon?: AnalyticsIconName | string;
  title: string;
  description: string;
};

export type ComparisonMatrixRow = {
  dimension: string;
  icon?: AnalyticsIconName | string;
  left: ComparisonMatrixCell;
  right: ComparisonMatrixCell;
};

type ComparisonMatrixBoardProps = {
  dimensionLabel: string;
  entities: [ComparisonMatrixEntity, ComparisonMatrixEntity];
  rows: ComparisonMatrixRow[];
};

const rowHeaderWidth = 150;
const matrixGap = 14;

const ComparisonPoint = ({ cell, color }: { cell: ComparisonMatrixCell; color: string }) => (
  <div className="flex min-w-0 items-start gap-[12px]">
    <div className="mt-[2px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[6px]" style={{ backgroundColor: chartAnalyticsTheme.colors.surface }}>
      <AnalyticsIcon name={cell.icon ?? "bolt"} className="h-[15px] w-[15px]" stroke={color} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[14px] font-bold leading-[1.2]" style={{ color: chartAnalyticsTheme.colors.textPrimary }}>
        {cell.title}
      </div>
      <div className="mt-[4px] text-[12px] leading-[1.32]" style={{ color: chartAnalyticsTheme.colors.textSubtle }}>
        {cell.description}
      </div>
    </div>
  </div>
);

const EntityHeader = ({ entity, tone }: { entity: ComparisonMatrixEntity; tone: { color: string; tint: string } }) => {
  const accentColor = entity.accentColor ?? tone.color;
  const tintColor = entity.tintColor ?? tone.tint;

  return (
  <div
    className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-t-[8px] px-[16px]"
    style={{
      backgroundColor: tintColor,
    }}
  >
    <div className="flex items-center gap-[8px]">
      <AnalyticsIcon name={entity.icon ?? "chart-column"} className="h-[16px] w-[16px]" stroke={accentColor} />
      <div className="text-[16px] font-bold leading-[1.1]" style={{ color: chartAnalyticsTheme.colors.textPrimary }}>
        {entity.name}
      </div>
    </div>
    <div className="mt-[5px] text-center text-[10px] font-bold uppercase leading-[1.1]" style={{ color: accentColor }}>
      {entity.tagline}
    </div>
    <div className="absolute bottom-0 left-0 h-[3px] w-full" style={{ backgroundColor: accentColor }} />
  </div>
  );
};

const VerticalSeparator = ({ color = chartAnalyticsTheme.colors.strokeSoft }: { color?: string }) => (
  <div className="h-full w-[1px] flex-none" style={{ backgroundColor: color }} />
);

const HorizontalSeparator = () => (
  <div className="h-[1px] w-full flex-none" style={{ backgroundColor: chartAnalyticsTheme.colors.stroke }} />
);

const DimensionCell = ({ row }: { row: ComparisonMatrixRow }) => (
  <div className="flex min-w-0 flex-none flex-col items-center justify-center px-[14px] text-center" style={{ width: rowHeaderWidth }}>
    <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full" style={{ backgroundColor: chartAnalyticsTheme.colors.strokeSoft }}>
      <AnalyticsIcon name={row.icon ?? "grid"} className="h-[17px] w-[17px]" stroke={chartAnalyticsTheme.colors.textSubtle} />
    </div>
    <div className="mt-[7px] text-[12px] font-bold leading-[1.18]" style={{ color: chartAnalyticsTheme.colors.textPrimary }}>
      {row.dimension}
    </div>
  </div>
);

const ComparisonMatrixBoard = ({ dimensionLabel, entities, rows }: ComparisonMatrixBoardProps) => {
  const [leftEntity, rightEntity] = entities;
  const leftColor = leftEntity.accentColor ?? chartAnalyticsTheme.colors.entityPrimary;
  const rightColor = rightEntity.accentColor ?? chartAnalyticsTheme.colors.entitySecondary;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[58px] flex-none px-[16px]" style={{ gap: matrixGap }}>
        <div
          className="flex flex-none items-end pb-[10px] pl-[8px] text-[11px] font-bold uppercase"
          style={{ width: rowHeaderWidth, color: chartAnalyticsTheme.colors.textMuted }}
        >
          {dimensionLabel}
        </div>
        <div className="min-w-0 flex-1">
          <EntityHeader entity={leftEntity} tone={chartAnalyticsTheme.tone.entityPrimary} />
        </div>
        <div className="min-w-0 flex-1">
          <EntityHeader entity={rightEntity} tone={chartAnalyticsTheme.tone.entitySecondary} />
        </div>
      </div>

      <div
        className="relative mt-[10px] flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px]"
        style={{
          backgroundColor: chartAnalyticsTheme.colors.card,
          boxShadow: chartAnalyticsTheme.shadows.card,
        }}
      >
        {rows.map((row, index) => (
          <React.Fragment key={`${row.dimension}-${index}`}>
            <div
              className="flex min-h-0 flex-1 px-[16px] py-[10px]"
              style={{ backgroundColor: index % 2 === 1 ? chartAnalyticsTheme.colors.surface : chartAnalyticsTheme.colors.card }}
            >
              <DimensionCell row={row} />
              <VerticalSeparator />
              <div className="flex min-w-0 flex-1 items-center px-[14px]">
                <ComparisonPoint cell={row.left} color={leftColor} />
              </div>
              <VerticalSeparator color={chartAnalyticsTheme.colors.stroke} />
              <div className="flex min-w-0 flex-1 items-center px-[14px]">
                <ComparisonPoint cell={row.right} color={rightColor} />
              </div>
            </div>
            {index < rows.length - 1 ? <HorizontalSeparator /> : null}
          </React.Fragment>
        ))}
        <div
          className="pointer-events-none absolute inset-0 z-10 rounded-[12px] border"
          style={{ borderColor: chartAnalyticsTheme.colors.stroke }}
        />
      </div>
    </div>
  );
};

export default ComparisonMatrixBoard;
