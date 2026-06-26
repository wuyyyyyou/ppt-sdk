import React, { type ReactNode } from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  description?: ReactNode;
  tone?: RedBlueTone;
  icon?: ReactNode;
  progress?: number;
  height?: number;
  className?: string;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const MetricCard = ({
  label,
  value,
  unit,
  description,
  tone = "purple",
  icon,
  progress,
  height = 128,
  className,
}: MetricCardProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];

  return (
    <div
      className={["flex min-w-0 flex-col rounded-[12px] border p-[18px]", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        height,
        borderColor: toneValue.border,
        backgroundColor: redBlueComparisonTheme.colors.card,
        boxShadow: redBlueComparisonTheme.shadow.card,
      }}
    >
      <div className="mb-[10px] flex items-center justify-between gap-[12px]">
        <div className="min-w-0 truncate text-[12px] font-black uppercase" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
          {label}
        </div>
        {icon ? <div className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-full" style={{ backgroundColor: toneValue.tint, color: toneValue.color }}>{icon}</div> : null}
      </div>

      <div className="flex min-w-0 items-end gap-[6px]">
        <div className="min-w-0 truncate text-[38px] font-black leading-none" style={{ color: toneValue.color, fontFamily: redBlueComparisonTheme.fonts.heading }}>
          {value}
        </div>
        {unit ? <div className="pb-[4px] text-[16px] font-bold leading-none" style={{ color: redBlueComparisonTheme.colors.subtleText }}>{unit}</div> : null}
      </div>

      {description ? (
        <div className="mt-[8px] truncate text-[12px] font-medium" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
          {description}
        </div>
      ) : null}

      {progress !== undefined ? (
        <div className="mt-auto h-[6px] overflow-hidden rounded-full" style={{ backgroundColor: redBlueComparisonTheme.colors.neutralTint }}>
          <div className="h-full rounded-full" style={{ width: `${clampPercent(progress)}%`, backgroundColor: toneValue.color }} />
        </div>
      ) : null}
    </div>
  );
};

export default MetricCard;
