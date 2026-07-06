import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import AnalyticsCardShell from "../components/AnalyticsCardShell.tsx";
import AnalyticsImageShowcasePanel, { type AnalyticsShowcaseImage } from "../components/AnalyticsImageShowcasePanel.tsx";
import { AnalyticsIcon } from "../components/AnalyticsIcons.tsx";
import AnalyticsSourceFooter from "../components/AnalyticsSourceFooter.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import { chartAnalyticsTheme } from "../theme/tokens.ts";

const IconSchema = z.enum([
  "binoculars",
  "bolt",
  "broadcast",
  "chart-column",
  "chart-line",
  "chart-pie",
  "file-signature",
  "flask",
  "gauge",
  "grid",
  "robot",
  "scale",
  "shield",
  "users",
  "wallet",
]);

const ImageSchema = z.object({
  url: z.string().max(4000).default(""),
  title: z.string().min(2).max(64).optional(),
  caption: z.string().min(4).max(180).optional(),
  source: z.string().min(2).max(120).optional(),
  alt: z.string().max(120).optional(),
  fit: z.enum(["cover", "contain"]).default("cover"),
});

const ObservationSchema = z.object({
  label: z.string().min(2).max(24),
  value: z.string().min(1).max(34),
  description: z.string().min(6).max(110),
  icon: IconSchema.default("grid"),
  accentColor: z.string().min(3).max(64).optional(),
});

const DEFAULT_OBSERVATIONS: z.infer<typeof ObservationSchema>[] = [
  {
    label: "Visual Anchor",
    value: "Single Image",
    description: "Use one strong photo, screenshot, map, or research visual as the main evidence.",
    icon: "grid",
  },
  {
    label: "Reading Path",
    value: "Fast Scan",
    description: "Keep supporting notes short so the audience inspects the image first.",
    icon: "binoculars",
  },
  {
    label: "Evidence Credit",
    value: "Traceable",
    description: "Preserve image source, credit, or collection note without crowding the page.",
    icon: "file-signature",
  },
];

export const Schema = z.object({
  eyebrow: z.string().min(2).max(40).default("Visual Evidence"),
  title: z.string().min(4).max(78).default("Image Evidence Showcase"),
  headerMetaLabel: z.string().min(2).max(24).default("Artifact"),
  headerMetaValue: z.string().min(2).max(36).default("Primary visual"),
  headerIcon: IconSchema.default("grid"),
  image: ImageSchema.default({
    url: "",
    title: "Primary Image",
    caption: "Use this area for one photo, product screenshot, map, research visual, or generated image that should dominate the page.",
    source: "Image source or credit",
    alt: "Primary visual evidence",
    fit: "cover",
  }),
  insightTitle: z.string().min(2).max(42).default("What to Notice"),
  insightSummary: z
    .string()
    .min(8)
    .max(180)
    .default("The image owns the page. Use the side panel only to direct attention, record context, and preserve evidence traceability."),
  observations: z.array(ObservationSchema).min(2).max(3).default(DEFAULT_OBSERVATIONS),
  tags: z.array(z.string().min(2).max(18)).min(1).max(4).default(["Evidence", "Image", "Context"]),
  footerSource: z.string().min(4).max(140).default("Source: visual research evidence, internal screenshot, or supplied image asset"),
  confidentialityLabel: z.string().min(2).max(32).default("CONFIDENTIAL"),
  slideLabel: z.string().min(2).max(18).default("SLIDE 11"),
});

export const layoutId = "image-evidence-showcase";
export const layoutName = "Image Evidence Showcase";
export const layoutDescription =
  "A TSX-first image-dominant page with a dark analytics header, one reusable image showcase panel, concise observation cards, tags, and a source footer.";
