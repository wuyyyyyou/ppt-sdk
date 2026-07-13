import React from "react";

import { theme } from "../theme.ts";

type FinanceSectionHeadingProps = {
  title: string;
  subtitle?: string;
  marginBottom?: number;
  subtitleLayout?: "inline" | "stacked";
};

const FinanceSectionHeading = ({
  title,
  subtitle,
  marginBottom = 8,
  subtitleLayout = "inline",
}: FinanceSectionHeadingProps) => {
  if (subtitleLayout === "stacked") {
    return (
      <div
        className="flex items-start gap-[10px]"
        style={{ marginBottom }}
      >
        <div
          className="mt-[2px] h-[22px] w-[4px] flex-none rounded-full"
          style={{ backgroundColor: theme.colors.accent }}
        />
        <div className="min-w-0">
          <h2
            className="text-[18px] font-bold leading-[22px]"
            style={{ color: theme.colors.textPrimary }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p
              className="mt-[4px] text-[12px] leading-[16px]"
              style={{ color: theme.colors.textSubtle }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-end justify-between gap-[12px]"
      style={{ marginBottom }}
    >
      <div className="flex items-center gap-[10px]">
        <div
          className="h-[22px] w-[4px] rounded-full"
          style={{ backgroundColor: theme.colors.accent }}
        />
        <h2
          className="text-[18px] font-bold"
          style={{ color: theme.colors.textPrimary }}
        >
          {title}
        </h2>
      </div>
      {subtitle ? (
        <div
          className="whitespace-nowrap text-[12px]"
          style={{ color: theme.colors.textSubtle }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};

export default FinanceSectionHeading;
