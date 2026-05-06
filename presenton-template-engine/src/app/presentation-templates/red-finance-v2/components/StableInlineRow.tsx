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
}: StableInlineRowProps) => {
  const displayClassName = inline ? "inline-flex" : "flex";
  const wrapClassName = wrap ? "flex-wrap" : "whitespace-nowrap";
  const mergedClassName = [displayClassName, "items-center", wrapClassName, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={mergedClassName}
      style={{
        height,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default StableInlineRow;
