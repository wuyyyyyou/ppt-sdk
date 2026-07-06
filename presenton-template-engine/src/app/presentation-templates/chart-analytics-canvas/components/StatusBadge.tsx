import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

type StatusBadgeProps = {
  label: string;
  color?: string;
  backgroundColor?: string;
};

const StatusBadge = ({
  label,
  color = chartAnalyticsTheme.colors.signalNeutral,
  backgroundColor = chartAnalyticsTheme.colors.signalNeutralTint,
}: StatusBadgeProps) => (
  <span
    className="inline-flex max-w-[110px] items-center justify-center truncate rounded-[4px] px-[8px] py-[4px] text-[10px] font-bold uppercase"
    style={{ color, backgroundColor }}
  >
    {label}
  </span>
);

export default StatusBadge;
