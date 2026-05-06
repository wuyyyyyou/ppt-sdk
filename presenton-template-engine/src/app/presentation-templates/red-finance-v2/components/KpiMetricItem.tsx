import React from "react";

type KpiMetricItemProps = {
  value: string;
  label: string;
};

const KpiMetricItem = ({ value, label }: KpiMetricItemProps) => (
  <div className="flex items-center gap-[10px] whitespace-nowrap">
    <span
      className="text-[17px] font-black leading-[1]"
      style={{ color: "var(--primary-color,#B71C1C)" }}
    >
      {value}
    </span>
    <span
      className="text-[12px] leading-[1.2]"
      style={{ color: "var(--text-muted,#616161)" }}
    >
      {label}
    </span>
  </div>
);

export default KpiMetricItem;
