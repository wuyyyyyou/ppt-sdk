import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";

type FinanceIconName = "bank" | "calendar" | "user" | "shield";

type FinanceIconProps = {
  name: FinanceIconName;
  className?: string;
  stroke?: string;
};

const defaultStroke = redFinanceTheme.colors.primary;
const iconFrameClass = "relative inline-block flex-none";

export const FinanceIcon = ({
  name,
  className = "h-5 w-5",
  stroke = defaultStroke,
}: FinanceIconProps) => {
  switch (name) {
    case "bank":
      return (
        <div aria-hidden="true" className={`${iconFrameClass} ${className}`}>
          <div className="absolute left-[8%] right-[8%] top-[18%] h-[2px]" style={{ backgroundColor: stroke }} />
          <div className="absolute left-[16%] right-[16%] top-[34%] h-[2px]" style={{ backgroundColor: stroke }} />
          <div className="absolute bottom-[14%] left-[10%] right-[10%] h-[2px]" style={{ backgroundColor: stroke }} />
          {[22, 40, 58, 76].map((left) => (
            <div
              key={left}
              className="absolute bottom-[22%] top-[42%] w-[2px]"
              style={{ left: `${left}%`, backgroundColor: stroke }}
            />
          ))}
        </div>
      );
    case "calendar":
      return (
        <div aria-hidden="true" className={`${iconFrameClass} ${className}`}>
          <div className="absolute left-[14%] right-[14%] top-[20%] bottom-[10%] rounded-[2px] border-[2px]" style={{ borderColor: stroke }} />
          <div className="absolute left-[14%] right-[14%] top-[42%] h-[2px]" style={{ backgroundColor: stroke }} />
          <div className="absolute left-[30%] top-[10%] h-[24%] w-[2px]" style={{ backgroundColor: stroke }} />
          <div className="absolute right-[30%] top-[10%] h-[24%] w-[2px]" style={{ backgroundColor: stroke }} />
        </div>
      );
    case "user":
      return (
        <div aria-hidden="true" className={`${iconFrameClass} ${className}`}>
          <div className="absolute left-[35%] top-[14%] h-[30%] w-[30%] rounded-full border-[2px]" style={{ borderColor: stroke }} />
          <div className="absolute left-[22%] right-[22%] bottom-[14%] h-[30%] rounded-t-full border-[2px] border-b-0" style={{ borderColor: stroke }} />
        </div>
      );
    case "shield":
      return (
        <div aria-hidden="true" className={`${iconFrameClass} ${className}`}>
          <div className="absolute left-[24%] right-[24%] top-[14%] bottom-[12%] rounded-b-[9px] rounded-t-[3px] border-[2px]" style={{ borderColor: stroke }} />
          <div className="absolute left-[38%] top-[54%] h-[2px] w-[18%]" style={{ backgroundColor: stroke }} />
          <div className="absolute left-[50%] top-[46%] h-[2px] w-[22%]" style={{ backgroundColor: stroke }} />
        </div>
      );
    default:
      return null;
  }
};
