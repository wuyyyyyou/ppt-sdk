import React, { type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.js";

type CoverMetaItemProps = {
  icon: ReactNode;
  label: string;
  minTextWidth?: number;
};

export const CoverMetaItem = ({
  icon,
  label,
  minTextWidth,
}: CoverMetaItemProps) => {
  return (
    <div
      className="inline-flex h-[24px] items-center gap-[10px] text-[16px]"
      style={{ color: redFinanceTheme.colors.subtleText }}
    >
      <div className="flex h-[18px] w-[18px] flex-none items-center justify-center">
        {icon}
      </div>
      <div
        className="flex h-[24px] items-center whitespace-nowrap font-medium leading-[24px]"
        style={{
          color: redFinanceTheme.colors.backgroundText,
          minWidth: minTextWidth ? `${minTextWidth}px` : undefined,
        }}
      >
        {label}
      </div>
    </div>
  );
};
