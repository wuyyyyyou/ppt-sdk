import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import AnalyticsSourceFooter from "../components/AnalyticsSourceFooter.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import StructureComparisonCard, { type StructureComparisonCardData } from "../components/StructureComparisonCard.tsx";
import StructureLegendBar from "../components/StructureLegendBar.tsx";
import { chartAnalyticsTheme } from "../theme/tokens.ts";

const IconSchema = z.enum([
  "binoculars",
  "bolt",
  "chart-column",
  "chart-line",
  "chart-pie",
  "scale",
  "shield",
  "users",
  "wallet",
]);

const SegmentSchema = z.object({
  label: z.string().min(1).max(24),
  value: z.number().min(0).max(100),
  color: z.string().min(3).max(64),
});

const LegendItemSchema = z.object({
  label: z.string().min(1).max(24),
  color: z.string().min(3).max(64),
});

const EntitySchema = z.object({
  name: z.string().min(2).max(28),
  symbol: z.string().min(1).max(6),
  statusLabel: z.string().min(2).max(30),
  accentColor: z.string().min(3).max(64),
  symbolTint: z.string().min(3).max(64),
  totalValue: z.string().min(1).max(16),
  totalLabel: z.string().min(2).max(20),
  centerMetricLabel: z.string().min(2).max(24),
  centerMetricValue: z.string().min(1).max(12),
  segments: z.array(SegmentSchema).min(2).max(5),
  footerLabel: z.string().min(2).max(32),
  footerValue: z.string().min(1).max(12),
  footerSuffix: z.string().max(6).optional(),
  footerTint: z.string().min(3).max(64),
  footerTextColor: z.string().min(3).max(64),
  footerIcon: IconSchema.default("users"),
});

const DEFAULT_LEGEND_ITEMS: z.infer<typeof LegendItemSchema>[] = [
  { label: "Segment A", color: "#CBD5E1" },
  { label: "Segment B", color: "#475569" },
  { label: "Segment C", color: "#F43F5E" },
];

const DEFAULT_ENTITIES: z.infer<typeof EntitySchema>[] = [
  {
    name: "Entity A",
    symbol: "A",
    statusLabel: "Maturing Structure",
    accentColor: chartAnalyticsTheme.colors.primary,
    symbolTint: "#EFF6FF",
    totalValue: "1.20B",
    totalLabel: "Total Base",
    centerMetricLabel: "Median",
    centerMetricValue: "39.5",
    segments: [
      { label: "Segment A", value: 17, color: "#CBD5E1" },
      { label: "Segment B", value: 68, color: "#475569" },
      { label: "Segment C", value: 15, color: "#F43F5E" },
    ],
    footerLabel: "Dependency Ratio",
    footerValue: "22.5",
    footerSuffix: "%",
    footerTint: "#EFF6FF",
    footerTextColor: "#1E40AF",
    footerIcon: "users",
  },
  {
    name: "Entity B",
    symbol: "B",
    statusLabel: "Advanced Structure",
    accentColor: "#F43F5E",
    symbolTint: "#FFF1F2",
    totalValue: "125M",
    totalLabel: "Total Base",
    centerMetricLabel: "Median",
    centerMetricValue: "49.5",
    segments: [
      { label: "Segment A", value: 11, color: "#CBD5E1" },
      { label: "Segment B", value: 59, color: "#475569" },
      { label: "Segment C", value: 30, color: "#F43F5E" },
    ],
    footerLabel: "Dependency Ratio",
    footerValue: "54.2",
    footerSuffix: "%",
    footerTint: "#FFF1F2",
    footerTextColor: "#9F1239",
    footerIcon: "users",
  },
];

export const Schema = z.object({
  eyebrow: z.string().min(2).max(44).default("Structure Analysis"),
  title: z.string().min(4).max(72).default("Population Structure: Age Distribution"),
  headerMetaLabel: z.string().min(2).max(24).default("Data Source"),
  headerMetaValue: z.string().min(2).max(40).default("Public Dataset"),
  headerIcon: IconSchema.default("users"),
  legendItems: z.array(LegendItemSchema).min(2).max(5).default(DEFAULT_LEGEND_ITEMS),
  entities: z.array(EntitySchema).min(2).max(2).default(DEFAULT_ENTITIES),
  footerSource: z.string().min(4).max(120).default("Source: public demographic or market structure dataset"),
  pageNumber: z.string().min(1).max(6).default("06"),
});

export const layoutId = "population-structure-comparison";
export const layoutName = "Population Structure Comparison";
export const layoutDescription =
  "A TSX-first two-entity structure comparison page with a dark analytics header, shared legend, paired donut cards, center metrics, and footer ratio highlights.";
export const layoutTags = ["structure", "donut-chart", "comparison", "demographics", "analytics", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "legend", "entity-comparison-cards", "donut-charts", "center-metrics", "ratio-footer"];
export const useCases = ["population-structure", "segment-composition", "age-distribution", "two-entity-benchmark"];
export const suitableFor =
  "Suitable for comparing two entities by composition shares, with one donut chart per entity and one headline metric in each chart center.";
export const avoidFor =
  "Avoid using this layout for long time-series analysis, more than two compared entities, dense tables, or pages that need more than five composition segments.";
export const density = "medium";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";


const PopulationStructureComparison = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <AnalyticsCanvas variant="light">
      <ExecutiveHeader
        eyebrow={parsed.eyebrow}
        title={parsed.title}
        metaLabel={parsed.headerMetaLabel}
        metaValue={parsed.headerMetaValue}
        icon={parsed.headerIcon}
      />

      <div className="flex h-[620px] flex-col px-[48px] pb-[18px] pt-[28px]">
        <div className="flex-none">
          <StructureLegendBar items={parsed.legendItems} />
        </div>

        <div className="mt-[24px] grid min-h-0 flex-1 grid-cols-2 gap-[40px]">
          {parsed.entities.map((entity) => (
            <StructureComparisonCard key={entity.name} entity={entity as StructureComparisonCardData} />
          ))}
        </div>

        <AnalyticsSourceFooter source={parsed.footerSource} pageNumber={parsed.pageNumber} height={34} padded={false} backgroundColor="transparent" />
      </div>
    </AnalyticsCanvas>
  );
};

export default PopulationStructureComparison;
