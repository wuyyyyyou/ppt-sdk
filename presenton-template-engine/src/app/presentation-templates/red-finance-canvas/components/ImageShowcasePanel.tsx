import React, { useEffect, useState } from "react";

import { redFinanceTheme } from "../theme/tokens.ts";
import { FinanceIcon } from "./FinanceIcons.tsx";

export type ImageShowcaseFit = "cover" | "contain";

export type ImageShowcaseImage = {
  url?: string;
  title?: string;
  caption?: string;
  source?: string;
  alt?: string;
  fit?: ImageShowcaseFit;
};

type ImageShowcasePanelProps = {
  image: ImageShowcaseImage;
  className?: string;
  titleMaxLines?: number;
  captionMaxLines?: number;
  imageRadius?: number;
};

const textMaxHeight = (fontSize: number, lineHeight: number, maxLines: number) =>
  fontSize * lineHeight * maxLines;

const ImagePlaceholder = ({ message }: { message: string }) => (
  <div
    className="flex h-full min-h-0 w-full flex-col items-center justify-center border border-dashed text-center"
    style={{
      gap: 12,
      borderColor: redFinanceTheme.colors.accentBorder,
      backgroundColor: redFinanceTheme.colors.accentTint,
      color: redFinanceTheme.colors.accentSubtleText,
      borderRadius: 6,
      padding: 24,
    }}
  >
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: 46,
        height: 46,
        backgroundColor: redFinanceTheme.colors.paleRed,
      }}
    >
      <FinanceIcon name="image" className="h-[22px] w-[22px]" />
    </div>
    <div className="text-[13px] font-bold leading-[1.3]">{message}</div>
  </div>
);

const ImageShowcasePanel = ({
  image,
  className,
  titleMaxLines = 2,
  captionMaxLines = 2,
  imageRadius = 6,
}: ImageShowcasePanelProps) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = image.url?.trim();
  const hasImage = Boolean(imageUrl) && failedUrl !== imageUrl;
  const fit = image.fit ?? "cover";

  useEffect(() => {
    setFailedUrl(null);
  }, [imageUrl]);

  return (
    <div
      className={["flex h-full min-h-0 flex-col overflow-hidden border", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: redFinanceTheme.colors.panel,
        borderColor: redFinanceTheme.colors.stroke,
        borderRadius: 8,
        boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
        padding: 16,
      }}
    >
      {image.title ? (
        <div
          className="flex-none font-bold"
          style={{
            color: redFinanceTheme.colors.backgroundText,
            fontSize: 17,
            lineHeight: 1.25,
            maxHeight: textMaxHeight(17, 1.25, titleMaxLines),
            marginBottom: 10,
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
              backgroundColor: redFinanceTheme.colors.surface,
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
            color: redFinanceTheme.colors.mutedText,
            fontSize: 12,
            lineHeight: 1.4,
            maxHeight: textMaxHeight(12, 1.4, captionMaxLines),
            marginTop: 10,
            overflow: "hidden",
          }}
        >
          {image.caption}
        </div>
      ) : null}

      {image.source ? (
        <div
          className="flex-none truncate pt-[6px] text-[10px] font-medium uppercase"
          style={{
            color: redFinanceTheme.colors.subtleText,
            lineHeight: "14px",
            overflow: "hidden",
          }}
        >
          {image.source}
        </div>
      ) : null}
    </div>
  );
};

export default ImageShowcasePanel;
