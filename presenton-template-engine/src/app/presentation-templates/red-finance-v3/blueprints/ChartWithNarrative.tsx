import React from "react";
import * as z from "zod";

import ChartCardShell from "../components/ChartCardShell.js";
import FinanceBarChart, { type FinanceBarChartSeries } from "../components/FinanceBarChart.js";
import FinanceContentFrame from "../components/FinanceContentFrame.js";
import FinanceLineChart, { type FinanceLineChartSeries } from "../components/FinanceLineChart.js";
import FinanceSectionHeading from "../components/FinanceSectionHeading.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import InfoListItem from "../components/InfoListItem.js";
import InsightCallout from "../components/InsightCallout.js";
import MeasuredChartArea from "../components/MeasuredChartArea.js";

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
  color: z.string().min(3).max(32),
  values: z.array(z.number().finite()).min(2).max(8),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("Chart With Narrative"),
  metaLabel: z.string().min(2).max(48).default("BLUEPRINT / CHART NARRATIVE"),
  footerText: z.string().min(6).max(80).default("Red Finance V3 | Chart With Narrative"),
  pageNumber: z.string().min(1).max(4).default("05"),
  variant: z.enum(["chart-left-narrative-right", "chart-top-narrative-bottom"]).default(
    "chart-left-narrative-right",
  ),
  density: z.enum(["low", "medium", "high"]).default("medium"),
  chartKind: z.enum(["bar", "line"]).default("bar"),
  chartTitle: z.string().min(2).max(36).default("趋势与变化"),
  chartSubtitle: z.string().min(4).max(72).default("单图表配单叙事，适合趋势和结构变化。"),
  labels: z.array(z.string().min(1).max(16)).min(2).max(8).default(["Q1", "Q2", "Q3", "Q4"]),
  series: z.array(SeriesSchema).min(1).max(3).default([
    {
      label: "Current",
      color: "var(--primary-color,#B71C1C)",
      values: [42, 48, 55, 61],
    },
    {
      label: "Target",
      color: "#1565C0",
      values: [40, 45, 50, 58],
    },
  ]),
  minValue: z.number().default(0),
  maxValue: z.number().default(100),
  ticks: z.array(z.number()).min(2).max(8).default([0, 20, 40, 60, 80, 100]),
  narrativeTitle: z.string().min(2).max(28).default("解释要点"),
  narrativeItems: z.array(NarrativeItemSchema).min(2).max(4).default([
    {
      icon: "lightbulb",
      title: "变化原因",
      description: "把关键驱动原因用短句拆开，而不是直接堆入图表说明。",
    },
    {
      icon: "shield",
      title: "口径提醒",
      description: "图表旁边保留口径和结论，保证导出后可编辑。",
    },
    {
      icon: "route",
      title: "下一步",
      description: "结论收束后能顺滑引出下一页分析或行动建议。",
    },
  ]),
  summary: z.string().min(8).max(120).default("适合单个图表加短叙事，不适合多图表仪表盘。"),
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
  const parsed = Schema.parse(data ?? {});
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
    <div className="flex h-full flex-col gap-[14px]">
      <FinanceSectionHeading title={parsed.narrativeTitle} subtitle="short interpretation" />
      <div className="flex flex-col gap-[2px]">
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
          />
        ))}
      </div>
      <InsightCallout text={parsed.summary} density={chartDensity} icon="lightbulb" />
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
