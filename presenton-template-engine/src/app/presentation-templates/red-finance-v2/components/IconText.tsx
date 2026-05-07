import React, { type CSSProperties, type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.js";
import StableInlineRow from "./StableInlineRow.js";

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
  noWrap?: boolean;
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
  noWrap = true,
}: IconTextProps) => {
  return (
    <StableInlineRow
      height={height}
      gap={gap}
      style={{
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
        className={["flex items-center", noWrap ? "whitespace-nowrap" : "whitespace-normal"].join(" ")}
        style={{
          height: noWrap ? height : undefined,
          lineHeight: noWrap ? `${height}px` : 1.35,
          width: textWidth ? `${textWidth}px` : undefined,
          minWidth: minTextWidth ? `${minTextWidth}px` : undefined,
          fontWeight,
          color: textColor,
        }}
      >
        {label}
      </div>
    </StableInlineRow>
  );
};

export default IconText;
