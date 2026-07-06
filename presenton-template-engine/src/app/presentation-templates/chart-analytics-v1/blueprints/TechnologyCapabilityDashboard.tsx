import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AdvantageBarList from "../components/AdvantageBarList.tsx";
import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import AnalyticsSourceFooter from "../components/AnalyticsSourceFooter.tsx";
import CircularComparisonMetricCard from "../components/CircularComparisonMetricCard.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import StrategicInsightPanel from "../components/StrategicInsightPanel.tsx";
import { chartAnalyticsTheme } from "../theme/tokens.ts";

const IconSchema = z.enum([
  "binoculars",
  "bolt",
  "broadcast",
  "chart-column",
  "chart-line",
  "chart-pie",
  "file-signature",
  "flask",
  "gauge",
  "grid",
  "robot",
  "scale",
  "shield",
  "users",
  "wallet",
]);

const RingEntitySchema = z.object({
  label: z.string().min(1).max(10),
  valueLabel: z.string().min(1).max(12),
  progress: z.number().min(0).max(100),
  color: z.string().min(3).max(64).optional(),
  emphasized: z.boolean().default(false),
});

const RingMetricSchema = z.object({
  category: z.string().min(2).max(32),
  title: z.string().min(2).max(40),
  accentColor: z.string().min(3).max(64).optional(),
  icon: IconSchema.default("chart-column"),
  entities: z.array(RingEntitySchema).min(2).max(2),
  footerLabel: z.string().min(2).max(18),
  footerValue: z.string().min(1).max(18),
});

const AdvantageItemSchema = z.object({
  label: z.string().min(2).max(42),
  valueLabel: z.string().min(2).max(52),
  leftValue: z.number().min(0).max(100),
  rightValue: z.number().min(0).max(100),
});

const InsightItemSchema = z.object({
  label: z.string().min(1).max(18),
  text: z.string().min(8).max(180),
  color: z.string().min(3).max(64).optional(),
});

const DEFAULT_RING_METRICS: z.infer<typeof RingMetricSchema>[] = [
  {
    category: "Capability A",
    title: "Adoption Rate",
    icon: "robot",
    entities: [
      { label: "A", valueLabel: "72%", progress: 72, emphasized: true },
      { label: "B", valueLabel: "48%", progress: 48, emphasized: false },
    ],
    footerLabel: "Gap",
    footerValue: "+24 pts",
  },
  {
    category: "Investment",
    title: "R&D Intensity",
    icon: "flask",
    entities: [
      { label: "B", valueLabel: "64%", progress: 64, emphasized: true },
      { label: "A", valueLabel: "52%", progress: 52, emphasized: false },
    ],
    footerLabel: "Lead",
    footerValue: "Entity B",
  },
  {
    category: "Infrastructure",
    title: "Network Scale",
    icon: "broadcast",
    entities: [
      { label: "A", valueLabel: "88", progress: 88, emphasized: true },
      { label: "B", valueLabel: "34", progress: 34, emphasized: false },
    ],
    footerLabel: "Scale",
    footerValue: "2.6x",
  },
  {
    category: "Output",
    title: "Patent Volume",
    icon: "file-signature",
    entities: [
      { label: "A", valueLabel: "69k", progress: 74, emphasized: true },
      { label: "B", valueLabel: "48k", progress: 56, emphasized: false },
    ],
    footerLabel: "Volume",
    footerValue: "A Lead",
  },
];

const DEFAULT_ADVANTAGE_ITEMS: z.infer<typeof AdvantageItemSchema>[] = [
  { label: "Platform Scale", valueLabel: "Entity A 60% vs Entity B 10%", leftValue: 60, rightValue: 10 },
  { label: "Precision Systems", valueLabel: "Entity B 45% vs Entity A 20%", leftValue: 20, rightValue: 45 },
  { label: "Critical Materials", valueLabel: "Entity B 55% dominant", leftValue: 15, rightValue: 55 },
  { label: "Digital Penetration", valueLabel: "Entity A 52% vs Entity B 13%", leftValue: 52, rightValue: 13 },
];

