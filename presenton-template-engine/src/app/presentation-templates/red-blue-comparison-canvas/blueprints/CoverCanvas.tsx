import React from "react";
import * as z from "zod";

import ComparisonHeroTitle from "../components/ComparisonHeroTitle.tsx";
import { CoverComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import EntityLegend from "../components/EntityLegend.tsx";
import ThemeCanvas from "../components/ThemeCanvas.tsx";
import ThemePill from "../components/ThemePill.tsx";
import { redBlueComparisonTheme } from "../theme/tokens.ts";

const entitySchema = z.object({
  label: z.string().min(1).max(24),
  color: z.string().optional(),
});

export const Schema = z.object({
  brandName: z.string().min(2).max(72).default("COMPARISON INSIGHTS"),
  titleLineOne: z.string().min(2).max(28).default("Entity A"),
  titleConnector: z.string().min(1).max(12).default("vs"),
  titleLineTwo: z.string().min(2).max(28).default("Entity B"),
  subtitle: z.string().min(4).max(72).default("Open comparison frame"),
  scopeItems: z
    .array(z.string().min(2).max(24))
    .min(2)
    .max(6)
    .default(["Market", "Audience", "Capability", "Outlook"]),
  entities: z.array(entitySchema).min(2).max(3).default([
    { label: "Entity A", color: "#FF4757" },
    { label: "Entity B", color: "#2E86DE" },
  ]),
  footerMeta: z.string().min(2).max(48).default("Canvas-first authoring base"),
  showSlotGuides: z.boolean().default(true),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "cover-canvas";
export const layoutName = "Cover Canvas";
export const layoutDescription =
  "An open red-blue comparison cover canvas with hero title, entity legend, scope tags, and a visual slot for custom composition.";
export const layoutTags = ["cover", "canvas", "comparison", "red-blue", "component-first", "tsx-first"];
export const layoutRole = "cover";
export const contentElements = ["brand", "headline", "subtitle", "entity-legend", "scope-tags", "visual-slot"];
export const useCases = ["cover", "opening", "comparison-frame", "custom-composition"];
export const suitableFor =
  "Suitable as a starting cover for a custom red-blue comparison deck where the Agent should compose the final opening from reusable components.";
export const avoidFor =
  "Avoid leaving it unchanged as a final page, and avoid using it for dense body analysis or chart-heavy pages.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const CoverCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <ThemeCanvas>
      {parsed.showDecorations ? <CoverComparisonDecorations /> : null}

      <div className="absolute left-[80px] right-[80px] top-[44px] z-20 flex items-center justify-between">
        <div className="text-[18px] font-black uppercase leading-none" style={{ color: redBlueComparisonTheme.colors.primary }}>
          {parsed.brandName}
        </div>
        <ThemePill tone="purple" width={230}>
          Cover Canvas
        </ThemePill>
      </div>

      <div className="absolute left-[132px] top-[152px] z-10 flex w-[700px] flex-col">
        <ComparisonHeroTitle
          leftTitle={parsed.titleLineOne}
          connector={parsed.titleConnector}
          rightTitle={parsed.titleLineTwo}
          width={700}
          fontSize={68}
          separatorWidth={72}
        />

        <div
          className="mt-[28px] w-[620px] text-[25px] font-semibold uppercase leading-[1.18]"
          style={{ color: redBlueComparisonTheme.colors.mutedText }}
        >
          {parsed.subtitle}
        </div>

        <div className="mt-[28px] flex h-[30px] max-w-[720px] items-center gap-[12px]">
          {parsed.scopeItems.map((scope, index) => (
            <React.Fragment key={`${scope}-${index}`}>
              {index > 0 ? (
                <div
                  className="h-[4px] w-[4px] flex-none rounded-full"
                  style={{ backgroundColor: redBlueComparisonTheme.colors.subtleText }}
                />
              ) : null}
              <div
                className="whitespace-nowrap text-[17px] font-bold leading-none"
                style={{ color: redBlueComparisonTheme.colors.subtleText }}
              >
                {scope}
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="mt-[44px] self-start">
          <EntityLegend items={parsed.entities} />
        </div>
      </div>

      {parsed.showSlotGuides ? (
        <div
          className="absolute right-[94px] top-[174px] z-10 flex h-[330px] w-[300px] items-center justify-center rounded-[8px] text-center"
          style={{
            border: `1px dashed ${redBlueComparisonTheme.tone.purple.border}`,
            backgroundColor: "rgba(245,243,255,0.72)",
          }}
        >
          <div className="px-[30px] text-[17px] font-black uppercase leading-[1.35]" style={{ color: redBlueComparisonTheme.colors.primary }}>
            Compose optional image, chart, or evidence motif here
          </div>
        </div>
      ) : null}

      <div
        className="absolute bottom-[52px] left-[132px] z-10 text-[14px] font-black uppercase leading-none"
        style={{ color: redBlueComparisonTheme.colors.subtleText }}
      >
        {parsed.footerMeta}
      </div>
    </ThemeCanvas>
  );
};

export default CoverCanvas;
