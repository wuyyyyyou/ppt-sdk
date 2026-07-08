import React from "react";

export type CardAccentRailPosition = "top" | "right" | "bottom" | "left";

type CardAccentRailProps = {
  position?: CardAccentRailPosition;
  color: string;
  size?: number;
  inset?: number;
  zIndex?: number;
};

const CardAccentRail = ({
  position = "top",
  color,
  size = 5,
  inset = 0,
  zIndex,
}: CardAccentRailProps) => {
  const isHorizontal = position === "top" || position === "bottom";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      data-pptx-no-inherit-border-radius="true"
      style={{
        backgroundColor: color,
        borderRadius: 0,
        left: position === "right" ? undefined : inset,
        right: position === "left" ? undefined : inset,
        top: position === "bottom" ? undefined : inset,
        bottom: position === "top" ? undefined : inset,
        width: isHorizontal ? undefined : size,
        height: isHorizontal ? size : undefined,
        zIndex,
      }}
    />
  );
};

export default CardAccentRail;
