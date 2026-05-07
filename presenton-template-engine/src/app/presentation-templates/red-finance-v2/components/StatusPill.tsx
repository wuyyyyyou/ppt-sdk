import React from "react";

type StatusPillProps = {
  label: string;
  backgroundColor: string;
  textColor: string;
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
    }}
  >
    {label}
  </div>
);

export default StatusPill;
