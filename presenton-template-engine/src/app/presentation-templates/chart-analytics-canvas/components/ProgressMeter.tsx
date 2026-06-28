import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

type ProgressMeterProps = {
  value: number;
  color?: string;
  backgroundColor?: string;
  height?: number;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const ProgressMeter = ({
  value,
  color = chartAnalyticsTheme.colors.primary,
  backgroundColor = "#F1F5F9",
  height = 8,
}: ProgressMeterProps) => (
  <div className="w-full overflow-hidden rounded-full" style={{ height, backgroundColor }}>
    <div className="h-full rounded-full" style={{ width: `${clamp(value)}%`, backgroundColor: color }} />
  </div>
);

export default ProgressMeter;
