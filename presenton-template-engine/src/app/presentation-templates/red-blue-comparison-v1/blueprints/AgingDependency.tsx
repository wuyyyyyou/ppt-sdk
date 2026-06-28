import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import ChartContainer from "../components/ChartContainer.tsx";
import InsightMetricCard from "../components/InsightMetricCard.tsx";
import StackedCompositionBarChart from "../components/StackedCompositionBarChart.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";
import ThemeSoftCircle from "../components/ThemeSoftCircle.tsx";
import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

const ToneSchema = z.enum(["red", "blue", "purple", "neutral"]);
const InsightIconSchema = z.enum(["flag", "lightbulb", "users", "trend"]);

const SegmentSchema = z.object({
  key: z.string().min(1).max(24),
  label: z.string().min(1).max(24),
  color: z.string().min(4).max(32),
  textColor: z.string().min(4).max(32).optional(),
});

const CompositionRowSchema = z.object({
  label: z.string().min(1).max(24),
  values: z.record(z.string(), z.number().min(0).max(100)),
});

const InsightCardSchema = z.object({
  label: z.string().min(2).max(28),
  value: z.string().min(1).max(18).optional(),
  description: z.string().min(8).max(140),
  tone: ToneSchema,
  icon: InsightIconSchema.default("flag"),
  emphasis: z.enum(["metric", "conclusion"]).default("metric"),
});

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(30).default("Aging &"),
  titleHighlight: z.string().min(2).max(34).default("Demographics"),
  subtitle: z.string().min(8).max(120).default("Age structure breakdown across comparison entities."),
  footerText: z.string().min(4).max(80).default("Red Blue Comparison | Demographics"),
  pageNumber: z.string().min(1).max(4).default("06"),
  chartTitle: z.string().min(2).max(54).default("Population by Age Group"),
  chartSubtitle: z.string().min(4).max(70).optional(),
  chartNote: z.string().min(4).max(90).default("Values shown as share of total population."),
  chartUnitLabel: z.string().min(1).max(4).default("%"),
  segments: z.array(SegmentSchema).min(2).max(5).default([
    { key: "young", label: "0-14", color: "#00CEC9", textColor: "#FFFFFF" },
    { key: "working", label: "15-64", color: "#DFE6E9", textColor: "#2D3436" },
    { key: "elderly", label: "65+", color: "#5038A6", textColor: "#FFFFFF" },
  ]),
  rows: z.array(CompositionRowSchema).min(2).max(4).default([
    { label: "Entity A", values: { young: 16, working: 68, elderly: 16 } },
    { label: "Entity B", values: { young: 12, working: 58, elderly: 30 } },
  ]),
  insightCards: z.array(InsightCardSchema).min(2).max(4).default([
    {
      label: "Entity B (65+)",
      value: "30%",
      description: "A mature aging profile with a high elderly share and sustained labor pressure.",
      tone: "blue",
      icon: "flag",
      emphasis: "metric",
    },
    {
      label: "Entity A (65+)",
      value: "16%",
      description: "A faster demographic transition that is reshaping labor supply and public services.",
      tone: "red",
      icon: "flag",
      emphasis: "metric",
    },
    {
      label: "Key Conclusion",
      description: "The comparison should focus on aging speed, labor dependency, and the different policy timelines implied by each profile.",
      tone: "purple",
      icon: "lightbulb",
      emphasis: "conclusion",
    },
  ]),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({
  titlePrefix: "Aging &",
  titleHighlight: "Demographics",
  subtitle: "Age Structure Breakdown: China vs Japan (2025 Est.)",
  footerText: "China vs Japan | Demographics",
  pageNumber: "06",
  chartTitle: "Population by Age Group (%)",
  chartSubtitle: "Share of total population by broad age cohort",
  chartNote: "Values shown as share of total population.",
  chartUnitLabel: "%",
  segments: [
    { key: "young", label: "0-14", color: "#00CEC9", textColor: "#FFFFFF" },
    { key: "working", label: "15-64", color: "#DFE6E9", textColor: "#2D3436" },
    { key: "elderly", label: "65+", color: "#5038A6", textColor: "#FFFFFF" },
  ],
  rows: [
    { label: "China", values: { young: 16.5, working: 69.1, elderly: 14.4 } },
    { label: "Japan", values: { young: 11.5, working: 58.7, elderly: 29.8 } },
  ],
  insightCards: [
    {
      label: "Japan (65+)",
      value: "29.8%",
      description: "World's highest elderly proportion. A super-aged society facing persistent labor shortages.",
      tone: "blue",
      icon: "flag",
      emphasis: "metric",
    },
    {
      label: "China (65+)",
      value: "14.4%",
      description: "Rapidly aging. The workforce is shrinking before the nation reaches high-income status.",
      tone: "red",
      icon: "flag",
      emphasis: "metric",
    },
    {
      label: "Key Conclusion",
      description:
        "Japan manages a mature aging crisis, while China faces a steeper transition that challenges its traditional manufacturing advantage.",
      tone: "purple",
      icon: "lightbulb",
      emphasis: "conclusion",
    },
  ],
  showDecorations: true,
});

