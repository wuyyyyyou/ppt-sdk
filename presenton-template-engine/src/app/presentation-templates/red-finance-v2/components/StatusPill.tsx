import React, { type ReactNode } from "react";

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
}: StatusPillProps) => (
  <div
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
    {leadingIcon ? (
      <span
        className="flex flex-none items-center justify-center"
        style={{
          width: fontSize,
          height: fontSize,
        }}
      >
        {leadingIcon}
      </span>
    ) : null}
    {!leadingIcon && leadingDotColor ? (
      <span
        className="flex-none rounded-full"
        style={{
          width: Math.max(6, Math.round(fontSize * 0.65)),
          height: Math.max(6, Math.round(fontSize * 0.65)),
          backgroundColor: leadingDotColor,
        }}
      />
    ) : null}
    <span>{label}</span>
  </div>
);

export default StatusPill;
