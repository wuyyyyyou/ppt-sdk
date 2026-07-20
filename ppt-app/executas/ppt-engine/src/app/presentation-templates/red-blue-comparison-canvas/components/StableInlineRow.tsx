import React, { type CSSProperties, type ReactNode } from "react";

type StableInlineRowProps = {
  children: ReactNode;
  height: number;
  gap?: number;
  inline?: boolean;
  wrap?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
  style?: CSSProperties;
};

const alignClassName = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
} as const;

const StableInlineRow = ({
  children,
  height,
  gap = 0,
  inline = true,
  wrap = false,
  align = "center",
  className,
  style,
}: StableInlineRowProps) => {
  const displayClassName = inline ? "inline-flex" : "flex";
  const wrapClassName = wrap ? "flex-wrap" : "whitespace-nowrap";

  return (
    <div
      className={[
        displayClassName,
        alignClassName[align],
        wrapClassName,
        className,
      ]
        .filter(Boolean)
        .join(" ")}

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
