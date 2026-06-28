import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import { BalancedComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import ChartContainer from "../components/ChartContainer.tsx";
import ComparativeMetricRow from "../components/ComparativeMetricRow.tsx";
import ComparisonRadarChart from "../components/ComparisonRadarChart.tsx";
import StrategicInsightCard from "../components/StrategicInsightCard.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";
import { redBlueComparisonTheme } from "../theme/tokens.ts";

const ToneSchema = z.enum(["red", "blue", "purple", "neutral"]);
const MetricIconSchema = z.enum(["certificate", "flask", "graduation-cap", "microchip", "rocket"]);
const InsightIconSchema = z.enum(["lightbulb", "microscope", "target"]);

const EntitySchema = z.object({
  label: z.string().min(2).max(24),
  tone: ToneSchema.default("red"),
  color: z.string().min(4).max(48).optional(),
});

const RadarSeriesSchema = z.object({
  label: z.string().min(2).max(24),
  tone: ToneSchema.default("red"),
  color: z.string().min(4).max(48).optional(),
  fillColor: z.string().min(4).max(64).optional(),
  values: z.array(z.number().min(0).max(100)).min(3).max(8),
});

const InsightSchema = z.object({
  title: z.string().min(2).max(34),
  text: z.string().min(12).max(220),
  icon: InsightIconSchema.default("microscope"),
  tone: ToneSchema.default("purple"),
});

const MetricValueSchema = z.object({
  value: z.string().min(1).max(16),
  sublabel: z.string().min(1).max(24),
  tone: ToneSchema.default("red"),
});

const MetricRowSchema = z.object({
  label: z.string().min(2).max(32),
  icon: MetricIconSchema,
  values: z.array(MetricValueSchema).min(2).max(2),
});

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(30).default("Technology &"),
  titleHighlight: z.string().min(2).max(34).default("Innovation"),
  subtitle: z
    .string()
    .min(8)
    .max(120)
    .default("Comparative assessment of R&D capabilities, output, and ecosystem maturity."),
  footerText: z.string().min(4).max(80).default("Red Blue Comparison | Technology & Innovation"),
  pageNumber: z.string().min(1).max(4).default("08"),
  chartTitle: z.string().min(2).max(46).default("Innovation Ecosystem Profile"),
  chartSubtitle: z.string().min(4).max(86).default("Normalized score comparison across innovation dimensions."),
  sourceNote: z
    .string()
    .min(4)
    .max(120)
    .default("*Scores normalized (0-100 scale) based on global indices."),
  entities: z
    .array(EntitySchema)
    .min(2)
    .max(2)
    .default([
      { label: "China", tone: "red" },
      { label: "Japan", tone: "blue" },
    ]),
  radarLabels: z
    .array(z.string().min(2).max(24))
    .min(3)
    .max(8)
    .default(["R&D % GDP", "Patent Volume", "High-Tech Exports", "Startup/VC", "Research Density", "AI Adoption"]),
  radarSeries: z.array(RadarSeriesSchema).min(2).max(2).default([
    {
      label: "China",
      tone: "red",
      fillColor: "rgba(255,71,87,0.18)",
      values: [75, 95, 98, 85, 40, 90],
    },
    {
      label: "Japan",
      tone: "blue",
      fillColor: "rgba(46,134,222,0.18)",
      values: [90, 80, 50, 40, 95, 70],
    },
  ]),
  minValue: z.number().min(0).max(99).default(0),
  maxValue: z.number().min(1).max(100).default(100),
  ticks: z.array(z.number().min(0).max(100)).min(2).max(6).default([20, 40, 60, 80, 100]),
  insight: InsightSchema.default({
    title: "Strategic Divergence",
    text:
      "China excels in scale, rapid commercialization, and digital ecosystem growth. Japan maintains strength in fundamental research, precision engineering, and robotics.",
    icon: "microscope",
    tone: "purple",
  }),
  metrics: z.array(MetricRowSchema).min(3).max(5).default([
    {
      label: "R&D Spending",
      icon: "flask",
      values: [
        { value: "2.6%", sublabel: "of GDP", tone: "red" },
        { value: "3.3%", sublabel: "of GDP", tone: "blue" },
      ],
    },
    {
      label: "Patents (Triadic)",
      icon: "certificate",
      values: [
        { value: "High", sublabel: "Volume", tone: "red" },
        { value: "High", sublabel: "Quality/Global", tone: "blue" },
      ],
    },
    {
      label: "High-Tech Exp.",
      icon: "microchip",
      values: [
        { value: "$942B", sublabel: "Dominant", tone: "red" },
        { value: "$120B", sublabel: "Specialized", tone: "blue" },
      ],
    },
    {
      label: "Researcher Density",
      icon: "graduation-cap",
      values: [
        { value: "1.6k", sublabel: "per million", tone: "red" },
        { value: "5.3k", sublabel: "per million", tone: "blue" },
      ],
    },
    {
      label: "Unicorn Startups",
      icon: "rocket",
      values: [
        { value: "300+", sublabel: "Vibrant Scene", tone: "red" },
        { value: "~12", sublabel: "Emerging", tone: "blue" },
      ],
    },
  ]),
  showDecorations: z.boolean().default(true),
});

