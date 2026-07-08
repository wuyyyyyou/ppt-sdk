import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import AnalyticsGroupedBarChart, { type AnalyticsBarSeries } from "../components/AnalyticsGroupedBarChart.tsx";
import { AnalyticsIcon } from "../components/AnalyticsIcons.tsx";
import ChartPanelShell from "../components/ChartPanelShell.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import MetricHighlightCard from "../components/MetricHighlightCard.tsx";
import OutlookPanel from "../components/OutlookPanel.tsx";
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

const ProgressItemSchema = z.object({
  label: z.string().min(2).max(32),
  valueLabel: z.string().min(1).max(18),
  value: z.number().min(0).max(100),
  color: z.string().min(3).max(64).optional(),
});

const ValueTileSchema = z.object({
  label: z.string().min(2).max(18),
  value: z.string().min(1).max(18),
  note: z.string().min(2).max(32),
  tint: z.string().min(3).max(64).optional(),
  labelColor: z.string().min(3).max(64).optional(),
});

const StatusItemSchema = z.object({
  title: z.string().min(2).max(28),
  description: z.string().min(2).max(42),
  badge: z.string().min(2).max(16),
  badgeColor: z.string().min(3).max(64).optional(),
  badgeBackground: z.string().min(3).max(64).optional(),
});

const MetricCardSchema = z.object({
  accentColor: z.string().min(3).max(64).optional(),
  icon: IconSchema.default("chart-column"),
  label: z.string().min(2).max(32),
  value: z.string().min(1).max(18),
  qualifier: z.string().min(2).max(28),
  progressItems: z.array(ProgressItemSchema).max(3).default([]),
  valueTiles: z.array(ValueTileSchema).max(2).default([]),
  statusItems: z.array(StatusItemSchema).max(3).default([]),
});

const ChartSeriesSchema = z.object({
  label: z.string().min(2).max(24),
  color: z.string().min(3).max(64).optional(),
  values: z.array(z.number().finite()).min(2).max(6),
});

const ChartInsightSchema = z.object({
  icon: IconSchema.default("bolt"),
  title: z.string().min(2).max(24),
  description: z.string().min(8).max(120),
  color: z.string().min(3).max(64).optional(),
  tint: z.string().min(3).max(64).optional(),
});

const TimelineItemSchema = z.object({
  period: z.string().min(2).max(18),
  text: z.string().min(8).max(96),
  color: z.string().min(3).max(64).optional(),
});

const DEFAULT_METRIC_CARDS: z.infer<typeof MetricCardSchema>[] = [
  {
    icon: "scale",
    label: "Economic Scale Gap",
    value: "4.6x",
    qualifier: "China Larger",
    progressItems: [
      { label: "China ($20.65T)", valueLabel: "82%", value: 82 },
      { label: "Japan ($4.46T)", valueLabel: "18%", value: 18 },
    ],
    valueTiles: [],
    statusItems: [],
  },
  {
    icon: "wallet",
    label: "Per Capita Income",
    value: "2.5x",
    qualifier: "Japan Lead",
    progressItems: [],
    valueTiles: [
      { label: "Japan", value: "$34K", note: "High income" },
      { label: "China", value: "$14K", note: "Upper middle" },
    ],
    statusItems: [],
  },
  {
    icon: "users",
    label: "Aging Crisis",
    value: "65+",
    qualifier: "Key Challenge",
    progressItems: [],
    valueTiles: [],
    statusItems: [
      {
        title: "Japan Status",
        description: "Super-aged society",
        badge: "Critical",
      },
      {
        title: "China Trend",
        description: "Births < 8M (2025)",
        badge: "Declining",
      },
    ],
  },
];

export const Schema = z.object({
  eyebrow: z.string().min(2).max(36).default("Strategic Overview"),
  title: z.string().min(4).max(72).default("Executive Summary: China vs Japan"),
  headerMetaLabel: z.string().min(2).max(24).default("Comparison"),
  headerMetaValue: z.string().min(2).max(32).default("2026 Forecast"),
  headerIcon: IconSchema.default("chart-pie"),
  metricCards: z.array(MetricCardSchema).min(3).max(3).default(DEFAULT_METRIC_CARDS),
  chartTitle: z.string().min(2).max(48).default("Technology & Innovation Landscape"),
  chartSubtitle: z.string().min(4).max(96).default("Comparison of adoption rates and strategic focus areas"),
  chartLabels: z.array(z.string().min(1).max(18)).min(2).max(6).default(["AI Usage", "Mobile Payment", "5G Adoption", "R&D % GDP"]),
  chartSeries: z.array(ChartSeriesSchema).min(1).max(3).default([
    { label: "China", values: [81, 92, 75, 2.4] },
    { label: "Japan", values: [26.7, 45, 50, 3.3] },
  ]),
  minValue: z.number().default(0),
  maxValue: z.number().default(100),
  ticks: z.array(z.number()).min(2).max(8).default([0, 25, 50, 75, 100]),
  tickSuffix: z.string().max(4).default(""),
  chartInsights: z.array(ChartInsightSchema).min(1).max(3).default([
    {
      icon: "bolt",
      title: "China Speed",
      description: "Rapid deployment model drives broad AI adoption and faster commercial rollout.",
    },
    {
      icon: "shield",
      title: "Japan Trust",
      description: "Reliability, safety standards, and social consensus shape the adoption pace.",
    },
  ]),
  outlookTitle: z.string().min(2).max(28).default("Future Outlook"),
  outlookIcon: IconSchema.default("binoculars"),
  outlookItems: z.array(TimelineItemSchema).min(2).max(4).default([
    {
      period: "2026-2028",
      text: "China growth normalization vs Japan structural reforms.",
    },
    {
      period: "2028-2030",
      text: "AI impact on productivity to offset labor shrinkage.",
    },
  ]),
  progressLabel: z.string().min(2).max(32).default("Trade Interdependence"),
  progressValueLabel: z.string().min(2).max(18).default("High"),
  progressValue: z.number().min(0).max(100).default(85),
  progressColor: z.string().min(3).max(64).optional(),
});

