import React, { type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.ts";

type ChartCardShellProps = {
  title: string;
  subtitle?: string;
  rightMeta?: string;
  children: ReactNode;
  className?: string;
  padding?: number;
  headerMarginBottom?: number;
};

const ChartCardShell = ({
  title,
  subtitle,
  rightMeta,
  children,
  className,
  padding = 20,
  headerMarginBottom = 15,
}: ChartCardShellProps) => (
  <div
    data-pptx-export="screenshot"
    data-chart-like="true"
    className={`flex h-full flex-col rounded-[8px] border ${className ?? ""}`.trim()}
    style={{
      padding,
      backgroundColor: redFinanceTheme.colors.panel,
      borderColor: redFinanceTheme.colors.stroke,
      boxShadow: redFinanceTheme.shadows.card,
    }}
  >
    <div
      className="flex items-start justify-between gap-[16px]"
      style={{ marginBottom: headerMarginBottom }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-[10px]">
          <div
            className="h-[18px] w-[3px] rounded-full"
            style={{ backgroundColor: redFinanceTheme.colors.accent }}
          />
          <h3
            className="min-w-0 truncate text-[16px] font-bold"
            style={{ color: redFinanceTheme.colors.textPrimary }}
          >
            {title}
          </h3>
        </div>
        {subtitle ? (
          <div
            className="mt-[6px] pl-[13px] text-[12px]"
            style={{ color: redFinanceTheme.colors.textMuted }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {rightMeta ? (
        <div
          className="flex-none rounded-[4px] border px-[8px] py-[2px] text-[12px]"
          style={{
            borderColor: redFinanceTheme.colors.stroke,
            color: redFinanceTheme.colors.textMuted,
            backgroundColor: redFinanceTheme.colors.surface,
          }}
        >
          {rightMeta}
        </div>
      ) : null}
    </div>

    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      data-validation-ignore="true"
    >
      {children}
    </div>
  </div>
);

export default ChartCardShell;
