import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

const AnalyticsCanvas = ({ children, variant = "dark" }: { children: React.ReactNode; variant?: "dark" | "light" }) => {
  const isDark = variant === "dark";

  return (
    <div
      className="relative h-[720px] w-[1280px] overflow-hidden"
      style={{
        backgroundColor: isDark ? chartAnalyticsTheme.colors.background : chartAnalyticsTheme.colors.surface,
        color: isDark ? chartAnalyticsTheme.colors.backgroundText : "#0F172A",
        fontFamily: chartAnalyticsTheme.fonts.body,
      }}
    >
      {children}
    </div>
  );
};

export default AnalyticsCanvas;
