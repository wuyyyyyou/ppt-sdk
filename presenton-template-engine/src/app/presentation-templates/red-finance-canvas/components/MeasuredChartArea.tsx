import React, { type ReactNode } from "react";
import useResizeObserverModule from "use-resize-observer";

type UseResizeObserverHook = <T extends Element>(opts?: {
  ref?: React.RefObject<T> | T | null | undefined;
  onResize?: (size: { width: number | undefined; height: number | undefined }) => void;
  box?: "border-box" | "content-box" | "device-pixel-content-box";
  round?: (value: number) => number;
}) => {
  ref: React.RefCallback<T>;
  width?: number;
  height?: number;
};

const useResizeObserver = useResizeObserverModule as unknown as UseResizeObserverHook;

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
