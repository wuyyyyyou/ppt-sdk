import React, { type CSSProperties, type ReactNode } from "react";

export interface StableInlineRowProps {
  children: ReactNode;
  height: number;
  gap?: number;
  inline?: boolean;
  wrap?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function StableInlineRow({
  children,
  height,
  gap = 0,
  inline = true,
  wrap = false,
  className,
  style,
}: StableInlineRowProps) {
  return (
    <div
      className={[
        inline ? "inline-flex" : "flex",
        "items-center",
        wrap ? "flex-wrap" : "whitespace-nowrap",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ height, gap, ...style }}
    >
      {children}
    </div>
  );
}
