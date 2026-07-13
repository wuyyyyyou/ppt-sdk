import React, { type ReactNode } from "react";

import { theme } from "../theme.ts";

type SectionPanelShellProps = {
  children: ReactNode;
  className?: string;
  backgroundColor?: string;
  borderColor?: string;
  shadow?: string;
  radius?: number;
  paddingX?: number;
  paddingY?: number;
};

const SectionPanelShell = ({
  children,
  className,
  backgroundColor = theme.colors.panel,
  borderColor = theme.colors.stroke,
  shadow = "none",
  radius = 10,
  paddingX = 20,
  paddingY = 18,
}: SectionPanelShellProps) => (
  <div
    className={["flex flex-col border", className].filter(Boolean).join(" ")}
    style={{
      backgroundColor,
      borderColor,
      boxShadow: shadow,
      borderRadius: radius,
      paddingLeft: paddingX,
      paddingRight: paddingX,
      paddingTop: paddingY,
      paddingBottom: paddingY,
    }}
  >
    {children}
  </div>
);

export default SectionPanelShell;