export const Schema = z.object({
  eyebrow: z.string().min(2).max(36).default("Innovation Dashboard"),
  title: z.string().min(4).max(76).default("Technology Capabilities: Entity A vs Entity B"),
  headerMetaLabel: z.string().min(2).max(24).default("Strategic Focus"),
  headerMetaValue: z.string().min(2).max(40).default("AI, R&D, Infrastructure"),
  headerIcon: IconSchema.default("gauge"),
  ringMetrics: z.array(RingMetricSchema).min(4).max(4).default(DEFAULT_RING_METRICS),
  advantageTitle: z.string().min(2).max(52).default("Sector Dominance Analysis"),
  advantageLeftLabel: z.string().min(2).max(24).default("Entity A Advantage"),
  advantageLeftColor: z.string().min(3).max(64).optional(),
  advantageRightLabel: z.string().min(2).max(24).default("Entity B Advantage"),
  advantageRightColor: z.string().min(3).max(64).optional(),
  advantageItems: z.array(AdvantageItemSchema).min(3).max(5).default(DEFAULT_ADVANTAGE_ITEMS),
  insightEyebrow: z.string().min(2).max(32).default("Strategic Divergence"),
  insightHeadline: z.string().min(2).max(44).default("Speed vs. Precision"),
  insightIcon: IconSchema.default("grid"),
  insightItems: z.array(InsightItemSchema).min(2).max(3).default([
    {
      label: "Entity A",
      text: "Deploy-first operating model scales digital capabilities quickly and iterates through broad user feedback loops.",
    },
    {
      label: "Entity B",
      text: "Quality-first engineering concentrates advantage in precision components, standards, and upstream supply-chain roles.",
    },
  ]),
  statLabel: z.string().min(2).max(28).default("Startup Momentum"),
  statValue: z.string().min(1).max(24).default("300+ vs 10+"),
  statBadge: z.string().min(2).max(16).default("A Lead"),
  statBadgeColor: z.string().min(3).max(64).optional(),
  statBadgeBackground: z.string().min(3).max(64).optional(),
  sourceNote: z.string().min(2).max(140).default("Sources: public reports and company filings"),
  slideLabel: z.string().min(2).max(18).default("SLIDE 08"),
});

export const layoutId = "technology-capability-dashboard";
export const layoutName = "Technology Capability Dashboard";
export const layoutDescription =
  "A TSX-first technology capability dashboard with four paired circular metric cards, sector advantage bars, and a dark strategic divergence panel.";
export const layoutTags = ["technology", "dashboard", "circular-metrics", "comparison", "advantage-bars", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "circular-metric-cards", "sector-advantage-bars", "strategic-insight-panel", "source-footer"];
export const useCases = ["technology-benchmark", "innovation-dashboard", "country-comparison", "sector-dominance-analysis", "capability-assessment"];
export const suitableFor =
  "Suitable for comparing two entities across several technology capability indicators, then summarizing sector-level advantage and strategic posture.";
export const avoidFor =
  "Avoid using this layout for single-metric deep dives, time-series trends, more than two compared entities, or pages requiring long prose explanations.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";


const TechnologyCapabilityDashboard = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
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

      <div className="flex h-[620px] flex-col gap-[20px] px-[48px] py-[24px]" style={{ backgroundColor: chartAnalyticsTheme.colors.surface }}>
        <div className="grid h-[214px] grid-cols-4 gap-[24px]">
          {parsed.ringMetrics.map((metric) => (
            <CircularComparisonMetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <div className="flex min-h-0 flex-1 gap-[24px]">
          <div className="min-w-0 flex-[2]">
            <AdvantageBarList
              title={parsed.advantageTitle}
              leftLabel={parsed.advantageLeftLabel}
              leftColor={parsed.advantageLeftColor}
              rightLabel={parsed.advantageRightLabel}
              rightColor={parsed.advantageRightColor}
              items={parsed.advantageItems}
            />
          </div>

          <div className="min-w-0 flex-1">
            <StrategicInsightPanel
              eyebrow={parsed.insightEyebrow}
              headline={parsed.insightHeadline}
              icon={parsed.insightIcon}
              items={parsed.insightItems}
              statLabel={parsed.statLabel}
              statValue={parsed.statValue}
              statBadge={parsed.statBadge}
              statBadgeColor={parsed.statBadgeColor}
              statBadgeBackground={parsed.statBadgeBackground}
            />
          </div>
        </div>

        <AnalyticsSourceFooter source={parsed.sourceNote} slideLabel={parsed.slideLabel} height={18} padded={false} backgroundColor="transparent" />
      </div>
    </AnalyticsCanvas>
  );
};

export default TechnologyCapabilityDashboard;
