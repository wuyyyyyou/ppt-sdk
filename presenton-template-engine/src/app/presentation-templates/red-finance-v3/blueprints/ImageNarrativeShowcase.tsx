import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import FinanceContentFrame from "../components/FinanceContentFrame.tsx";
import FinanceSectionHeading from "../components/FinanceSectionHeading.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import ImageShowcasePanel, { type ImageShowcaseImage } from "../components/ImageShowcasePanel.tsx";
import InfoListItem from "../components/InfoListItem.tsx";
import InsightCallout from "../components/InsightCallout.tsx";

const IconSchema = z.enum([
  "bank",
  "bolt",
  "brain",
  "chart-column",
  "chart-line",
  "chart-pie",
  "coins",
  "compass",
  "database",
  "document",
  "gavel",
  "grid",
  "image",
  "laptop-code",
  "lightbulb",
  "microchip",
  "route",
  "shield",
  "wallet",
]);

const ImageSchema = z.object({
  url: z.string().max(4000).default(""),
  title: z.string().max(44).optional(),
  caption: z.string().max(120).optional(),
  source: z.string().max(80).optional(),
  alt: z.string().max(120).optional(),
  fit: z.enum(["cover", "contain"]).default("cover"),
});

const NarrativeItemSchema = z.object({
  icon: IconSchema,
  title: z.string().min(2).max(28),
  description: z.string().min(8).max(96),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("Image Narrative Showcase"),
  metaLabel: z.string().min(2).max(48).default("BLUEPRINT / IMAGE"),
  footerText: z.string().min(6).max(80).default("Business Professional | Image Narrative Showcase"),
  pageNumber: z.string().min(1).max(4).default("09"),
  variant: z.enum(["image-left-narrative-right", "narrative-left-image-right"]).default(
    "image-left-narrative-right",
  ),
  density: z.enum(["medium", "high"]).default("medium"),
  image: ImageSchema.default({
    url: "",
    title: "Primary visual asset",
    caption: "Use this area for one photo, product screenshot, map, evidence image, or generated visual.",
    source: "SOURCE: TBD",
    alt: "Primary visual asset",
    fit: "cover",
  }),
  narrativeTitle: z.string().min(2).max(28).default("Visual evidence"),
  narrativeSummary: z
    .string()
    .min(8)
    .max(96)
    .default("Use the right column for short interpretation while the image remains the main evidence."),
  narrativeItems: z.array(NarrativeItemSchema).min(2).max(4).default([
    {
      icon: "image",
      title: "Primary visual",
      description: "Keep one strong image as the anchor instead of crowding the page with several assets.",
    },
    {
      icon: "lightbulb",
      title: "Interpretation",
      description: "Use compact supporting points to explain why the visual matters.",
    },
    {
      icon: "shield",
      title: "Evidence note",
      description: "Preserve image source or credit without turning it into the main message.",
    },
  ]),
  conclusion: z.string().min(8).max(120).default("Best for photo, product screenshot, map, evidence image, or one visual asset that needs concise explanation."),
});

export const layoutId = "image-narrative-showcase";
export const layoutName = "Image Narrative Showcase";
export const layoutDescription =
  "A tsx-first slide that uses one primary image as visual evidence and pairs it with concise reusable narrative components.";
export const layoutTags = ["image", "visual-evidence", "narrative", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["image", "image-caption", "narrative-list", "callout"];
export const useCases = ["visual evidence", "product screenshot", "photo showcase", "map or asset explanation"];
export const suitableFor =
  "Suitable for pages where one image is the primary content and the surrounding text should only interpret it.";
export const avoidFor =
  "Avoid using this layout for multiple unrelated images, dense text pages, dashboards, or large comparison matrices.";
export const density = "medium";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const ImageNarrativeShowcase = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const isImageFirst = parsed.variant === "image-left-narrative-right";
  const itemDensity = parsed.density === "high" ? "dense" : "compact";

  const imagePane = (
    <ImageShowcasePanel
      image={parsed.image as ImageShowcaseImage}
      className="h-full"
      titleMaxLines={2}
      captionMaxLines={parsed.density === "high" ? 2 : 3}
    />
  );

  const narrativePane = (
    <div className="flex h-full min-h-0 flex-col gap-[12px]">
      <FinanceSectionHeading
        title={parsed.narrativeTitle}
        subtitle={parsed.narrativeSummary}
        marginBottom={0}
        subtitleLayout="stacked"
      />
      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateRows: `repeat(${parsed.narrativeItems.length}, minmax(0, 1fr))`,
        }}
      >
        {parsed.narrativeItems.map((item, index) => (
          <InfoListItem
            key={`${item.title}-${index}`}
            icon={item.icon}
            title={item.title}
            description={item.description}
            showDivider={index < parsed.narrativeItems.length - 1}
            density={itemDensity}
            textScale={parsed.density === "high" ? "small" : "normal"}
            descriptionMaxLines={parsed.density === "high" ? 2 : 3}
            fillHeight
            verticalAlign="center"
          />
        ))}
      </div>
      <div className="flex-none">
        <InsightCallout
          text={parsed.conclusion}
          density={parsed.density === "high" ? "dense" : "compact"}
          icon="lightbulb"
        />
      </div>
    </div>
  );

  return (
    <FinanceContentFrame
      title={parsed.title}
      metaIcon={<FinanceIcon name="image" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={156}
      contentBottomInset={12}
    >
      <div className={`grid h-full min-h-0 gap-[24px] ${isImageFirst ? "grid-cols-[1.16fr_0.84fr]" : "grid-cols-[0.84fr_1.16fr]"}`}>
        {isImageFirst ? imagePane : narrativePane}
        {isImageFirst ? narrativePane : imagePane}
      </div>
    </FinanceContentFrame>
  );
};

export default ImageNarrativeShowcase;
