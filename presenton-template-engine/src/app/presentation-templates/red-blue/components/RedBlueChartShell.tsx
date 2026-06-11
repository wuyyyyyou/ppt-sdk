import React, { type ReactNode } from "react";

import { redBlueTheme } from "../theme/tokens.ts";

type LegendItem = {
  label: string;
  color: string;
  dashed?: boolean;
};

type RedBlueChartShellProps = {
  title: string;
  subtitle?: string;
  legend?: LegendItem[];
  children: ReactNode;
};

const RedBlueChartShell = ({
  title,
  subtitle,
  legend = [],
  children,
}: RedBlueChartShellProps) => {
  return (
    <div
      className="flex h-full flex-col rounded-[18px] bg-white p-[24px]"
      style={{
        border: "1px solid rgba(0,0,0,0.04)",
        boxShadow: `0 6px 24px ${redBlueTheme.colors.shadow}`,
      }}
    >
      <div className="mb-[18px] flex items-start justify-between gap-[20px]">
        <div className="min-w-0 flex-1">
          <div
            className="text-[18px] font-extrabold"
            style={{ color: redBlueTheme.colors.backgroundText, fontFamily: redBlueTheme.fonts.heading }}
          >
            {title}
          </div>
          {subtitle ? (
            <div className="mt-[4px] text-[13px] font-semibold" style={{ color: redBlueTheme.colors.mutedText }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {legend.length > 0 ? (
          <div className="flex max-w-[220px] flex-none flex-wrap justify-end gap-x-[14px] gap-y-[6px]">
            {legend.map((item) => (
              <div
                key={item.label}
                data-pptx-inline-composition="icon-text"
                className="flex min-w-[62px] items-center gap-[7px] text-[11px] font-bold"
                style={{ color: redBlueTheme.colors.mutedText }}
              >
                <span
                  data-pptx-inline-role="leading"
                  className={item.dashed ? "h-0 w-[20px] flex-none border-t-[2px] border-dashed" : "h-[10px] w-[10px] flex-none rounded-full"}
                  style={item.dashed ? { borderColor: item.color } : { backgroundColor: item.color }}
                />
                <span data-pptx-inline-role="label" className="min-w-0 whitespace-nowrap">{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
};

export default RedBlueChartShell;
