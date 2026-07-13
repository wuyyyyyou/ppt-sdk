import React, { type ReactNode } from "react";

import { theme } from "../theme.ts";

type ProgressStatusCardProps = {
  title: string;
  marker?: ReactNode;
  progress: number;
  status: string;
  progressColor?: string;
  trackColor?: string;
  titleColor?: string;
  statusColor?: string;
  minHeight?: number;
  className?: string;
};

const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
};

const ProgressStatusCard = ({
  title,
  marker,
  progress,
  status,
  progressColor = theme.colors.accent,
  trackColor = theme.colors.strokeSoft,
  titleColor = theme.colors.textPrimary,
  statusColor = theme.colors.textMuted,
  minHeight = 96,
  className,
}: ProgressStatusCardProps) => {
  const normalizedProgress = clampProgress(progress);

  return (
    <div
      className={[
        "flex flex-col overflow-hidden rounded-[10px] border px-[16px] pb-[12px] pt-[14px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        minHeight,
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.stroke,
        boxShadow: theme.shadows.panel,
      }}
    >
      <div className="mb-[10px] flex items-start justify-between gap-[10px]">
        <div
          className="min-w-0 font-bold leading-[1.2]"
          style={{
            fontSize: 14,
            color: titleColor,
          }}
        >
          {title}
        </div>
        {marker ? <div className="mt-[1px] flex flex-none items-center justify-center">{marker}</div> : null}
      </div>

      <div
        className="overflow-hidden rounded-full"
        style={{
          height: 6,
          backgroundColor: trackColor,
        }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${normalizedProgress}%`,
            backgroundColor: progressColor,
          }}
        />
      </div>

      <div
        className="mt-[10px] text-right font-medium leading-[1.3]"
        style={{
          fontSize: 11,
          color: statusColor,
        }}
      >
        {status}
      </div>
    </div>
  );
};

export default ProgressStatusCard;
