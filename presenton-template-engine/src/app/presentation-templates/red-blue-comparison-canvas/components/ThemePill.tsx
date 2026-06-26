import React, { type ReactNode } from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

type ThemePillProps = {
  children: ReactNode;
  tone?: RedBlueTone;
  icon?: ReactNode;
  width?: number;
  height?: number;
  className?: string;
};

const ThemePill = ({
  children,
  tone = "purple",
  icon,
  width,
  height = 28,
  className,
}: ThemePillProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];

  return (
    <div
      className={[
        "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-[12px] text-[12px] font-black uppercase leading-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width,
        height,
        gap: icon ? 8 : 0,
        color: toneValue.color,
        backgroundColor: toneValue.tint,
        borderColor: toneValue.border,
      }}
    >
      {icon ? <span className="flex flex-none items-center justify-center">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
};

export default ThemePill;
