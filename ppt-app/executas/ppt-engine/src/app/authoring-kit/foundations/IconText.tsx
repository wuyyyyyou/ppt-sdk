import React, { type CSSProperties, type ReactNode } from "react";

import StableInlineRow from "./StableInlineRow.tsx";

export interface IconTextProps {
  icon: ReactNode;
  label: ReactNode;
  height?: number;
  iconSize?: number;
  gap?: number;
  textWidth?: number;
  minTextWidth?: number;
  fontSize?: number;
  fontWeight?: CSSProperties["fontWeight"];
  color?: string;
  noWrap?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function IconText({
  icon,
  label,
  height = 24,
  iconSize = 18,
  gap = 10,
  textWidth,
  minTextWidth,
  fontSize = 16,
  fontWeight = 500,
  color,
  noWrap = true,
  className,
  style,
}: IconTextProps) {
  return (
    <StableInlineRow
      height={height}
      gap={gap}
      className={className}
      style={{ fontSize, color, ...style }}
    >
      <span

        className="flex flex-none items-center justify-center"
        style={{ width: iconSize, height: iconSize }}
      >
        {icon}
      </span>
      <span

        className={noWrap ? "flex items-center whitespace-nowrap" : "flex items-center whitespace-normal"}
        style={{
          height: noWrap ? height : undefined,
          lineHeight: noWrap ? `${height}px` : 1.35,
          width: textWidth,
          minWidth: minTextWidth,
          fontWeight,
        }}
      >
        {label}
      </span>
    </StableInlineRow>
  );
}
