import React from "react";

import { FinanceIcon, type FinanceIconName } from "./FinanceIcons.js";

type TrendSignalCardProps = {
  icon: FinanceIconName;
  title: string;
  description: string;
};

const TrendSignalCard = ({
  icon,
  title,
  description,
}: TrendSignalCardProps) => (
  <div
    className="relative flex h-full flex-col items-center overflow-hidden rounded-[6px] border px-[12px] pb-[15px] pt-[19px] text-center"
    style={{
      borderColor: "var(--stroke,#E5E7EB)",
      backgroundColor: "var(--background-color,#FFFFFF)",
      boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
    }}
  >
    <div
      className="absolute left-0 top-0 h-[4px] w-full"
      style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
    />
    <div
      className="mb-[10px] flex h-[48px] w-[48px] items-center justify-center rounded-full"
      style={{ backgroundColor: "#FFEBEE" }}
    >
      <FinanceIcon name={icon} className="h-6 w-6" />
    </div>
    <p
      className="mb-[6px] text-[14px] font-bold leading-[1.3]"
      style={{ color: "var(--background-text,#212121)" }}
    >
      {title}
    </p>
    <p
      className="text-[12px] leading-[1.4]"
      style={{ color: "#616161" }}
    >
      {description}
    </p>
  </div>
);

export default TrendSignalCard;