export const layoutTags = ["image", "visual-evidence", "showcase", "screenshot", "research-asset", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "image-showcase", "image-caption", "observation-cards", "source-footer"];
export const useCases = ["visual-evidence", "image-showcase", "product-screenshot", "map-or-photo-analysis", "research-asset-review"];
export const suitableFor =
  "Suitable for pages where one image, screenshot, map, product photo, or visual research asset should dominate and supporting text only frames what the audience should inspect.";
export const avoidFor =
  "Avoid using this layout for chart-heavy dashboards, dense comparison matrices, multi-image galleries, long prose, or pages where the image is only decorative.";
export const density = "medium";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "medium";


const ImageEvidenceShowcase = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const observations = parsed.observations.map((item, index) => ({
    ...item,
    accentColor: item.accentColor ?? chartAnalyticsTheme.palette.chart[index % chartAnalyticsTheme.palette.chart.length],
  }));

  return (
    <AnalyticsCanvas variant="light">
      <ExecutiveHeader
        eyebrow={parsed.eyebrow}
        title={parsed.title}
        metaLabel={parsed.headerMetaLabel}
        metaValue={parsed.headerMetaValue}
        icon={parsed.headerIcon}
      />
      <div className="h-[4px] w-full" style={{ backgroundColor: chartAnalyticsTheme.colors.signalPrimary }} />

      <div className="grid h-[578px] grid-cols-[minmax(0,812px)_332px] gap-[24px] px-[48px] py-[28px]">
        <AnalyticsImageShowcasePanel image={parsed.image as AnalyticsShowcaseImage} captionMaxLines={2} sourceMaxLines={1} />

        <AnalyticsCardShell accentColor={chartAnalyticsTheme.colors.signalSecondary} padding={22}>
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex-none">
              <div className="mb-[10px] flex flex-wrap gap-[8px]">
                {parsed.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[999px] px-[9px] py-[4px] text-[10px] font-bold uppercase"
                    style={{ backgroundColor: chartAnalyticsTheme.colors.signalPrimaryTint, color: chartAnalyticsTheme.colors.signalPrimary }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="m-0 text-[24px] font-bold leading-[1.15]" style={{ color: chartAnalyticsTheme.colors.textPrimary }}>
                {parsed.insightTitle}
              </h2>
              <p
                data-validation-role="multi-line-body-text"
                className="m-0 mt-[10px] text-[13px] leading-[1.45]"
                style={{ color: chartAnalyticsTheme.colors.textSubtle }}
              >
                {parsed.insightSummary}
              </p>
            </div>

            <div className="mt-[18px] flex min-h-0 flex-1 flex-col gap-[12px]">
              {observations.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="flex min-h-0 flex-1 gap-[12px] rounded-[8px] border p-[12px]"
                  style={{ borderColor: chartAnalyticsTheme.colors.stroke, backgroundColor: chartAnalyticsTheme.colors.surface }}
                >
                  <div
                    className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px]"
                    style={{ backgroundColor: chartAnalyticsTheme.colors.card, color: item.accentColor }}
                  >
                    <AnalyticsIcon name={item.icon} className="h-[18px] w-[18px]" stroke={item.accentColor} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase leading-[1.2]" style={{ color: item.accentColor }}>
                      {item.label}
                    </div>
                    <div className="mt-[3px] truncate text-[16px] font-bold leading-[1.15]" style={{ color: chartAnalyticsTheme.colors.textPrimary }}>
                      {item.value}
                    </div>
                    <div
                      data-validation-role="multi-line-body-text"
                      className="mt-[5px] max-h-[34px] overflow-hidden text-[11px] leading-[1.45]"
                      style={{ color: chartAnalyticsTheme.colors.textMuted }}
                    >
                      {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AnalyticsCardShell>
      </div>

      <AnalyticsSourceFooter
        source={parsed.footerSource}
        slideLabel={parsed.slideLabel}
        confidentialityLabel={parsed.confidentialityLabel}
      />
    </AnalyticsCanvas>
  );
};

export default ImageEvidenceShowcase;
