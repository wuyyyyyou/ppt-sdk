import React, { type ReactNode } from "react";
import useResizeObserver from "use-resize-observer";

type MeasuredChartAreaProps = {
  children: (size: { width: number; height: number }) => ReactNode;
  minHeight?: number;
  className?: string;
};

const MeasuredChartArea = ({
  children,
  minHeight = 220,
  className,
}: MeasuredChartAreaProps) => {
  const { ref, width = 0, height = 0 } = useResizeObserver<HTMLDivElement>();
  const ready = width > 0 && height > 0;

  return (
    <div
      ref={ref}
      className={`min-h-0 flex-1 ${className ?? ""}`.trim()}
      style={{ minHeight }}
    >
      {ready ? children({ width, height }) : null}
    </div>
  );
};

export default MeasuredChartArea;
