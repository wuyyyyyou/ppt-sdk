import React, { type CSSProperties, type ReactNode } from "react";

import { redBlueComparisonTheme } from "../theme/tokens.ts";

type ThemePanelShellProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: number;
  radius?: number;
  borderColor?: string;
  backgroundColor?: string;
  shadow?: string;
};

const ThemePanelShell = ({
  children,
  className,
  style,
  padding = 20,
  radius = redBlueComparisonTheme.radius.lg,
  borderColor = redBlueComparisonTheme.colors.stroke,
  backgroundColor = redBlueComparisonTheme.colors.card,
  shadow = redBlueComparisonTheme.shadow.card,
}: ThemePanelShellProps) => {
  return (
    <div
      className={["overflow-hidden border", className].filter(Boolean).join(" ")}
      style={{
        padding,
        borderColor,
        backgroundColor,
        borderRadius: radius,
        boxShadow: shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default ThemePanelShell;
