import React, { type CSSProperties, type ReactNode } from "react";

import { theme } from "../theme.ts";

type SlideCanvasProps = {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
};

const SlideCanvas = ({ children, style, className }: SlideCanvasProps) => {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "1280px",
        height: "720px",
        overflow: "hidden",
        boxSizing: "border-box",
        backgroundColor: theme.colors.canvas,
        color: theme.colors.ink,
        fontFamily: theme.fonts.body,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default SlideCanvas;
