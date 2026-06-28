import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import ComparisonHeroTitle from "../components/ComparisonHeroTitle.tsx";
import { CoverComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import EntityLegend from "../components/EntityLegend.tsx";
import ThemeCanvas from "../components/ThemeCanvas.tsx";
import { redBlueComparisonTheme } from "../theme/tokens.ts";

const entitySchema = z.object({
  label: z.string().min(1).max(24),
  color: z.string().optional(),
});

export const Schema = z.object({
  titleLineOne: z.string().min(2).max(28).default("Entity A"),
  titleConnector: z.string().min(1).max(12).default("vs"),
  titleLineTwo: z.string().min(2).max(28).default("Entity B"),
  subtitle: z.string().min(4).max(60).default("Comparative Analysis"),
  topicItems: z
    .array(z.string().min(2).max(24))
    .min(2)
    .max(8)
    .default(["Market", "Scale", "Capability", "Outlook"]),
  entities: z.array(entitySchema).min(2).max(3).default([
    { label: "Entity A", color: "#FF4757" },
    { label: "Entity B", color: "#2E86DE" },
  ]),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({
  titleLineOne: "China",
  titleConnector: "vs",
  titleLineTwo: "Japan",
  subtitle: "Comprehensive Comparison",
  topicItems: ["Economy", "Demographics", "Technology", "Trade", "History", "Culture"],
  entities: [
    { label: "China", color: "#FF4757" },
    { label: "Japan", color: "#2E86DE" },
  ],
  showDecorations: true,
});

export const layoutId = "cover-comparison";
export const layoutName = "Cover Comparison";
export const layoutDescription =
  "A TSX-first red and blue comparison cover inspired by source page 1, with editable title, topic list, entity legend, and reusable decorative system.";
export const layoutTags = ["cover", "comparison", "red-blue", "tsx-first"];
export const layoutRole = "cover";
export const contentElements = ["headline", "subtitle", "topic-list", "entity-legend", "decorative-circles"];
export const useCases = ["cover", "comparison opening", "country benchmark", "executive briefing"];
export const suitableFor =
  "Suitable for opening a red-blue comparison deck that contrasts countries, markets, products, or capabilities.";
export const avoidFor =
  "Avoid using this layout for dense body analysis, chart-heavy pages, timelines, or detailed comparison matrices.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const CoverComparison = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <ThemeCanvas>
      {parsed.showDecorations ? <CoverComparisonDecorations /> : null}

      <div className="absolute left-[190px] top-[154px] z-10 flex w-[900px] flex-col items-center text-center">
        <ComparisonHeroTitle
          leftTitle={parsed.titleLineOne}
          connector={parsed.titleConnector}
          rightTitle={parsed.titleLineTwo}
        />

        <div
          className="mt-[36px] h-[30px] whitespace-nowrap text-[24px] font-semibold uppercase leading-none tracking-[1px]"
          style={{ color: redBlueComparisonTheme.colors.mutedText }}
        >
          {parsed.subtitle}
        </div>

        <div className="mt-[28px] flex h-[28px] max-w-[900px] items-center justify-center gap-[12px]">
          {parsed.topicItems.map((topic, index) => (
            <React.Fragment key={`${topic}-${index}`}>
              {index > 0 ? (
                <div
                  className="h-[4px] w-[4px] flex-none rounded-full"
                  style={{ backgroundColor: redBlueComparisonTheme.colors.subtleText }}
                />
              ) : null}
              <div
                className="whitespace-nowrap text-[18px] font-medium leading-none"
                style={{ color: redBlueComparisonTheme.colors.subtleText }}
              >
                {topic}
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="mt-[50px]">
          <EntityLegend items={parsed.entities} />
        </div>
      </div>
    </ThemeCanvas>
  );
};

export default CoverComparison;
