import React from "react";

import {
  FinanceIcon,
  type FinanceIconName,
} from "./FinanceIcons.js";
import StableInlineRow from "./StableInlineRow.js";

export type StrategyPillarItem = {
  lead: string;
  body: string;
};

type StrategyPillarCardProps = {
  number: string;
  icon: FinanceIconName;
  title: string;
  items: StrategyPillarItem[];
};

const STRATEGY_ITEM_LINE_HEIGHT = 19;

const StrategyPillarCard = ({
  number,
  icon,
  title,
  items,
}: StrategyPillarCardProps) => (
  <div
    className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border px-[20px] pb-[18px] pt-[22px]"
    style={{
      borderColor: "var(--stroke,#E5E7EB)",
      backgroundColor: "var(--background-color,#FFFFFF)",
      boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
    }}
  >
    <div
      className="absolute left-0 top-0 h-[6px] w-full"
      style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
    />

    <div
      className="absolute right-[16px] top-[14px] text-[42px] font-black leading-none"
      style={{ color: "#FDEBEC" }}
    >
      {number}
    </div>

    <div
      className="mb-[14px] flex h-[56px] w-[56px] items-center justify-center rounded-[12px]"
      style={{ backgroundColor: "#FFEBEE" }}
    >
      <FinanceIcon name={icon} className="h-6 w-6" />
    </div>

    <h2
      className="text-[18px] font-bold leading-[1.2]"
      style={{ color: "var(--background-text,#212121)" }}
    >
      {title}
    </h2>

    <div
      className="mb-[12px] mt-[8px] h-px w-full"
      style={{ backgroundColor: "var(--stroke,#E5E7EB)" }}
    />

    <div className="flex min-h-0 flex-1 flex-col gap-[10px] overflow-hidden">
      {items.map((item, index) => (
        <div
          key={`${title}-${index}`}
          className="flex items-start gap-[12px]"
        >
          <StableInlineRow
            height={STRATEGY_ITEM_LINE_HEIGHT}
            gap={0}
            inline={false}
            className="w-[6px] flex-none"
          >
            <div
              className="h-[6px] w-[6px] rounded-full"
              style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
            />
          </StableInlineRow>
          <div className="flex min-w-0 flex-1 flex-col">
            <StableInlineRow
              height={STRATEGY_ITEM_LINE_HEIGHT}
              gap={0}
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--background-text,#212121)",
              }}
            >
              <span>{item.lead}：</span>
            </StableInlineRow>
            <div
              className="mt-[1px] text-[13px]"
              style={{
                lineHeight: "1.45",
                color: "var(--text-muted,#616161)",
              }}
            >
              {item.body}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default StrategyPillarCard;
