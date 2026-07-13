import React, { type CSSProperties, type ReactNode } from "react";

type StableInlineRowProps = {
  children: ReactNode;
  height: number;
  gap?: number;
  inline?: boolean;
  wrap?: boolean;
  className?: string;
  style?: CSSProperties;
  pptxInlineComposition?: "row" | "icon-text";
};

const StableInlineRow = ({
  children,
  height,
  gap = 0,
  inline = true,
  wrap = false,
  className,
  style,
  pptxInlineComposition,
}: StableInlineRowProps) => (
  <div
    className={[
      inline ? "inline-flex" : "flex",
      "items-center",
      wrap ? "flex-wrap" : "whitespace-nowrap",
      className,
    ].filter(Boolean).join(" ")}
    data-pptx-inline-composition={pptxInlineComposition}
    style={{ height, gap, ...style }}
  >
    {children}
  </div>
);

export default StableInlineRow;
