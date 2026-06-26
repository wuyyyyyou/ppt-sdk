import React from "react";
import * as z from "zod";

import ComparisonCanvas from "../components/ComparisonCanvas.tsx";
import { CoverComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import EntityLegend from "../components/EntityLegend.tsx";
import { redBlueComparisonTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  titleLineOne: z.string().min(2).max(28).default("China"),
  titleConnector: z.string().min(1).max(12).default("vs"),
  titleLineTwo: z.string().min(2).max(28).default("Japan"),
  subtitle: z.string().min(4).max(60).default("Comprehensive Comparison"),
  topicLine: z
    .string()
    .min(4)
    .max(96)
    .default("Economy - Demographics - Technology - Trade - History - Culture"),
  entities: z
    .array(
      z.object({
        label: z.string().min(1).max(24),
        color: z.string().optional(),
      }),
    )
    .min(2)
    .max(3)
    .default([
      { label: "China", color: "#FF4757" },
      { label: "Japan", color: "#2E86DE" },
    ]),
  showGrid: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "cover-comparison";
export const layoutName = "Cover Comparison";
export const layoutDescription =
  "A TSX-first red and blue comparison cover with editable title, topic line, entity legend, and reusable decorative system.";
export const layoutTags = ["cover", "comparison", "red-blue", "tsx-first"];
export const layoutRole = "cover";
export const contentElements = ["headline", "subtitle", "topic-line", "entity-legend", "decorative-circles"];
export const useCases = ["cover", "comparison opening", "country benchmark", "executive briefing"];
export const suitableFor =
  "Suitable for opening a red-blue comparison deck that contrasts countries, markets, products, or capabilities.";
export const avoidFor =
  "Avoid using this layout for dense body analysis, chart-heavy pages, timelines, or detailed comparison matrices.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const CoverComparison = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <ComparisonCanvas>
      {parsed.showGrid ? <CoverComparisonDecorations /> : null}

      <div className="absolute left-[190px] top-[154px] z-10 flex w-[900px] flex-col items-center text-center">
        <div
          className="flex h-[104px] max-w-[900px] items-center justify-center whitespace-nowrap text-[88px] font-black leading-none"
          style={{
            color: redBlueComparisonTheme.colors.backgroundText,
            fontFamily: redBlueComparisonTheme.fonts.heading,
          }}
        >
          {parsed.titleLineOne}
          <span className="px-[24px]" style={{ color: redBlueComparisonTheme.colors.primary }}>
            {parsed.titleConnector}
          </span>
          {parsed.titleLineTwo}
        </div>

        <div
          className="mt-[28px] h-[6px] w-[86px] rounded-full"
          style={{ backgroundColor: redBlueComparisonTheme.colors.primary }}
        />

        <div
          className="mt-[36px] h-[30px] whitespace-nowrap text-[24px] font-semibold uppercase leading-none tracking-[1px]"
          style={{ color: redBlueComparisonTheme.colors.mutedText }}
        >
          {parsed.subtitle}
        </div>

        <div
          className="mt-[28px] h-[28px] max-w-[860px] whitespace-nowrap text-[18px] font-medium leading-none"
          style={{ color: redBlueComparisonTheme.colors.subtleText }}
        >
          {parsed.topicLine}
        </div>

        <div className="mt-[50px]">
          <EntityLegend items={parsed.entities} />
        </div>
      </div>
    </ComparisonCanvas>
  );
};

export default CoverComparison;
