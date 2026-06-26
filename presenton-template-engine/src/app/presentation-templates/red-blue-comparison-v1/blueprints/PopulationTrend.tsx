import React from "react";
import * as z from "zod";

import ChartContainer from "../components/ChartContainer.tsx";
import DualAxisProjectionLineChart, {
  type ProjectionAxisConfig,
  type ProjectionLineSeries,
} from "../components/DualAxisProjectionLineChart.tsx";
import ProjectionLegend from "../components/ProjectionLegend.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";
import ThemeSoftCircle from "../components/ThemeSoftCircle.tsx";
import TrendInsightCard, { type TrendInsightIconName } from "../components/TrendInsightCard.tsx";
import { type RedBlueTone, redBlueComparisonTheme } from "../theme/tokens.ts";

const ToneSchema = z.enum(["red", "blue", "purple", "neutral"]);
const AxisSideSchema = z.enum(["left", "right"]);
const InsightIconSchema = z.enum(["trend", "decline", "outlook", "users"]);

const AxisSchema = z.object({
  id: AxisSideSchema,
  label: z.string().min(2).max(40),
  min: z.number().finite(),
  max: z.number().finite(),
  ticks: z.array(z.number().finite()).min(2).max(8),
  tickSuffix: z.string().max(8).optional(),
  tone: ToneSchema,
  width: z.number().min(42).max(82).optional(),
});

const SeriesSchema = z.object({
  label: z.string().min(2).max(34),
  axis: AxisSideSchema,
  tone: ToneSchema,
  values: z.array(z.number().finite()).min(2).max(14),
});

const InsightCardSchema = z.object({
  title: z.string().min(2).max(28),
  value: z.string().min(1).max(18),
  description: z.string().min(8).max(160),
  tone: ToneSchema,
  icon: InsightIconSchema.default("trend"),
});

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(34).default("Population Trends:"),
  titleHighlight: z.string().min(2).max(26).default("2000-2050"),
  subtitle: z.string().min(8).max(140).default("Historical trajectory and future projections across compared entities."),
  footerText: z.string().min(4).max(90).default("Red Blue Comparison | Population Trends"),
  pageNumber: z.string().min(1).max(4).default("07"),
  chartTitle: z.string().min(2).max(56).default("Total Population Trajectory"),
  chartSubtitle: z.string().min(4).max(88).optional(),
  chartNote: z.string().min(4).max(110).default("*Source: update with selected evidence."),
  labels: z.array(z.string().min(1).max(12)).min(2).max(14).default(["2000", "2010", "2020", "2030", "2040", "2050"]),
  leftAxis: AxisSchema.default({
    id: "left",
    label: "Entity A Population",
    min: 0,
    max: 100,
    ticks: [0, 25, 50, 75, 100],
    tone: "red",
  }),
  rightAxis: AxisSchema.default({
    id: "right",
    label: "Entity B Population",
    min: 0,
    max: 100,
    ticks: [0, 25, 50, 75, 100],
    tone: "blue",
  }),
  series: z.array(SeriesSchema).min(1).max(3).default([
    { label: "Entity A", axis: "left", tone: "red", values: [62, 70, 78, 76, 72, 68] },
    { label: "Entity B", axis: "right", tone: "blue", values: [78, 80, 76, 70, 64, 58] },
  ]),
  projectionStartIndex: z.number().int().min(0).max(13).default(3),
  projectionLabel: z.string().min(2).max(34).default("Projection"),
  insightCards: z.array(InsightCardSchema).min(2).max(4).default([
    {
      title: "Entity A inflection",
      value: "Peak",
      description: "Use this card to call out the year or point where the trend changes direction.",
      tone: "red",
      icon: "trend",
    },
    {
      title: "Entity B decline",
      value: "-18%",
      description: "Use this card to summarize the magnitude of the projected change.",
      tone: "blue",
      icon: "decline",
    },
    {
      title: "Outlook",
      value: "High impact",
      description: "Use this card for labor, demand, fiscal, or strategic implications.",
      tone: "purple",
      icon: "outlook",
    },
  ]),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({
  titlePrefix: "Population Trends:",
  titleHighlight: "2000-2050",
  subtitle: "Historical trajectory and UN future projections highlighting critical demographic turning points.",
  footerText: "China vs Japan | Population Trends",
  pageNumber: "07",
  chartTitle: "Total Population Trajectory",
  chartSubtitle: "Dual-scale view for absolute population movement",
  chartNote: "*Source: UN World Population Prospects (Medium Variant)",
  labels: ["2000", "2005", "2010", "2015", "2020", "2025", "2030", "2035", "2040", "2045", "2050"],
  leftAxis: {
    id: "left",
    label: "China Population (Billions)",
    min: 1.2,
    max: 1.5,
    ticks: [1.2, 1.3, 1.4, 1.5],
    tickSuffix: "B",
    tone: "red",
    width: 62,
  },
  rightAxis: {
    id: "right",
    label: "Japan Population (Millions)",
    min: 80,
    max: 140,
    ticks: [80, 100, 120, 140],
    tickSuffix: "M",
    tone: "blue",
    width: 62,
  },
  series: [
    {
      label: "China (Left Scale)",
      axis: "left",
      tone: "red",
      values: [1.26, 1.3, 1.34, 1.37, 1.41, 1.41, 1.4, 1.38, 1.35, 1.32, 1.29],
    },
    {
      label: "Japan (Right Scale)",
      axis: "right",
      tone: "blue",
      values: [126.9, 127.7, 128, 127, 126.2, 123.5, 119.1, 114.5, 109.8, 105.2, 100],
    },
  ],
  projectionStartIndex: 5,
  projectionLabel: "Projection (post-2024)",
  insightCards: [
    {
      title: "China's Inflection",
      value: "2022",
      description: "The year China's population officially began to shrink, marking the end of decades of growth.",
      tone: "red",
      icon: "trend",
    },
    {
      title: "Japan's Decline",
      value: "-18%",
      description: "Projected population loss from the 2010 peak to 2050, accelerating over the next two decades.",
      tone: "blue",
      icon: "decline",
    },
    {
      title: "2050 Outlook",
      value: "High Impact",
      description: "Both nations face shrinking labor forces, requiring automation policies and economic restructuring.",
      tone: "purple",
      icon: "outlook",
    },
  ],
  showDecorations: true,
});

