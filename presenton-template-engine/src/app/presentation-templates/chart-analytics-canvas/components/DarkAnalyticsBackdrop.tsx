import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

type DarkAnalyticsBackdropProps = {
  imageUrl?: string;
  imageAlt?: string;
  showImage?: boolean;
  showAccentLine?: boolean;
};

const DarkAnalyticsBackdrop = ({
  imageUrl,
  imageAlt = "Analytics background",
  showImage = true,
  showAccentLine = true,
}: DarkAnalyticsBackdropProps) => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {showImage && imageUrl ? (
        <img
          alt={imageAlt}
          className="h-full w-full object-cover opacity-30"
          src={imageUrl}
          style={{ mixBlendMode: "overlay" }}
        />
      ) : null}
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(15,23,42,0.82)" }} />
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(30,58,138,0.2)", mixBlendMode: "color" }} />

      {showAccentLine ? (
        <div className="absolute left-0 top-0 h-[4px] w-full" style={{ backgroundColor: chartAnalyticsTheme.colors.primary }} />
      ) : null}
    </div>
  );
};

export default DarkAnalyticsBackdrop;
