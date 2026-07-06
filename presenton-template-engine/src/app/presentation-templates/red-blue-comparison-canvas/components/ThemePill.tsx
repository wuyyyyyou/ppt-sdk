import React, { type ReactNode } from "react";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";

type ThemePillProps = {
  children: ReactNode;
  tone?: ComparisonTone;
  icon?: ReactNode;
  width?: number;
  height?: number;
  className?: string;
};

const ThemePill = ({
  children,
  tone = "comparison",
  icon,
  width,
  height = 28,
  className,
}: ThemePillProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];

  return (
    <div
      className={[
        "inline-flex items-center justify-center rounded-full border px-[12px] py-[4px] text-center text-[12px] font-black uppercase leading-[1.15]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width,
        minHeight: height,
        gap: icon ? 8 : 0,
        color: toneValue.color,
        backgroundColor: toneValue.tint,
        borderColor: toneValue.border,
      }}
    >
      {icon ? <span className="flex flex-none items-center justify-center">{icon}</span> : null}
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
};

export default ThemePill;
