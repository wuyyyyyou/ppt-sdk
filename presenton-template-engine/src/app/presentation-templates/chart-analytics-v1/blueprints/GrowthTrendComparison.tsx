import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import AnalyticsLineChart, { type AnalyticsLineSeries } from "../components/AnalyticsLineChart.tsx";
import AnalyticsSourceFooter from "../components/AnalyticsSourceFooter.tsx";
import ChartPanelShell from "../components/ChartPanelShell.tsx";
import DarkInsightCard from "../components/DarkInsightCard.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import TrendStatCard from "../components/TrendStatCard.tsx";
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

const MetricSchema = z.object({
  label: z.string().min(2).max(28),
  value: z.string().min(1).max(18),
  note: z.string().max(16).optional(),
});

const TrendCardSchema = z.object({
  subject: z.string().min(2).max(28),
  symbol: z.string().max(8).optional(),
  statusLabel: z.string().min(2).max(18),
  statusColor: z.string().min(3).max(64),
  statusBackground: z.string().min(3).max(64),
  accentColor: z.string().min(3).max(64),
  metrics: z.array(MetricSchema).min(2).max(2),
  narrative: z.string().min(12).max(170),
});

const ChartSeriesSchema = z.object({
  label: z.string().min(2).max(24),
  color: z.string().min(3).max(64),
  values: z.array(z.number().finite()).min(2).max(40),
});

const DEFAULT_TREND_CARDS: z.infer<typeof TrendCardSchema>[] = [
  {
    subject: "Entity A",
    symbol: "A",
    statusLabel: "High Beta",
    statusColor: chartAnalyticsTheme.colors.primary,
    statusBackground: "#EFF6FF",
    accentColor: chartAnalyticsTheme.colors.primary,
    metrics: [
      { label: "Peak Growth", value: "18.0%", note: "'70" },
      { label: "Recent Avg", value: "~5.0%" },
    ],
    narrative: "Use this card to explain high-volatility periods, policy or market shifts, and the current normalization path.",
  },
  {
    subject: "Entity B",
    symbol: "B",
    statusLabel: "Mature",
    statusColor: "#0D9488",
    statusBackground: "#F0FDFA",
    accentColor: chartAnalyticsTheme.colors.accentTeal,
    metrics: [
      { label: "Peak Growth", value: "12.5%", note: "'68" },
      { label: "Recent Avg", value: "~1.0%" },
    ],
    narrative: "Use this card to summarize the post-peak transition, structural maturity, and low-growth stabilization pattern.",
  },
];

export const Schema = z.object({
  eyebrow: z.string().min(2).max(44).default("Long-Run Trend Analysis"),
  title: z.string().min(4).max(72).default("Growth Trajectory Comparison"),
  headerMetaLabel: z.string().min(2).max(24).default("Data Source"),
  headerMetaValue: z.string().min(2).max(36).default("Public Dataset"),
  headerIcon: IconSchema.default("chart-line"),
  statCards: z.array(TrendCardSchema).min(2).max(2).default(DEFAULT_TREND_CARDS),
  insightLabel: z.string().min(2).max(28).default("Strategic Insight"),
  insightTitle: z.string().min(2).max(34).default("Converging Paths"),
  insightText: z
    .string()
    .min(12)
    .max(190)
    .default("Use this panel to state the central interpretation: what the two trajectories share, where they diverge, and why it matters."),
  insightIcon: IconSchema.default("scale"),
  chartTitle: z.string().min(2).max(52).default("Annual Growth Rate (%)"),
  chartSubtitle: z.string().min(4).max(110).default("Comparing historical volatility and stabilization across two entities"),
  chartLabels: z.array(z.string().min(1).max(12)).min(2).max(40).default(["1965", "1975", "1985", "1995", "2005", "2015", "2024"]),
  chartSeries: z.array(ChartSeriesSchema).min(1).max(3).default([
    { label: "Entity A", color: chartAnalyticsTheme.colors.primary, values: [17, 9, 13, 11, 10, 7, 5] },
    { label: "Entity B", color: chartAnalyticsTheme.colors.accentTeal, values: [6, 3, 5, 2, 2, 1.6, 0.9] },
  ]),
  minValue: z.number().default(-30),
  maxValue: z.number().default(25),
  ticks: z.array(z.number()).min(2).max(9).default([-30, -20, -10, 0, 10, 20]),
  tickSuffix: z.string().max(4).default("%"),
  showZeroLine: z.boolean().default(true),
  sourceNote: z.string().max(96).default("*Use the note for estimates, methodology, or last-observation caveats."),
  footerSource: z.string().min(4).max(120).default("Sources: public national accounts and economic outlook datasets"),
  confidentialityLabel: z.string().min(2).max(32).default("CONFIDENTIAL"),
  pageNumber: z.string().min(1).max(6).default("04"),
});

export const layoutId = "growth-trend-comparison";
export const layoutName = "Growth Trend Comparison";
export const layoutDescription =
  "A TSX-first trend-analysis page with a dark analytics header, left-side entity statistic cards, a dark strategic insight panel, and a long-horizon multi-series line chart.";
export const layoutTags = ["trend", "line-chart", "comparison", "economics", "analytics", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "trend-stat-cards", "strategic-insight", "line-chart", "source-footer"];
export const useCases = ["historical-trend", "growth-comparison", "volatility-analysis", "market-maturity"];
export const suitableFor =
  "Suitable for comparing two entities over time with one primary line chart and concise interpretation cards.";
export const avoidFor =
  "Avoid using this layout for single-period dashboards, categorical rankings, dense tables, or pages that need more than two entities or many narrative paragraphs.";
export const density = "high";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";


const GrowthTrendComparison = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
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

      <div className="grid h-[582px] grid-cols-[360px_minmax(0,1fr)] gap-[32px] px-[48px] py-[32px]">
        <div className="flex min-h-0 flex-col gap-[18px]">
          {parsed.statCards.map((card) => (
            <TrendStatCard key={card.subject} {...card} />
          ))}

          <DarkInsightCard
            label={parsed.insightLabel}
            title={parsed.insightTitle}
            text={parsed.insightText}
            icon={parsed.insightIcon}
            className="flex-1"
          />
        </div>

        <div className="min-h-0">
          <ChartPanelShell
            title={parsed.chartTitle}
            subtitle={parsed.chartSubtitle}
            legend={parsed.chartSeries.map((entry) => ({ label: entry.label, color: entry.color }))}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex flex-1 items-center justify-center">
                <AnalyticsLineChart
                  labels={parsed.chartLabels}
                  series={parsed.chartSeries as AnalyticsLineSeries[]}
                  minValue={parsed.minValue}
                  maxValue={parsed.maxValue}
                  ticks={parsed.ticks}
                  tickSuffix={parsed.tickSuffix}
                  showZeroLine={parsed.showZeroLine}
                  width={742}
                  height={378}
                />
              </div>
              <div className="flex-none pt-[8px] text-right text-[10px] leading-[1.2]" style={{ color: chartAnalyticsTheme.colors.mutedText }}>
                {parsed.sourceNote}
              </div>
            </div>
          </ChartPanelShell>
        </div>
      </div>

      <AnalyticsSourceFooter
        source={parsed.footerSource}
        confidentialityLabel={parsed.confidentialityLabel}
        pageNumber={parsed.pageNumber}
      />
    </AnalyticsCanvas>
  );
};

export default GrowthTrendComparison;
