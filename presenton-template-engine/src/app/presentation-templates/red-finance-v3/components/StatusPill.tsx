import React, { type ReactNode } from "react";

import IconText from "./IconText.js";

type StatusPillProps = {
  label: string;
  backgroundColor: string;
  textColor: string;
  leadingDotColor?: string;
  leadingIcon?: ReactNode;
  gap?: number;
  minWidth?: number;
  height?: number;
  paddingX?: number;
  fontSize?: number;
  borderRadius?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  className?: string;
};

const StatusPill = ({
  label,
  backgroundColor,
  textColor,
  leadingDotColor,
  leadingIcon,
  gap = 8,
  minWidth = 76,
  height = 22,
  paddingX = 12,
  fontSize = 12,
  borderRadius = 6,
  fontWeight = 700,
  className,
}: StatusPillProps) => {
  const leadingNode = leadingIcon ?? (
    !leadingIcon && leadingDotColor ? (
      <span
        data-pptx-inline-role="leading"
        className="flex-none rounded-full"
        style={{
          width: Math.max(6, Math.round(fontSize * 0.65)),
          height: Math.max(6, Math.round(fontSize * 0.65)),
          backgroundColor: leadingDotColor,
        }}
      />
    ) : null
  );

  return (
    <div
      data-pptx-inline-composition="status-pill"
      className={[
        "inline-flex items-center justify-center whitespace-nowrap leading-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor,
        color: textColor,
        minWidth,
        height,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        borderRadius,
        fontSize,
        fontWeight,
        gap,
      }}
    >
      {leadingNode ? (
        <IconText
          icon={leadingNode}
          label={label}
          height={height}
          iconSize={Math.max(6, fontSize)}
          gap={gap}
          fontSize={fontSize}
          fontWeight={fontWeight}
          textColor={textColor}
        />
      ) : (
        <span data-pptx-inline-role="label">{label}</span>
      )}
    </div>
  );
};

export default StatusPill;
