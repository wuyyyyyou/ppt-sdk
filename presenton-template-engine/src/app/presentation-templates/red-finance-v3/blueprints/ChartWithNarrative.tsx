import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import ChartCardShell from "../components/ChartCardShell.tsx";
import FinanceBarChart, { type FinanceBarChartSeries } from "../components/FinanceBarChart.tsx";
import FinanceContentFrame from "../components/FinanceContentFrame.tsx";
import FinanceLineChart, { type FinanceLineChartSeries } from "../components/FinanceLineChart.tsx";
import FinanceSectionHeading from "../components/FinanceSectionHeading.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import InfoListItem from "../components/InfoListItem.tsx";
import InsightCallout from "../components/InsightCallout.tsx";
import MeasuredChartArea from "../components/MeasuredChartArea.tsx";

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
  "laptop-code",
  "lightbulb",
  "microchip",
  "route",
  "shield",
  "wallet",
]);

const NarrativeItemSchema = z.object({
  icon: IconSchema,
  title: z.string().min(2).max(28),
  description: z.string().min(8).max(96),
});

const SeriesSchema = z.object({
  label: z.string().min(2).max(24),
  color: z.string().min(3).max(64),
  values: z.array(z.number().finite()).min(2).max(8),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("Chart With Narrative"),
  metaLabel: z.string().min(2).max(48).default("BLUEPRINT / CHART NARRATIVE"),
  footerText: z.string().min(6).max(80).default("Business Professional | Chart With Narrative"),
  pageNumber: z.string().min(1).max(4).default("05"),
  variant: z.enum(["chart-left-narrative-right", "chart-top-narrative-bottom"]).default(
    "chart-left-narrative-right",
  ),
  density: z.enum(["low", "medium", "high"]).default("medium"),
  chartKind: z.enum(["bar", "line"]).default("bar"),
  chartTitle: z.string().min(2).max(36).default("Trend and change"),
  chartSubtitle: z.string().min(4).max(72).default("One chart paired with one concise narrative."),
  labels: z.array(z.string().min(1).max(16)).min(2).max(8).default(["Q1", "Q2", "Q3", "Q4"]),
  series: z.array(SeriesSchema).min(1).max(3).default([
    {
      label: "Current",
      color: "var(--primary-color,#B71C1C)",
      values: [42, 48, 55, 61],
    },
    {
      label: "Target",
      color: "var(--secondary-color,var(--graph-1,#1565C0))",
      values: [40, 45, 50, 58],
    },
  ]),
  minValue: z.number().default(0),
  maxValue: z.number().default(100),
  ticks: z.array(z.number()).min(2).max(8).default([0, 20, 40, 60, 80, 100]),
  narrativeTitle: z.string().min(2).max(28).default("Interpretation points"),
  narrativeItems: z.array(NarrativeItemSchema).min(2).max(4).default([
    {
      icon: "lightbulb",
      title: "Change drivers",
      description: "Break key drivers into short points instead of crowding the chart.",
    },
    {
      icon: "shield",
      title: "Measurement note",
      description: "Keep definitions and conclusions editable beside the chart.",
    },
    {
      icon: "route",
      title: "Next step",
      description: "Use the conclusion to bridge into the next analysis or action.",
    },
  ]),
  summary: z.string().min(8).max(120).default("Best for one primary chart with concise interpretation; avoid dashboard-style chart collections."),
});

export const layoutId = "chart-with-narrative";
export const layoutName = "Chart With Narrative";
export const layoutDescription =
  "A tsx-first slide that pairs one primary chart with compact narrative interpretation.";
export const layoutTags = ["chart", "narrative", "evidence", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["chart", "narrative-list", "summary"];
export const useCases = ["trend", "scale", "structure-change", "evidence"];
export const suitableFor = "Suitable for a single chart with short explanatory notes and a concise conclusion.";
export const avoidFor = "Avoid using this layout for chart collections, dense matrices, or timeline-based storytelling.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const ChartWithNarrative = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const chartDensity = parsed.density === "high" ? "dense" : parsed.density === "low" ? "compact" : "normal";
  const isTopChart = parsed.variant === "chart-top-narrative-bottom";

  const chartPane = (
    <ChartCardShell title={parsed.chartTitle} subtitle={parsed.chartSubtitle} rightMeta={parsed.chartKind.toUpperCase()}>
      <MeasuredChartArea minHeight={230}>
        {({ width, height }) =>
          parsed.chartKind === "line" ? (
            <FinanceLineChart
              labels={parsed.labels}
              series={parsed.series as FinanceLineChartSeries[]}
              minValue={parsed.minValue}
              maxValue={parsed.maxValue}
              ticks={parsed.ticks}
              width={width}
              height={height}
            />
          ) : (
            <FinanceBarChart
              labels={parsed.labels}
              series={parsed.series as FinanceBarChartSeries[]}
              minValue={parsed.minValue}
              maxValue={parsed.maxValue}
              ticks={parsed.ticks}
              width={width}
              height={height}
            />
          )
        }
      </MeasuredChartArea>
    </ChartCardShell>
  );

  const narrativePane = (
    <div className="flex h-full min-h-0 flex-col gap-[12px]">
      <FinanceSectionHeading
        title={parsed.narrativeTitle}
        subtitle="short interpretation"
        marginBottom={0}
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
            density={chartDensity}
            textScale={parsed.density === "high" ? "small" : "normal"}
            descriptionMaxLines={2}
            fillHeight
            verticalAlign="center"
          />
        ))}
      </div>
      <div className="flex-none">
        <InsightCallout text={parsed.summary} density={chartDensity} icon="lightbulb" />
      </div>
    </div>
  );

  return (
    <FinanceContentFrame
      title={parsed.title}
      metaIcon={<FinanceIcon name="chart-line" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={160}
      contentBottomInset={12}
    >
      {isTopChart ? (
        <div className="flex h-full min-h-0 flex-col gap-[18px]">
          <div className="h-[296px] min-h-0">{chartPane}</div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-[22px]">{narrativePane}</div>
        </div>
      ) : (
        <div className="grid h-full min-h-0 grid-cols-[1.12fr_0.88fr] gap-[22px]">
          {chartPane}
          {narrativePane}
        </div>
      )}
    </FinanceContentFrame>
  );
};

export default ChartWithNarrative;
