import React, { type CSSProperties, type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.js";

type IconTextProps = {
  icon: ReactNode;
  label: string;
  height?: number;
  iconSize?: number;
  gap?: number;
  textWidth?: number;
  minTextWidth?: number;
  fontSize?: number;
  fontWeight?: CSSProperties["fontWeight"];
  textColor?: string;
};

const IconText = ({
  icon,
  label,
  height = 24,
  iconSize = 18,
  gap = 10,
  textWidth,
  minTextWidth,
  fontSize = 16,
  fontWeight = 500,
  textColor = redFinanceTheme.colors.backgroundText,
}: IconTextProps) => {
  return (
    <div
      className="inline-flex items-center"
      style={{
        height,
        gap,
        fontSize,
      }}
    >
      <div
        className="flex flex-none items-center justify-center"
        style={{
          width: iconSize,
          height: iconSize,
        }}
      >
        {icon}
      </div>
      <div
        className="flex items-center whitespace-nowrap"
        style={{
          height,
          lineHeight: `${height}px`,
          width: textWidth ? `${textWidth}px` : undefined,
          minWidth: minTextWidth ? `${minTextWidth}px` : undefined,
          fontWeight,
          color: textColor,
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default IconText;
