import React, { useEffect, useState } from "react";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";
import ThemePanelShell from "./ThemePanelShell.tsx";

export type ImageShowcaseFit = "cover" | "contain";

export type ImageShowcaseImage = {
  url?: string;
  title?: string;
  caption?: string;
  source?: string;
  alt?: string;
  fit?: ImageShowcaseFit;
  tone?: ComparisonTone;
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

const ImageIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="m21 15-4.2-4.2a2 2 0 0 0-2.8 0L7 18" />
  </svg>
);

const ImagePlaceholder = ({ message, tone }: { message: string; tone: ComparisonTone }) => {
  const toneValue = redBlueComparisonTheme.tone[tone];

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col items-center justify-center border border-dashed text-center"
      style={{
        gap: 12,
        borderColor: toneValue.border,
        backgroundColor: toneValue.tint,
        color: toneValue.color,
        borderRadius: 6,
        padding: 24,
      }}
    >
      <div
        className="flex items-center justify-center rounded-[10px]"
        style={{
          width: 46,
          height: 46,
          backgroundColor: redBlueComparisonTheme.colors.card,
          boxShadow: redBlueComparisonTheme.shadow.card,
        }}
      >
        <ImageIcon className="h-[23px] w-[23px]" />
      </div>
      <div className="text-[13px] font-black leading-[1.3]">{message}</div>
    </div>
  );
};

const ImageShowcasePanel = ({
  image,
  className,
  titleMaxLines = 2,
  captionMaxLines = 3,
  imageRadius = 6,
}: ImageShowcasePanelProps) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = image.url?.trim();
  const hasImage = Boolean(imageUrl) && failedUrl !== imageUrl;
  const fit = image.fit ?? "cover";
  const tone = image.tone ?? "comparison";

  useEffect(() => {
    setFailedUrl(null);
  }, [imageUrl]);

  return (
    <ThemePanelShell
      className={["flex h-full min-h-0 flex-col", className].filter(Boolean).join(" ")}
      padding={16}
      radius={redBlueComparisonTheme.radius.lg}
    >
      {image.title ? (
        <div
          className="flex-none font-black"
          style={{
            color: redBlueComparisonTheme.colors.textPrimary,
            fontFamily: redBlueComparisonTheme.fonts.heading,
            fontSize: 18,
            lineHeight: 1.22,
            maxHeight: textMaxHeight(18, 1.22, titleMaxLines),
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
              backgroundColor: redBlueComparisonTheme.colors.neutralTint,
              borderRadius: imageRadius,
            }}
            onError={() => setFailedUrl(imageUrl ?? null)}
          />
        ) : (
          <ImagePlaceholder
            message={imageUrl ? "Image failed to load" : "Add image URL in data.image.url"}
            tone={tone}
          />
        )}
      </div>

      {image.caption ? (
        <div
          data-validation-role="multi-line-body-text"
          className="flex-none"
          style={{
            color: redBlueComparisonTheme.colors.textMuted,
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
          className="flex-none break-words pt-[6px] text-[10px] font-black uppercase"
          style={{
            color: redBlueComparisonTheme.colors.textSubtle,
            lineHeight: "14px",
            overflow: "hidden",
          }}
        >
          {image.source}
        </div>
      ) : null}
    </ThemePanelShell>
  );
};

export default ImageShowcasePanel;
