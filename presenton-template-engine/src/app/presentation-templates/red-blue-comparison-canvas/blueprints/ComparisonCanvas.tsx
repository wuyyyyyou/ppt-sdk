import React from "react";
import * as z from "zod";

import { BalancedComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import EntityLegend from "../components/EntityLegend.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";
import ThemePanelShell from "../components/ThemePanelShell.tsx";
import ThemePill from "../components/ThemePill.tsx";
import { redBlueComparisonTheme } from "../theme/tokens.ts";

const entitySchema = z.object({
  label: z.string().min(1).max(24),
  color: z.string().optional(),
});

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(34).default("Comparison"),
  titleHighlight: z.string().min(2).max(34).default("Canvas"),
  subtitle: z
    .string()
    .min(8)
    .max(120)
    .default("Start from two or three entity lanes, then replace each slot with cards, evidence, charts, or matrices."),
  footerText: z.string().min(4).max(80).default("Red Blue Comparison Canvas | Comparison"),
  pageNumber: z.string().min(1).max(4).default("03"),
  entities: z.array(entitySchema).min(2).max(3).default([
    { label: "Entity A", color: "#FF4757" },
    { label: "Entity B", color: "#2E86DE" },
  ]),
  guideTitle: z.string().min(2).max(48).default("Entity lane"),
  guideText: z.string().min(8).max(120).default("Compose metrics, profiles, evidence, chart excerpts, or table cells."),
  showSlotGuides: z.boolean().default(true),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "comparison-canvas";
export const layoutName = "Comparison Canvas";
export const layoutDescription =
  "A two- or three-entity red-blue comparison canvas with balanced lanes and an entity legend.";
export const layoutTags = ["comparison", "canvas", "entity-lanes", "component-first", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "subtitle", "entity-legend", "comparison-slots", "footer-meta"];
export const useCases = ["two-entity comparison", "three-entity comparison", "matrix starting point", "benchmark page"];
export const suitableFor =
  "Suitable for pages that compare two or three entities using cards, compact charts, evidence blocks, or a structured matrix.";
export const avoidFor =
  "Avoid for single-entity narrative pages, long prose, or dense dashboards with unrelated modules.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const defaultColors = [
  redBlueComparisonTheme.colors.chinaRed,
  redBlueComparisonTheme.colors.japanBlue,
  redBlueComparisonTheme.colors.koreaRed,
];

const ComparisonCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <ThemeContentFrame
      titlePrefix={parsed.titlePrefix}
      titleHighlight={parsed.titleHighlight}
      subtitle={parsed.subtitle}
      meta={<EntityLegend items={parsed.entities} />}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      tone="purple"
      showHeaderDivider={false}
      contentTop={164}
      contentHeight={498}
    >
      {parsed.showDecorations ? <BalancedComparisonDecorations /> : null}
      <div
        className="relative z-10 grid h-full min-h-0 gap-[24px]"
        style={{ gridTemplateColumns: `repeat(${parsed.entities.length}, minmax(0, 1fr))` }}
      >
        {parsed.entities.map((entity, index) => {
          const color = entity.color ?? defaultColors[index % defaultColors.length];
          return (
            <ThemePanelShell key={`${entity.label}-${index}`} className="flex min-h-0 flex-col" padding={0}>
              <div className="h-[8px] w-full" style={{ backgroundColor: color }} />
              <div className="flex items-center justify-between px-[22px] pt-[20px]">
                <div className="text-[25px] font-black leading-none" style={{ color }}>
                  {entity.label}
                </div>
                <ThemePill tone={index === 0 ? "red" : index === 1 ? "blue" : "purple"} width={104}>
                  Lane {index + 1}
                </ThemePill>
              </div>
              {parsed.showSlotGuides ? (
                <div className="flex flex-1 items-center justify-center px-[24px] text-center">
                  <div>
                    <div className="text-[22px] font-black leading-none" style={{ color }}>
                      {parsed.guideTitle}
                    </div>
                    <div className="mt-[16px] text-[16px] font-medium leading-[1.5]" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
                      {parsed.guideText}
                    </div>
                  </div>
                </div>
              ) : null}
            </ThemePanelShell>
          );
        })}
      </div>
    </ThemeContentFrame>
  );
};

export default ComparisonCanvas;
