import React from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartReferenceProps {
  segments: DonutSegment[];
  centerLabel: string;
  width: number;
  height: number;
  strokeWidth?: number;
}

export default function DonutChartReference({
  segments,
  centerLabel,
  width,
  height,
  strokeWidth = 24,
}: DonutChartReferenceProps) {
  const total = segments.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
  const centerX = Math.min(width * 0.34, width - 230);
  const centerY = height / 2;
  const radius = Math.max(24, Math.min(centerY - 28, centerX - 32));
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg data-pptx-export="screenshot" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      {segments.map((segment) => {
        const length = (Math.max(0, segment.value) / total) * circumference;
        const dashOffset = -offset;
        offset += length;
        return (
          <circle
            key={segment.label}
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${centerX} ${centerY})`}
          />
        );
      })}
      <text x={centerX} y={centerY + 5} textAnchor="middle" fontSize="18" fontWeight="700" fill="#334155">
        {centerLabel}
      </text>
      {segments.map((segment, index) => {
        const y = centerY - ((segments.length - 1) * 34) / 2 + index * 34;
        return (
          <g key={`legend-${segment.label}`}>
            <rect x={width - 210} y={y - 10} width="12" height="12" rx="3" fill={segment.color} />
            <text x={width - 188} y={y} fontSize="14" fontWeight="700" fill="#334155">{segment.label}</text>
            <text x={width - 10} y={y} textAnchor="end" fontSize="14" fill="#64748b">
              {Math.round((Math.max(0, segment.value) / total) * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
