import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import FinanceContentFrame from "../components/FinanceContentFrame.tsx";
import FinanceSectionHeading from "../components/FinanceSectionHeading.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import DualValueMetricCard from "../components/DualValueMetricCard.tsx";
import InsightCallout from "../components/InsightCallout.tsx";
import KpiMetricItem from "../components/KpiMetricItem.tsx";
import ProgressStatusCard from "../components/ProgressStatusCard.tsx";
import { redFinanceTheme } from "../theme/tokens.ts";

const StatusIconSchema = z.enum(["chart-column", "route", "shield", "wallet"]);

const MetricSchema = z.object({
  value: z.string().min(1).max(24),
  label: z.string().min(2).max(24),
});

const StatusCardSchema = z.object({
  title: z.string().min(2).max(24),
  progress: z.number().min(0).max(100),
  status: z.string().min(2).max(48),
  icon: StatusIconSchema.default("chart-column"),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("KPI Summary"),
  metaLabel: z.string().min(2).max(48).default("BLUEPRINT / KPI"),
  footerText: z.string().min(6).max(80).default("Business Professional | KPI Summary"),
  pageNumber: z.string().min(1).max(4).default("08"),
  variant: z.enum(["hero-kpi-grid", "compact-metric-board"]).default("hero-kpi-grid"),
  density: z.enum(["medium", "high"]).default("medium"),
  heading: z.string().min(2).max(32).default("Key metrics"),
  subtitle: z.string().min(8).max(96).default("For operating metrics, target breakdowns, reviews, and status snapshots."),
  headlineTitle: z.string().min(2).max(36).default("Core performance"),
  leftLabel: z.string().min(2).max(18).default("Current"),
  rightLabel: z.string().min(2).max(18).default("Target"),
  leftValue: z.string().min(1).max(24).default("84"),
  rightValue: z.string().min(1).max(24).default("90"),
  leftShare: z.number().min(0).max(100).default(84),
  rightShare: z.number().min(0).max(100).default(90),
  metrics: z.array(MetricSchema).min(3).max(8).default([
    { value: "84%", label: "Completion" },
    { value: "12", label: "Open items" },
    { value: "3", label: "Critical risks" },
    { value: "7", label: "Weeks left" },
  ]),
  statusCards: z.array(StatusCardSchema).min(2).max(4).default([
    {
      title: "Execution progress",
      progress: 84,
      status: "On track against current plan",
      icon: "route",
    },
    {
      title: "Risk coverage",
      progress: 72,
      status: "Critical risks under review",
      icon: "shield",
    },
    {
      title: "Target readiness",
      progress: 90,
      status: "Close to target threshold",
      icon: "wallet",
    },
  ]),
  insights: z.array(z.string().min(8).max(120)).min(1).max(3).default([
    "Numbers are the anchor; commentary should explain drivers and next actions.",
  ]),
});

export const layoutId = "kpi-summary";
export const layoutName = "KPI Summary";
export const layoutDescription =
  "A tsx-first summary slide for metrics, targets, and performance snapshots.";
export const layoutTags = ["kpi", "summary", "performance", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["headline-metric", "metric-grid", "insight"];
export const useCases = ["metrics", "performance", "target-breakdown", "result-review"];
export const suitableFor = "Suitable for metric-heavy pages that need a concise summary and a few supporting indicators.";
export const avoidFor = "Avoid using this layout for narrative-heavy pages or complex comparisons.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const KpiSummary = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const metricDensity = parsed.density === "high" ? "compact" : "normal";
  const gridClass = parsed.variant === "compact-metric-board" ? "grid-cols-4" : "grid-cols-2";
  const isHeroKpiGrid = parsed.variant === "hero-kpi-grid";

  return (
    <FinanceContentFrame
      title={parsed.title}
      metaIcon={<FinanceIcon name="chart-column" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={156}
      contentBottomInset={12}
    >
      <div className="flex h-full min-h-0 flex-col gap-[14px]">
        <FinanceSectionHeading title={parsed.heading} subtitle={parsed.subtitle} marginBottom={0} />
        <div className={isHeroKpiGrid ? "grid flex-none grid-cols-[1.05fr_0.95fr] gap-[18px]" : "flex flex-none flex-col gap-[18px]"}>
          <DualValueMetricCard
            title={parsed.headlineTitle}
            icon={<FinanceIcon name="wallet" className="h-[18px] w-[18px]" />}
            leftLabel={parsed.leftLabel}
            rightLabel={parsed.rightLabel}
            leftValue={parsed.leftValue}
            rightValue={parsed.rightValue}
            leftShare={parsed.leftShare}
            rightShare={parsed.rightShare}
            density="normal"
            progressMode="split"
          />
          <div className={`grid ${gridClass} gap-[10px]`}>
            {parsed.metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[8px] border px-[14px] py-[12px]"
                style={{
                  backgroundColor: redFinanceTheme.colors.panel,
                  borderColor: redFinanceTheme.colors.stroke,
                }}
              >
                <KpiMetricItem value={metric.value} label={metric.label} />
              </div>
            ))}
          </div>
        </div>
        <div
          className="grid min-h-0 flex-1 gap-[12px]"
          style={{
            gridTemplateColumns: `repeat(${parsed.statusCards.length}, minmax(0, 1fr))`,
          }}
        >
          {parsed.statusCards.map((card, index) => (
            <ProgressStatusCard
              key={`${card.title}-${index}`}
              title={card.title}
              marker={<FinanceIcon name={card.icon} className="h-[18px] w-[18px]" />}
              progress={card.progress}
              status={card.status}
              className="h-full justify-center"
              minHeight={0}
              progressColor={index === 1 ? redFinanceTheme.colors.chart4 : redFinanceTheme.colors.accent}
            />
          ))}
        </div>
        <div className="grid flex-none gap-[10px]">
          {parsed.insights.map((insight, index) => (
            <InsightCallout key={`${insight}-${index}`} text={insight} density={metricDensity} />
          ))}
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default KpiSummary;
