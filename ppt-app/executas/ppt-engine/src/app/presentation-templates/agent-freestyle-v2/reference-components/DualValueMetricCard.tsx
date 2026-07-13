import React, { type ReactNode } from "react";

import { theme } from "../theme.ts";
import IconText from "./IconText.tsx";

type DualValueMetricCardProps = {
  title: string;
  icon?: ReactNode;
  leftLabel: string;
  rightLabel: string;
  leftValue: string;
  rightValue: string;
  leftShare: number;
  rightShare: number;
  leftColor?: string;
  rightColor?: string;
  density?: "normal" | "compact";
  progressMode?: "split" | "stacked";
  cardHeight?: number | string;
  className?: string;
};

const clampShare = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

const DualValueMetricCard = ({
  title,
  icon,
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  leftShare,
  rightShare,
  leftColor = theme.colors.accent,
  rightColor = theme.colors.chart2,
  density = "normal",
  progressMode = "split",
  cardHeight,
  className,
}: DualValueMetricCardProps) => {
  const isCompact = density === "compact";
  const resolvedLeftShare = clampShare(leftShare);
  const resolvedRightShare = clampShare(rightShare);
  const total = Math.max(1, resolvedLeftShare + resolvedRightShare);
  const normalizedLeftWidth = `${(clampShare(leftShare) / total) * 100}%`;
  const normalizedRightWidth = `${(clampShare(rightShare) / total) * 100}%`;
  const boundedLeftWidth = `${Math.min(100, resolvedLeftShare)}%`;
  const boundedRightWidth = `${Math.min(100, resolvedRightShare)}%`;
  const resolvedCardHeight = cardHeight ?? (isCompact ? 118 : 126);
  const valueFontSize = isCompact ? 18 : 20;
  const titleFontSize = isCompact ? 12 : 13;
  const bodyPaddingX = isCompact ? 14 : 16;
  const bodyPaddingY = isCompact ? 12 : 14;
  const isStackedProgress = progressMode === "stacked";

  return (
    <div
      className={["flex flex-col rounded-[8px] border", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        height: resolvedCardHeight,
        paddingLeft: bodyPaddingX,
        paddingRight: bodyPaddingX,
        paddingTop: bodyPaddingY,
        paddingBottom: bodyPaddingY,
        backgroundColor: theme.colors.panel,
        borderColor: theme.colors.stroke,
        boxShadow: theme.shadows.card,
      }}
    >
      <div className="mb-[10px] flex items-center justify-between gap-[10px]">
        <div
          className="min-w-0 font-bold leading-none"
          style={{
            fontSize: titleFontSize,
            color: theme.colors.textMuted,
          }}
        >
          {title}
        </div>
        {icon ? <div className="flex-none">{icon}</div> : null}
      </div>

      <div className="mb-[8px] flex items-end justify-between gap-[12px]">
        <div
          className="whitespace-nowrap font-black leading-none"
          style={{ fontSize: valueFontSize, color: leftColor }}
        >
          {leftValue}
        </div>
        <div
          className="whitespace-nowrap font-black leading-none"
          style={{ fontSize: valueFontSize, color: rightColor }}
        >
          {rightValue}
        </div>
      </div>

      <div
        className="mb-[7px] flex items-center justify-between font-medium leading-none"
        style={{ fontSize: 11, color: theme.colors.textSubtle }}
      >
        <IconText
          icon={
            <div
              className="h-[8px] w-[8px] rounded-full"
              style={{ backgroundColor: leftColor }}
            />
          }
          label={leftLabel}
          height={16}
          iconSize={8}
          gap={6}
          fontSize={11}
          fontWeight={500}
          textColor={theme.colors.textSubtle}
        />
        <IconText
          icon={
            <div
              className="h-[8px] w-[8px] rounded-full"
              style={{ backgroundColor: rightColor }}
            />
          }
          label={rightLabel}
          height={16}
          iconSize={8}
          gap={6}
          fontSize={11}
          fontWeight={500}
          textColor={theme.colors.textSubtle}
        />
      </div>

      {isStackedProgress ? (
        <div className="flex flex-col gap-[5px]">
          <div
            className="relative h-[4px] overflow-hidden rounded-full"
            style={{ backgroundColor: theme.colors.strokeSoft }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: boundedLeftWidth,
                backgroundColor: leftColor,
              }}
            />
          </div>
          <div
            className="relative h-[4px] overflow-hidden rounded-full"
            style={{ backgroundColor: theme.colors.strokeSoft }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: boundedRightWidth,
                backgroundColor: rightColor,
              }}
            />
          </div>
        </div>
      ) : (
        <div
          className="relative h-[6px] overflow-hidden rounded-full"
          style={{ backgroundColor: theme.colors.strokeSoft }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: normalizedLeftWidth,
              backgroundColor: leftColor,
            }}
          />
          <div
            className="absolute inset-y-0 right-0"
            style={{
              width: normalizedRightWidth,
              backgroundColor: rightColor,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DualValueMetricCard;
