import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";

type FinanceSectionHeadingProps = {
  title: string;
  subtitle?: string;
  marginBottom?: number;
};

const FinanceSectionHeading = ({
  title,
  subtitle,
  marginBottom = 8,
}: FinanceSectionHeadingProps) => (
  <div
    className="flex items-end justify-between gap-[12px]"
    style={{ marginBottom }}
  >
    <div className="flex items-center gap-[10px]">
      <div
        className="h-[22px] w-[4px] rounded-full"
        style={{ backgroundColor: redFinanceTheme.colors.primary }}
      />
      <h2
        className="text-[18px] font-bold"
        style={{ color: redFinanceTheme.colors.backgroundText }}
      >
        {title}
      </h2>
    </div>
    {subtitle ? (
      <div
        className="whitespace-nowrap text-[12px]"
        style={{ color: redFinanceTheme.colors.subtleText }}
      >
        {subtitle}
      </div>
    ) : null}
  </div>
);

export default FinanceSectionHeading;
