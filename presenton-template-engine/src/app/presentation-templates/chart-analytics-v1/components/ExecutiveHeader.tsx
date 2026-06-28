import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";

type ExecutiveHeaderProps = {
  eyebrow: string;
  title: string;
  metaLabel: string;
  metaValue: string;
  icon?: string;
};

const ExecutiveHeader = ({
  eyebrow,
  title,
  metaLabel,
  metaValue,
  icon = "chart-pie",
}: ExecutiveHeaderProps) => (
  <div
    className="flex h-[100px] w-full items-center justify-between px-[48px]"
    style={{ backgroundColor: chartAnalyticsTheme.colors.darkPanel }}
  >
    <div className="min-w-0 flex-1">
      <div className="mb-[6px] flex items-center gap-[12px]">
        <div className="h-[4px] w-[32px]" style={{ backgroundColor: chartAnalyticsTheme.colors.primary }} />
        <div className="text-[12px] font-bold uppercase" style={{ color: "#60A5FA" }}>
          {eyebrow}
        </div>
      </div>
      <h1 className="m-0 truncate text-[30px] font-bold leading-[1.15]" style={{ color: chartAnalyticsTheme.colors.darkText }}>
        {title}
      </h1>
    </div>

    <div className="flex flex-none items-center gap-[16px] pl-[28px]">
      <div className="text-right">
        <div className="text-[12px] font-medium uppercase" style={{ color: chartAnalyticsTheme.colors.mutedText }}>
          {metaLabel}
        </div>
        <div className="mt-[3px] text-[14px] font-semibold" style={{ color: chartAnalyticsTheme.colors.darkText }}>
          {metaValue}
        </div>
      </div>
      <div
        className="flex h-[40px] w-[40px] items-center justify-center rounded-[8px]"
        style={{ backgroundColor: chartAnalyticsTheme.colors.primary }}
      >
        <AnalyticsIcon name={icon} className="h-[22px] w-[22px]" stroke="#FFFFFF" />
      </div>
    </div>
  </div>
);

export default ExecutiveHeader;
