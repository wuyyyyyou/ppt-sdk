import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";
import { FinanceIcon, type FinanceIconName } from "./FinanceIcons.js";

type AgendaCardProps = {
  number: string;
  title: string;
  icon: FinanceIconName;
  highlighted?: boolean;
};

const AgendaCard = ({
  number,
  title,
  icon,
  highlighted = false,
}: AgendaCardProps) => {
  const textColor = highlighted
    ? redFinanceTheme.colors.primary
    : redFinanceTheme.colors.backgroundText;
  const iconStroke = highlighted ? redFinanceTheme.colors.primary : "#D6D6D6";

  return (
    <div
      className="relative flex h-[70px] items-center overflow-hidden rounded-[4px] border px-[24px]"
      style={{
        backgroundColor: highlighted
          ? redFinanceTheme.colors.paleRed
          : redFinanceTheme.colors.background,
        borderColor: redFinanceTheme.colors.stroke,
        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
      }}
    >
      {highlighted ? (
        <div
          className="absolute left-0 top-0 h-[70px] w-[5px]"
          style={{ backgroundColor: redFinanceTheme.colors.primary }}
        />
      ) : null}

      <div
        className="flex h-[28px] w-[42px] flex-none items-center justify-end whitespace-nowrap text-right text-[24px] font-black leading-[28px]"
        style={{ color: redFinanceTheme.colors.primary }}
      >
        {number}
      </div>
      <div
        className="ml-[20px] flex h-[28px] min-w-0 flex-1 items-center whitespace-nowrap text-[20px] font-medium leading-[28px]"
        style={{ color: textColor }}
      >
        {title}
      </div>
      <div className="ml-[15px] flex h-[24px] w-[24px] flex-none items-center justify-center">
        <FinanceIcon
          name={icon}
          className="h-[24px] w-[24px]"
          stroke={iconStroke}
        />
      </div>
    </div>
  );
};

export default AgendaCard;
