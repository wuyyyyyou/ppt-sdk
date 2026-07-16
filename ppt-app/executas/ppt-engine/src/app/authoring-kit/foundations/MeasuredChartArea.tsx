import React, { type ReactNode } from "react";
import useResizeObserverModule from "use-resize-observer";

type UseResizeObserverHook = <T extends Element>() => {
  ref: React.RefCallback<T>;
  width?: number;
  height?: number;
};

const useResizeObserver = useResizeObserverModule as unknown as UseResizeObserverHook;

export interface MeasuredChartAreaProps {
  children: (size: { width: number; height: number }) => ReactNode;
  minHeight?: number;
  className?: string;
}

export default function MeasuredChartArea({
  children,
  minHeight = 220,
  className,
}: MeasuredChartAreaProps) {
  const { ref, width = 0, height = 0 } = useResizeObserver<HTMLDivElement>();

  return (
    <div ref={ref} className={`min-h-0 flex-1 ${className ?? ""}`.trim()} style={{ minHeight }}>
      {width > 0 && height > 0 ? children({ width, height }) : null}
    </div>
  );
}
