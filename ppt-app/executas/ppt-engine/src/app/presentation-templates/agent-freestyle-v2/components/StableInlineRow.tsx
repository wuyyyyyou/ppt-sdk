import React, { type CSSProperties, type ReactNode } from "react";

type StableInlineRowProps = {
  children: ReactNode;
  height: number;
  gap?: number;
  inline?: boolean;
  wrap?: boolean;
  className?: string;
  style?: CSSProperties;
};

const StableInlineRow = ({
  children,
  height,
  gap = 0,
  inline = true,
  wrap = false,
  className,
  style,
}: StableInlineRowProps) => (
  <div
    className={[
      inline ? "inline-flex" : "flex",
      "items-center",
      wrap ? "flex-wrap" : "whitespace-nowrap",
      className,
    ].filter(Boolean).join(" ")}

    style={{ height, gap, ...style }}
  >
    {children}
  </div>
);

export default StableInlineRow;
