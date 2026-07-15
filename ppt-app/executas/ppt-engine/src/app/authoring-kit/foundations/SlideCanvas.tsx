import React, { type CSSProperties, type ReactNode } from "react";

export interface SlideCanvasProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function SlideCanvas({ children, className, style }: SlideCanvasProps) {
  return (
    <div
      className={className}
      style={{
        ...style,
        position: "relative",
        width: "1280px",
        height: "720px",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
