import React, { useEffect, useState } from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";

export type AnalyticsImageFit = "cover" | "contain";

export type AnalyticsShowcaseImage = {
  url?: string;
  title?: string;
  caption?: string;
  source?: string;
  alt?: string;
  fit?: AnalyticsImageFit;
};

type AnalyticsImageShowcasePanelProps = {
  image: AnalyticsShowcaseImage;
  className?: string;
  titleMaxLines?: number;
  captionMaxLines?: number;
  sourceMaxLines?: number;
  imageRadius?: number;
  padding?: number;
};

const textMaxHeight = (fontSize: number, lineHeight: number, maxLines: number) =>
  fontSize * lineHeight * maxLines;

const ImagePlaceholder = ({ message }: { message: string }) => (
  <div
    className="flex h-full min-h-0 w-full flex-col items-center justify-center border border-dashed text-center"
    style={{
      gap: 14,
      borderColor: "#BFDBFE",
      backgroundColor: "#EFF6FF",
      color: chartAnalyticsTheme.colors.primary,
      borderRadius: 8,
      padding: 32,
    }}
  >
    <div
      className="flex items-center justify-center rounded-[8px]"
      style={{
        width: 52,
        height: 52,
        backgroundColor: "#DBEAFE",
      }}
    >
      <AnalyticsIcon name="grid" className="h-[24px] w-[24px]" stroke={chartAnalyticsTheme.colors.primary} />
    </div>
    <div className="text-[13px] font-bold leading-[1.35]">{message}</div>
  </div>
);

const AnalyticsImageShowcasePanel = ({
  image,
  className,
  titleMaxLines = 2,
  captionMaxLines = 2,
  sourceMaxLines = 1,
  imageRadius = 8,
  padding = 18,
}: AnalyticsImageShowcasePanelProps) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = image.url?.trim();
  const hasImage = Boolean(imageUrl) && failedUrl !== imageUrl;
  const fit = image.fit ?? "cover";

  useEffect(() => {
    setFailedUrl(null);
  }, [imageUrl]);

  return (
    <div
      className={["flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: chartAnalyticsTheme.colors.card,
        borderColor: chartAnalyticsTheme.colors.stroke,
        boxShadow: "0 8px 18px rgba(15,23,42,0.08)",
        padding,
      }}
    >
      {image.title ? (
        <div
          className="flex-none font-bold"
          style={{
            color: "#0F172A",
            fontSize: 18,
            lineHeight: 1.22,
            maxHeight: textMaxHeight(18, 1.22, titleMaxLines),
            marginBottom: 12,
            overflow: "hidden",
          }}
        >
          {image.title}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden" style={{ borderRadius: imageRadius }}>
        {hasImage ? (
          <img
            src={imageUrl}
            alt={image.alt ?? image.title ?? ""}
            className="h-full w-full"
            style={{
              display: "block",
              objectFit: fit,
              backgroundColor: chartAnalyticsTheme.colors.surface,
              borderRadius: imageRadius,
            }}
            onError={() => setFailedUrl(imageUrl ?? null)}
          />
        ) : (
          <ImagePlaceholder message={imageUrl ? "Image failed to load" : "Add image URL in data.image.url"} />
        )}
      </div>

      {image.caption ? (
        <div
          data-validation-role="multi-line-body-text"
          className="flex-none"
          style={{
            color: "#334155",
            fontSize: 12,
            lineHeight: 1.42,
            maxHeight: textMaxHeight(12, 1.42, captionMaxLines),
            marginTop: 12,
            overflow: "hidden",
          }}
        >
          {image.caption}
        </div>
      ) : null}

      {image.source ? (
        <div
          className="flex-none pt-[6px] text-[10px] font-medium uppercase"
          style={{
            color: chartAnalyticsTheme.colors.subtleText,
            lineHeight: "14px",
            maxHeight: textMaxHeight(10, 1.4, sourceMaxLines),
            overflow: "hidden",
          }}
        >
          {image.source}
        </div>
      ) : null}
    </div>
  );
};

export default AnalyticsImageShowcasePanel;
