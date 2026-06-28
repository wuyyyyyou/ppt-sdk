import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import ChartContainer from "../components/ChartContainer.tsx";
import EntityComparisonMetricCard from "../components/EntityComparisonMetricCard.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";
import ThemeSoftCircle from "../components/ThemeSoftCircle.tsx";
import VerticalComparisonBarChart from "../components/VerticalComparisonBarChart.tsx";
import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

const ToneSchema = z.enum(["red", "blue", "purple", "neutral"]);

const ChartDatumSchema = z.object({
  label: z.string().min(1).max(24),
  value: z.number().min(0),
  displayValue: z.string().min(1).max(18),
  tone: ToneSchema,
});

const MetricItemSchema = z.object({
  label: z.string().min(1).max(24),
  shortLabel: z.string().min(1).max(8).optional(),
  value: z.string().min(1).max(18),
  share: z.number().min(0).max(100).optional(),
  tone: ToneSchema,
});

const MetricCardSchema = z.object({
  title: z.string().min(2).max(36),
  mode: z.enum(["rank", "bar"]),
  items: z.array(MetricItemSchema).min(2).max(3),
});

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(24).default("Economy:"),
  titleHighlight: z.string().min(2).max(34).default("Size and Growth"),
  subtitle: z
    .string()
    .min(8)
    .max(130)
    .default("Compare economic scale, growth momentum, and key benchmark indicators across two entities."),
  footerText: z.string().min(4).max(80).default("Red Blue Comparison | Economy"),
  pageNumber: z.string().min(1).max(4).default("03"),
  chartTitle: z.string().min(2).max(54).default("Nominal GDP Comparison"),
  chartSource: z.string().min(4).max(90).default("Source: public economic projections"),
  chartUnitLabel: z.string().min(1).max(4).default("T"),
  chartMaxValue: z.number().min(1).default(24),
  chartTicks: z.array(z.number().min(0)).min(2).max(5).default([0, 10, 20]),
  chartData: z.array(ChartDatumSchema).min(2).max(3).default([
    { label: "Entity A", value: 20.6, displayValue: "$20.6T", tone: "red" },
    { label: "Entity B", value: 4.5, displayValue: "$4.5T", tone: "blue" },
  ]),
  metricCards: z.array(MetricCardSchema).min(2).max(4).default([
    {
      title: "Global Economy Rank",
      mode: "rank",
      items: [
        { label: "Entity A", shortLabel: "A", value: "#2", tone: "red" },
        { label: "Entity B", shortLabel: "B", value: "#4", tone: "blue" },
      ],
    },
    {
      title: "Annual GDP Growth (%)",
      mode: "bar",
      items: [
        { label: "Entity A", shortLabel: "A", value: "4.5%", share: 85, tone: "red" },
        { label: "Entity B", shortLabel: "B", value: "0.9%", share: 20, tone: "blue" },
      ],
    },
    {
      title: "GDP Per Capita",
      mode: "bar",
      items: [
        { label: "Entity A", shortLabel: "A", value: "$13.8k", share: 40, tone: "red" },
        { label: "Entity B", shortLabel: "B", value: "$33.5k", share: 95, tone: "blue" },
      ],
    },
  ]),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({
  titlePrefix: "Economy:",
  titleHighlight: "Size and Growth",
  subtitle: "Comparative outlook for 2026 based on IMF projections and current fiscal trajectories.",
  footerText: "China vs Japan | Economy",
  pageNumber: "03",
  chartTitle: "Nominal GDP Comparison (2026 Proj.)",
  chartSource: "*Source: IMF World Economic Outlook Projections (Estimates)",
  chartUnitLabel: "T",
  chartMaxValue: 24,
  chartTicks: [0, 10, 20],
  chartData: [
    { label: "China", value: 20.65, displayValue: "$20.65T", tone: "red" },
    { label: "Japan", value: 4.46, displayValue: "$4.46T", tone: "blue" },
  ],
  metricCards: [
    {
      title: "Global Economy Rank",
      mode: "rank",
      items: [
        { label: "China", shortLabel: "CHINA", value: "#2", tone: "red" },
        { label: "Japan", shortLabel: "JAPAN", value: "#4", tone: "blue" },
      ],
    },
    {
      title: "Annual GDP Growth (%)",
      mode: "bar",
      items: [
        { label: "China", shortLabel: "CHN", value: "4.5%", share: 85, tone: "red" },
        { label: "Japan", shortLabel: "JPN", value: "0.9%", share: 20, tone: "blue" },
      ],
    },
    {
      title: "GDP Per Capita (USD)",
      mode: "bar",
      items: [
        { label: "China", shortLabel: "CHN", value: "$13.8k", share: 40, tone: "red" },
        { label: "Japan", shortLabel: "JPN", value: "$33.5k", share: 95, tone: "blue" },
      ],
    },
  ],
  showDecorations: true,
});

export const layoutId = "economy-size-growth";
export const layoutName = "Economy Size Growth";
export const layoutDescription =
  "A TSX-first comparison analysis page with a primary vertical bar chart and stacked red/blue metric cards.";
export const layoutTags = ["economy", "chart", "metrics", "comparison", "red-blue", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "subtitle", "bar-chart", "rank-card", "comparison-metric-cards", "source-note"];
export const useCases = ["economic comparison", "market scale", "growth analysis", "benchmark metrics"];
export const suitableFor =
  "Suitable for comparing two entities with one primary quantitative chart and two to three supporting metric cards.";
export const avoidFor =
  "Avoid using this layout for long narrative explanation, large tables, timeline-heavy content, or more than three compared entities.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const EconomyDecorations = () => (
  <>
    <ThemeSoftCircle tone="red" left={1030} top={-88} size={300} alpha={0.05} />
    <ThemeSoftCircle tone="blue" left={-92} top={468} size={220} alpha={0.05} />
    <ThemeSoftCircle tone="purple" left={610} top={78} size={110} alpha={0.05} />
  </>
);

const EconomySizeGrowth = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
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
      contentTop={156}
      contentHeight={498}
    >
      {parsed.showDecorations ? <EconomyDecorations /> : null}
      <div className="relative z-10 grid h-full min-h-0 grid-cols-[1.36fr_0.92fr] gap-[34px]">
        <ChartContainer title={parsed.chartTitle} tone="purple" padding={24} exportMode="screenshot">
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1">
              <VerticalComparisonBarChart
                data={parsed.chartData.map((item) => ({
                  label: item.label,
                  value: item.value,
                  displayValue: item.displayValue,
                  tone: item.tone as RedBlueTone,
                }))}
                maxValue={parsed.chartMaxValue}
                yTicks={parsed.chartTicks}
                unitLabel={parsed.chartUnitLabel}
                width={620}
                height={348}
              />
            </div>
            <div className="mt-[12px] flex-none text-right text-[11px] font-medium" style={{ color: redBlueComparisonTheme.colors.subtleText }}>
              {parsed.chartSource}
            </div>
          </div>
        </ChartContainer>

        <div className="flex h-full min-h-0 flex-col justify-between gap-[18px]">
          {parsed.metricCards.map((card, index) => (
            <EntityComparisonMetricCard
              key={`${card.title}-${index}`}
              title={card.title}
              mode={card.mode}
              items={card.items.map((item) => ({
                label: item.label,
                shortLabel: item.shortLabel,
                value: item.value,
                share: item.share,
                tone: item.tone as RedBlueTone,
              }))}
              height={index === 0 ? 160 : 144}
              tone="purple"
            />
          ))}
        </div>
      </div>
    </ThemeContentFrame>
  );
};

export default EconomySizeGrowth;
