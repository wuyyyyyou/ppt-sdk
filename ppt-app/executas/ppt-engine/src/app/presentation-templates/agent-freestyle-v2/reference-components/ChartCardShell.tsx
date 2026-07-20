import React, { type ReactNode } from "react";

import { theme } from "../theme.ts";

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

    data-chart-like="true"
    className={`flex h-full flex-col rounded-[8px] border ${className ?? ""}`.trim()}
    style={{
      padding,
      backgroundColor: theme.colors.panel,
      borderColor: theme.colors.stroke,
      boxShadow: theme.shadows.card,
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
            style={{ backgroundColor: theme.colors.accent }}
          />
          <h3
            className="min-w-0 truncate text-[16px] font-bold"
            style={{ color: theme.colors.textPrimary }}
          >
            {title}
          </h3>
        </div>
        {subtitle ? (
          <div
            className="mt-[6px] pl-[13px] text-[12px]"
            style={{ color: theme.colors.textMuted }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {rightMeta ? (
        <div
          className="flex-none rounded-[4px] border px-[8px] py-[2px] text-[12px]"
          style={{
            borderColor: theme.colors.stroke,
            color: theme.colors.textMuted,
            backgroundColor: theme.colors.surface,
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