export const layoutId = "population-trend";
export const layoutName = "Population Trend";
export const layoutDescription =
  "A TSX-first dual-axis projection trend page with one primary line chart and right-side insight cards.";
export const layoutTags = ["population", "trend", "projection", "dual-axis-chart", "insights", "comparison", "red-blue", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "subtitle", "dual-axis-line-chart", "projection-legend", "source-note", "insight-cards"];
export const useCases = ["population trend comparison", "forecast comparison", "historical and projected trajectory", "two-entity time series"];
export const suitableFor =
  "Suitable for comparing one or two time-series trajectories with different units or scales, especially when a projected segment and concise implications are needed.";
export const avoidFor =
  "Avoid using this layout for more than three series, dense dashboards, categorical comparison matrices, or content without time-series evidence.";
export const density = "high";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const PopulationTrendDecorations = () => (
  <>
    <ThemeSoftCircle tone="purple" left={980} top={-186} size={380} alpha={0.03} />
    <ThemeSoftCircle tone="blue" left={-54} top={542} size={206} alpha={0.04} />
    <ThemeSoftCircle tone="red" left={254} top={104} size={142} alpha={0.035} />
  </>
);

const PopulationTrend = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const legendItems = parsed.series.map((entry) => ({
    label: entry.label,
    tone: entry.tone as RedBlueTone,
  }));

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
      {parsed.showDecorations ? <PopulationTrendDecorations /> : null}
      <div className="relative z-10 grid h-full min-h-0 grid-cols-[3fr_1fr] gap-[30px]">
        <ChartContainer
          title={parsed.chartTitle}
          subtitle={parsed.chartSubtitle}
          tone="purple"
          padding={20}
          exportMode="screenshot"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-[8px] flex flex-none justify-end">
              <ProjectionLegend items={legendItems} projectionLabel={parsed.projectionLabel} />
            </div>
            <div className="min-h-0 flex-1">
              <DualAxisProjectionLineChart
                labels={parsed.labels}
                series={parsed.series as ProjectionLineSeries[]}
                leftAxis={parsed.leftAxis as ProjectionAxisConfig}
                rightAxis={parsed.rightAxis as ProjectionAxisConfig}
                projectionStartIndex={parsed.projectionStartIndex}
                width={760}
                height={336}
              />
            </div>
            <div className="mt-[8px] flex-none truncate text-right text-[11px] font-medium" style={{ color: redBlueComparisonTheme.colors.subtleText }}>
              {parsed.chartNote}
            </div>
          </div>
        </ChartContainer>

        <div className="flex h-full min-h-0 flex-col gap-[18px]">
          {parsed.insightCards.map((card, index) => (
            <TrendInsightCard
              key={`${card.title}-${index}`}
              title={card.title}
              value={card.value}
              description={card.description}
              tone={card.tone as RedBlueTone}
              icon={card.icon as TrendInsightIconName}
              height={index === parsed.insightCards.length - 1 ? 168 : 150}
            />
          ))}
        </div>
      </div>
    </ThemeContentFrame>
  );
};

export default PopulationTrend;
