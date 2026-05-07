import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";

export type FinanceDonutChartSegment = {
  label: string;
  value: number;
  color: string;
};

type FinanceDonutChartProps = {
  segments: FinanceDonutChartSegment[];
  centerLabel: string;
  width: number;
  height: number;
  strokeWidth?: number;
  legendWidth?: number;
  centerXRatio?: number;
  innerLabelFontSize?: number;
  legendLabelFontSize?: number;
  legendValueFontSize?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const FinanceDonutChart = ({
  segments,
  centerLabel,
  width,
  height,
  strokeWidth = 24,
  legendWidth = 150,
  centerXRatio = 0.34,
  innerLabelFontSize = 16,
  legendLabelFontSize = 14,
  legendValueFontSize = 14,
}: FinanceDonutChartProps) => {
  const safeWidth = Math.max(width, 240);
  const safeHeight = Math.max(height, 140);
  const total = segments.reduce((sum, item) => sum + Math.max(item.value, 0), 0) || 1;
  const centerX = clamp(safeWidth * centerXRatio, 72, safeWidth - legendWidth - 72);
  const centerY = safeHeight / 2;
  const radius = Math.max(
    20,
    Math.min(centerY - strokeWidth / 2 - 8, centerX - strokeWidth / 2 - 12),
  );
  const circumference = 2 * Math.PI * radius;
  const legendStartX = safeWidth - legendWidth;
  const targetLegendRowHeight = segments.length >= 5 ? 24 : segments.length > 3 ? 28 : 34;
  const legendAvailableHeight = Math.max(safeHeight - 20, targetLegendRowHeight * segments.length);
  const legendRowHeight = Math.min(
    targetLegendRowHeight,
    legendAvailableHeight / Math.max(segments.length, 1),
  );
  const legendHeight = legendRowHeight * segments.length;
  const legendStartY = centerY - legendHeight / 2 + legendRowHeight / 2;

  let offset = 0;
  const arcNodes = segments.map((segment, index) => {
    const normalizedValue = Math.max(segment.value, 0);
    const length = (normalizedValue / total) * circumference;
    const dashOffset = -offset;
    offset += length;

    return (
      <circle
        key={`${segment.label}-${index}`}
        cx={centerX}
        cy={centerY}
        r={radius}
        fill="none"
        stroke={segment.color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${length} ${circumference - length}`}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${centerX} ${centerY})`}
        strokeLinecap="butt"
      />
    );
  });

  return (
    <svg
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      width={safeWidth}
      height={safeHeight}
      aria-hidden="true"
    >
      <circle
        cx={centerX}
        cy={centerY}
        r={radius}
        fill="none"
        stroke="#F2F2F2"
        strokeWidth={strokeWidth}
      />
      {arcNodes}
      <text
        x={centerX}
        y={centerY + innerLabelFontSize * 0.32}
        textAnchor="middle"
        fontSize={innerLabelFontSize}
        fontWeight="700"
        fill={redFinanceTheme.colors.mutedText}
        fontFamily={redFinanceTheme.fonts.body}
      >
        {centerLabel}
      </text>

      {segments.map((segment, index) => {
        const percentage = `${Math.round((Math.max(segment.value, 0) / total) * 100)}%`;
        const rowY = legendStartY + index * legendRowHeight;
        return (
          <g key={`legend-${segment.label}-${index}`}>
            <rect
              x={legendStartX}
              y={rowY - 7}
              width="10"
              height="10"
              rx="3"
              fill={segment.color}
            />
            <text
              x={legendStartX + 18}
              y={rowY}
              fontSize={legendLabelFontSize}
              fontWeight="700"
              fill={redFinanceTheme.colors.backgroundText}
              fontFamily={redFinanceTheme.fonts.body}
            >
              {segment.label}
            </text>
            <text
              x={safeWidth - 4}
              y={rowY}
              textAnchor="end"
              fontSize={legendValueFontSize}
              fill={redFinanceTheme.colors.subtleText}
              fontFamily={redFinanceTheme.fonts.body}
            >
              {percentage}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default FinanceDonutChart;