export const layoutId = "aging-dependency";
export const layoutName = "Aging Dependency";
export const layoutDescription =
  "A TSX-first composition comparison page with a 100% stacked age-structure chart and concise right-side insight cards.";
export const layoutTags = ["demographics", "composition", "stacked-chart", "insights", "comparison", "red-blue", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "subtitle", "stacked-composition-chart", "chart-legend", "metric-cards", "conclusion-card"];
export const useCases = ["demographic structure comparison", "age dependency analysis", "part-to-whole benchmark", "population risk summary"];
export const suitableFor =
  "Suitable for comparing two to four entities across two to five percentage-based composition segments with two key metric callouts and one concise conclusion.";
export const avoidFor =
  "Avoid using this layout for time-series trends, non-percentage data, dense tables, long policy narrative, or more than four compared entities.";
export const density = "high";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const AgingDecorations = () => (
  <>
    <ThemeSoftCircle tone="purple" left={-88} top={-104} size={350} alpha={0.03} />
    <ThemeSoftCircle tone="blue" left={1082} top={492} size={210} alpha={0.04} />
    <ThemeSoftCircle tone="red" left={880} top={86} size={118} alpha={0.035} />
  </>
);

const AgingDependency = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <ThemeContentFrame
      titlePrefix={parsed.titlePrefix}
      titleHighlight={parsed.titleHighlight}
      subtitle={parsed.subtitle}
      tone="purple"
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      showHeaderDivider={false}
      contentTop={150}
      contentHeight={504}
    >
      {parsed.showDecorations ? <AgingDecorations /> : null}
      <div className="relative z-10 grid h-full min-h-0 grid-cols-[2fr_0.98fr] gap-[30px]">
        <ChartContainer
          title={parsed.chartTitle}
          subtitle={parsed.chartSubtitle}
          tone="purple"
          padding={22}
          exportMode="editable"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1">
              <StackedCompositionBarChart
                rows={parsed.rows}
                segments={parsed.segments}
                unitLabel={parsed.chartUnitLabel}
                height={360}
              />
            </div>
            <div className="mt-[10px] flex-none truncate text-right text-[11px] font-medium" style={{ color: redBlueComparisonTheme.colors.subtleText }}>
              {parsed.chartNote}
            </div>
          </div>
        </ChartContainer>

        <div className="flex h-full min-h-0 flex-col gap-[18px]">
          {parsed.insightCards.map((card, index) => (
            <div
              key={`${card.label}-${index}`}
              className={card.emphasis === "conclusion" ? "mt-auto" : undefined}
            >
              <InsightMetricCard
                label={card.label}
                value={card.value}
                description={card.description}
                tone={card.tone as RedBlueTone}
                icon={card.icon}
                emphasis={card.emphasis}
                height={card.emphasis === "conclusion" ? 144 : 136}
              />
            </div>
          ))}
        </div>
      </div>
    </ThemeContentFrame>
  );
};

export default AgingDependency;