export const layoutId = "executive-summary-dashboard";
export const layoutName = "Executive Summary Dashboard";
export const layoutDescription =
  "A TSX-first executive dashboard with three KPI cards, a grouped bar chart, short interpretation points, and a dark future outlook panel.";
export const layoutTags = ["executive-summary", "dashboard", "kpi", "grouped-bar-chart", "comparison", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "kpi-cards", "grouped-bar-chart", "insight-list", "future-outlook"];
export const useCases = ["executive-summary", "market-comparison", "strategy-overview", "technology-benchmark"];
export const suitableFor =
  "Suitable for high-level analytical summaries that compare two entities across scale, income, demographic, technology, or strategy metrics.";
export const avoidFor =
  "Avoid using this layout for a single deep chart, long prose, agenda pages, or pages requiring more than three headline metrics.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";


const ExecutiveSummaryDashboard = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
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
      <div className="h-[4px] w-full" style={{ backgroundColor: chartAnalyticsTheme.colors.signalPrimary }} />

      <div className="grid h-[616px] w-full grid-cols-3 grid-rows-[206px_minmax(0,1fr)] gap-[24px] px-[48px] pb-[32px] pt-[24px]">
        {parsed.metricCards.map((card) => (
          <MetricHighlightCard key={card.label} {...card} />
        ))}

        <div className="col-span-2 min-h-0">
          <ChartPanelShell
            title={parsed.chartTitle}
            subtitle={parsed.chartSubtitle}
            legend={parsed.chartSeries.map((entry) => ({ label: entry.label, color: entry.color }))}
          >
            <div className="flex h-full min-h-0 gap-[24px]">
              <div className="flex h-full w-[470px] flex-none items-center">
                <AnalyticsGroupedBarChart
                  labels={parsed.chartLabels}
                  series={parsed.chartSeries as AnalyticsBarSeries[]}
                  minValue={parsed.minValue}
                  maxValue={parsed.maxValue}
                  ticks={parsed.ticks}
                  tickSuffix={parsed.tickSuffix}
                  width={470}
                  height={248}
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center gap-[18px] border-l pl-[22px]" style={{ borderColor: chartAnalyticsTheme.colors.strokeSoft }}>
                {parsed.chartInsights.map((item, index) => {
                  const tone = index === 0 ? chartAnalyticsTheme.tone.signalPrimary : chartAnalyticsTheme.tone.signalNeutral;
                  const itemColor = item.color ?? tone.color;
                  const itemTint = item.tint ?? tone.tint;

                  return (
                  <div key={item.title}>
                    <div className="mb-[6px] flex items-center gap-[11px]">
                      <div className="flex h-[32px] w-[32px] flex-none items-center justify-center rounded-full" style={{ backgroundColor: itemTint }}>
                        <AnalyticsIcon name={item.icon} className="h-[16px] w-[16px]" stroke={itemColor} />
                      </div>
                      <div className="truncate text-[14px] font-bold" style={{ color: chartAnalyticsTheme.colors.textPrimary }}>
                        {item.title}
                      </div>
                    </div>
                    <div className="pl-[43px] text-[12px] leading-[1.35]" style={{ color: chartAnalyticsTheme.colors.textSubtle }}>
                      {item.description}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </ChartPanelShell>
        </div>

        <div className="min-h-0">
          <OutlookPanel
            title={parsed.outlookTitle}
            icon={parsed.outlookIcon}
            timelineItems={parsed.outlookItems}
            progressLabel={parsed.progressLabel}
            progressValueLabel={parsed.progressValueLabel}
            progressValue={parsed.progressValue}
            progressColor={parsed.progressColor}
          />
        </div>
      </div>
    </AnalyticsCanvas>
  );
};

export default ExecutiveSummaryDashboard;
