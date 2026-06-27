import React, { type ReactNode } from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

type AnalyticsCardShellProps = {
  children: ReactNode;
  accentColor?: string;
  className?: string;
  padding?: number;
  dark?: boolean;
};

const AnalyticsCardShell = ({
  children,
  accentColor,
  className,
  padding = 20,
  dark = false,
}: AnalyticsCardShellProps) => (
  <div
    className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border ${className ?? ""}`.trim()}
    style={{
      backgroundColor: dark ? chartAnalyticsTheme.colors.panel : chartAnalyticsTheme.colors.card,
      borderColor: dark ? "transparent" : chartAnalyticsTheme.colors.stroke,
      boxShadow: dark ? "0 10px 18px rgba(15,23,42,0.18)" : "0 4px 8px rgba(15,23,42,0.05)",
      padding,
    }}
  >
    {accentColor ? (
      <div className="absolute left-0 top-0 h-[4px] w-full flex-none" style={{ backgroundColor: accentColor }} />
    ) : null}
    {children}
  </div>
);

export default AnalyticsCardShell;
