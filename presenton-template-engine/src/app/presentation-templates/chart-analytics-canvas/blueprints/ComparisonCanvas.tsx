import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import AnalyticsCardShell from "../components/AnalyticsCardShell.tsx";
import AnalyticsSourceFooter from "../components/AnalyticsSourceFooter.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import { chartAnalyticsTheme } from "../theme/tokens.ts";

const EntitySchema = z.object({
  name: z.string().min(1).max(28),
  accentColor: z.string().min(3).max(64),
  prompt: z.string().min(4).max(96),
});

const DEFAULT_ENTITIES: z.infer<typeof EntitySchema>[] = [
  {
    name: "Entity A",
    accentColor: chartAnalyticsTheme.colors.primary,
    prompt: "Replace with evidence cards, metrics, chart fragments, or short findings.",
  },
  {
    name: "Entity B",
    accentColor: chartAnalyticsTheme.colors.accentTeal,
    prompt: "Mirror or contrast the same slots so the comparison remains scannable.",
  },
];

export const Schema = z.object({
  eyebrow: z.string().min(2).max(44).default("Comparison Canvas"),
  title: z.string().min(4).max(72).default("Two or Three Entity Comparison"),
  headerMetaLabel: z.string().min(2).max(24).default("Structure"),
  headerMetaValue: z.string().min(2).max(36).default("Open Lanes"),
  headerIcon: z.string().min(2).max(32).default("scale"),
  entities: z.array(EntitySchema).min(2).max(3).default(DEFAULT_ENTITIES),
  centerGuideTitle: z.string().min(2).max(48).default("Shared criteria / matrix / key contrast"),
  centerGuideText: z
    .string()
    .min(8)
    .max(140)
    .default("Use this band for comparison dimensions, shared assumptions, a compact table, or a synthesis callout."),
  footerSource: z.string().min(4).max(120).default("Sources: add grounded evidence and assumptions per compared entity."),
  confidentialityLabel: z.string().min(2).max(32).default("CANVAS"),
  pageNumber: z.string().min(1).max(6).default("03"),
  showSlotGuides: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "comparison-canvas";
export const layoutName = "Comparison Canvas";
export const layoutDescription =
  "A flexible analytics comparison canvas for two or three entities, options, markets, products, or capabilities.";
export const layoutTags = ["comparison", "canvas", "analytics", "component-first", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "entity-lanes", "shared-criteria-slot", "source-footer"];
export const useCases = ["two-entity-comparison", "three-entity-comparison", "benchmark", "matrix"];
export const suitableFor = "Suitable when the page intent is explicit side-by-side comparison.";
export const avoidFor = "Avoid for single-narrative pages, covers, closings, or pages dominated by one chart.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const ComparisonCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const columns = `repeat(${parsed.entities.length}, minmax(0, 1fr))`;

  return (
    <AnalyticsCanvas variant="light">
      <ExecutiveHeader
        eyebrow={parsed.eyebrow}
        title={parsed.title}
        metaLabel={parsed.headerMetaLabel}
        metaValue={parsed.headerMetaValue}
        icon={parsed.headerIcon}
      />

      <div className="flex h-[582px] flex-col gap-[22px] px-[48px] py-[32px]">
        <div className="grid flex-1 gap-[22px]" style={{ gridTemplateColumns: columns }}>
          {parsed.entities.map((entity) => (
            <AnalyticsCardShell key={entity.name} accentColor={entity.accentColor} padding={24}>
              <div className="text-[22px] font-black leading-[1.1]" style={{ color: "#0F172A" }}>
                {entity.name}
              </div>
              <div className="mt-[10px] h-[3px] w-[58px]" style={{ backgroundColor: entity.accentColor }} />
              {parsed.showSlotGuides ? (
                <div
                  className="mt-[22px] flex flex-1 items-center justify-center rounded-[8px] border border-dashed px-[26px] text-center"
                  style={{
                    borderColor: "#BFDBFE",
                    backgroundColor: "#F8FAFC",
                    color: chartAnalyticsTheme.colors.subtleText,
                  }}
                >
                  <div className="text-[15px] font-semibold leading-[1.45]">{entity.prompt}</div>
                </div>
              ) : null}
            </AnalyticsCardShell>
          ))}
        </div>

        {parsed.showSlotGuides ? (
          <div
            className="flex h-[116px] flex-none items-center justify-between rounded-[8px] border px-[28px]"
            style={{
              borderColor: chartAnalyticsTheme.colors.stroke,
              backgroundColor: chartAnalyticsTheme.colors.darkPanel,
              color: chartAnalyticsTheme.colors.darkText,
            }}
          >
            <div className="text-[20px] font-black leading-[1.2]">{parsed.centerGuideTitle}</div>
            <div className="w-[620px] text-[15px] font-medium leading-[1.45]" style={{ color: chartAnalyticsTheme.colors.darkMutedText }}>
              {parsed.centerGuideText}
            </div>
          </div>
        ) : null}
      </div>

      <AnalyticsSourceFooter
        source={parsed.footerSource}
        confidentialityLabel={parsed.confidentialityLabel}
        pageNumber={parsed.pageNumber}
      />
    </AnalyticsCanvas>
  );
};

export default ComparisonCanvas;
