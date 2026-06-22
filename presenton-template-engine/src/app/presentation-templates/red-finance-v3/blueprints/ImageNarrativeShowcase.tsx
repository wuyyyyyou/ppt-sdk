import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import FinanceContentFrame from "../components/FinanceContentFrame.tsx";
import FinanceSectionHeading from "../components/FinanceSectionHeading.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import ImageShowcasePanel, { type ImageShowcaseImage } from "../components/ImageShowcasePanel.tsx";
import InfoListItem from "../components/InfoListItem.tsx";
import InsightCallout from "../components/InsightCallout.tsx";

const demoImageUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 960 620'%3E%3Crect width='960' height='620' fill='%23f8fafc'/%3E%3Crect x='60' y='58' width='840' height='504' rx='28' fill='%23ffffff' stroke='%23e5e7eb' stroke-width='3'/%3E%3Crect x='100' y='100' width='318' height='384' rx='22' fill='%23fff4f4' stroke='%23f1caca' stroke-width='3'/%3E%3Cpath d='M142 416 C210 320 276 335 344 220 C374 170 392 148 418 132 L418 484 L100 484 L100 452 C116 444 129 434 142 416Z' fill='%23b71c1c' opacity='0.9'/%3E%3Cpath d='M111 469 C168 378 239 370 301 268 C343 199 371 159 418 134' fill='none' stroke='%238e0000' stroke-width='8' stroke-linecap='round'/%3E%3Ccircle cx='173' cy='374' r='12' fill='%23ffffff'/%3E%3Ccircle cx='284' cy='292' r='12' fill='%23ffffff'/%3E%3Ccircle cx='382' cy='160' r='12' fill='%23ffffff'/%3E%3Crect x='466' y='116' width='352' height='72' rx='14' fill='%23fafafa' stroke='%23e5e7eb' stroke-width='3'/%3E%3Crect x='494' y='140' width='128' height='14' rx='7' fill='%23b71c1c'/%3E%3Crect x='642' y='140' width='138' height='14' rx='7' fill='%231565c0' opacity='0.78'/%3E%3Crect x='466' y='220' width='352' height='72' rx='14' fill='%23fafafa' stroke='%23e5e7eb' stroke-width='3'/%3E%3Crect x='494' y='244' width='206' height='14' rx='7' fill='%23b71c1c'/%3E%3Crect x='718' y='244' width='62' height='14' rx='7' fill='%231565c0' opacity='0.78'/%3E%3Crect x='466' y='324' width='352' height='72' rx='14' fill='%23fafafa' stroke='%23e5e7eb' stroke-width='3'/%3E%3Crect x='494' y='348' width='92' height='14' rx='7' fill='%23b71c1c'/%3E%3Crect x='606' y='348' width='174' height='14' rx='7' fill='%231565c0' opacity='0.78'/%3E%3Crect x='466' y='428' width='352' height='72' rx='14' fill='%23fafafa' stroke='%23e5e7eb' stroke-width='3'/%3E%3Crect x='494' y='452' width='250' height='14' rx='7' fill='%23b71c1c'/%3E%3Ccircle cx='814' cy='116' r='72' fill='%23ffebee'/%3E%3Ccircle cx='814' cy='116' r='42' fill='%23b71c1c' opacity='0.9'/%3E%3Cpath d='M790 117h48M814 93v48' stroke='%23ffffff' stroke-width='9' stroke-linecap='round'/%3E%3C/svg%3E";

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
    url: demoImageUrl,
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