export const layoutId = "technology-innovation-kpis";
export const layoutName = "Technology Innovation KPIs";
export const layoutDescription =
  "A TSX-first comparison page with one radar ecosystem profile, a strategic insight card, and compact two-entity KPI rows.";
export const layoutTags = ["technology", "innovation", "kpi", "radar-chart", "comparison", "red-blue", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "subtitle", "radar-chart", "entity-legend", "insight-card", "metric-rows", "source-note"];
export const useCases = ["innovation benchmark", "capability comparison", "technology ecosystem", "two-entity KPI analysis"];
export const suitableFor =
  "Suitable for comparing two entities across multiple capability dimensions with a radar profile and supporting KPI evidence.";
export const avoidFor =
  "Avoid using this layout for time-series trends, more than two primary entities, detailed tables, or single-metric narratives.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const TechnologyInnovationKpis = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const legend = parsed.entities.map((entity, index) => {
    const series = parsed.radarSeries[index];
    return {
      label: entity.label,
      color: entity.color ?? series?.color,
      tone: entity.tone,
    };
  });

  return (
    <ThemeContentFrame
      titlePrefix={parsed.titlePrefix}
      titleHighlight={parsed.titleHighlight}
      subtitle={parsed.subtitle}
      tone="purple"
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      showHeaderDivider={false}
      contentTop={148}
      contentHeight={520}
    >
      {parsed.showDecorations ? <BalancedComparisonDecorations /> : null}
      <div className="relative z-10 grid h-full min-h-0 grid-cols-[1.22fr_0.88fr] gap-[34px]">
        <ChartContainer
          title={parsed.chartTitle}
          subtitle={parsed.chartSubtitle}
          tone="purple"
          padding={20}
          exportMode="screenshot"
          meta={
            <div className="flex items-center gap-[12px]">
              {legend.map((item) => {
                const color = item.color ?? (item.tone === "red"
                  ? "var(--china-red,#FF4757)"
                  : "var(--japan-blue,#2E86DE)");
                return (
                  <div key={item.label} className="flex items-center gap-[6px] text-[11px] font-black uppercase">
                    <span className="h-[10px] w-[10px] rounded-[3px]" style={{ backgroundColor: color }} />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          }
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1">
              <ComparisonRadarChart
                labels={parsed.radarLabels}
                series={parsed.radarSeries}
                minValue={parsed.minValue}
                maxValue={parsed.maxValue}
                ticks={parsed.ticks}
                width={620}
                height={386}
              />
            </div>
            <div
              className="h-[26px] flex-none overflow-hidden text-center text-[11px] font-medium leading-[26px]"
              style={{ color: redBlueComparisonTheme.colors.subtleText }}
            >
              {parsed.sourceNote}
            </div>
          </div>
        </ChartContainer>

        <div className="flex h-full min-h-0 flex-col gap-[16px]">
          <StrategicInsightCard
            title={parsed.insight.title}
            text={parsed.insight.text}
            icon={parsed.insight.icon}
            tone={parsed.insight.tone}
            height={152}
          />
          <div className="flex min-h-0 flex-1 flex-col justify-between">
            {parsed.metrics.map((metric) => (
              <ComparativeMetricRow
                key={metric.label}
                label={metric.label}
                icon={metric.icon}
                values={metric.values}
                height={62}
              />
            ))}
          </div>
        </div>
      </div>
    </ThemeContentFrame>
  );
};

export default TechnologyInnovationKpis;
