import React, { type ReactNode } from "react";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";
import ThemePanelShell from "./ThemePanelShell.tsx";
import ThemePill from "./ThemePill.tsx";

type ChartContainerProps = {
  title: ReactNode;
  children: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  tone?: ComparisonTone;
  padding?: number;
  className?: string;
};

const ChartContainer = ({
  title,
  children,
  subtitle,
  meta,
  tone = "comparison",
  padding = 20,
  className,
}: ChartContainerProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];

  return (
    <ThemePanelShell
      className={["flex h-full min-h-0 flex-col", className].filter(Boolean).join(" ")}
      padding={padding}
      radius={redBlueComparisonTheme.radius.xl}
    >
      <div className="mb-[16px] flex flex-none items-start justify-between gap-[16px]">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-[10px]">
            <div className="h-[18px] w-[4px] flex-none rounded-full" style={{ backgroundColor: toneValue.color }} />
            <div className="min-w-0 break-words text-[17px] font-black" style={{ color: redBlueComparisonTheme.colors.textPrimary }}>
              {title}
            </div>
          </div>
          {subtitle ? (
            <div className="mt-[6px] break-words pl-[14px] text-[12px] font-medium" style={{ color: redBlueComparisonTheme.colors.textMuted }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {meta ? (
          <ThemePill tone={tone} height={24}>
            {meta}
          </ThemePill>
        ) : null}
      </div>

      <div
        className="min-h-0 flex-1 overflow-hidden"
        data-chart-like="true"
        data-validation-ignore="true"
      >
        {children}
      </div>
    </ThemePanelShell>
  );
};

export default ChartContainer;
