import React, { type ReactNode } from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

export type ImageShowcaseFit = "cover" | "contain";

export type ImageShowcaseImage = {
  url?: string;
  alt?: string;
  fit?: ImageShowcaseFit;
};

type ImageShowcasePanelProps = {
  image?: ImageShowcaseImage;
  title?: ReactNode;
  caption?: ReactNode;
  source?: ReactNode;
  tone?: RedBlueTone;
  placeholderIcon?: ReactNode;
  imageRadius?: number;
  className?: string;
};

const ImageShowcasePanel = ({
  image,
  title,
  caption,
  source,
  tone = "purple",
  placeholderIcon,
  imageRadius = redBlueComparisonTheme.radius.lg,
  className,
}: ImageShowcasePanelProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];
  const imageUrl = image?.url?.trim();

  return (
    <div
      className={["flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border p-[16px]", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderColor: toneValue.border,
        backgroundColor: redBlueComparisonTheme.colors.card,
        boxShadow: redBlueComparisonTheme.shadow.card,
      }}
    >
      {title ? (
        <div className="mb-[10px] overflow-hidden text-[17px] font-black leading-[1.25]" style={{ maxHeight: 43, color: redBlueComparisonTheme.colors.backgroundText }}>
          {title}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden" style={{ borderRadius: imageRadius }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={image?.alt ?? ""}
            className="block h-full w-full"
            style={{
              objectFit: image?.fit ?? "cover",
              borderRadius: imageRadius,
              backgroundColor: redBlueComparisonTheme.colors.neutralTint,
            }}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center border border-dashed text-center"
            style={{
              gap: 12,
              padding: 24,
              borderRadius: imageRadius,
              color: toneValue.color,
              borderColor: toneValue.border,
              backgroundColor: toneValue.tint,
            }}
          >
            {placeholderIcon ? <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white">{placeholderIcon}</div> : null}
            <div className="text-[13px] font-black leading-[1.35]">Image placeholder</div>
          </div>
        )}
      </div>

      {caption ? (
        <div className="mt-[10px] overflow-hidden text-[12px] font-medium leading-[1.4]" style={{ maxHeight: 34, color: redBlueComparisonTheme.colors.mutedText }}>
          {caption}
        </div>
      ) : null}
      {source ? (
        <div className="mt-[6px] truncate text-[10px] font-bold uppercase leading-none" style={{ color: redBlueComparisonTheme.colors.subtleText }}>
          {source}
        </div>
      ) : null}
    </div>
  );
};

export default ImageShowcasePanel;
