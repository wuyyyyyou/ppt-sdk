import React from "react";
import * as z from "zod";

import RedBlueChartShell from "../components/RedBlueChartShell.tsx";
import RedBlueContentFrame from "../components/RedBlueContentFrame.tsx";
import RedBlueMetricCard from "../components/RedBlueMetricCard.tsx";
import RedBlueNumberCallout from "../components/RedBlueNumberCallout.tsx";
import { redBlueTheme } from "../theme/tokens.ts";

const ToneSchema = z.enum(["china", "japan", "korea", "purple", "neutral"]);

const SeriesSchema = z.object({
  label: z.string().min(1).max(24),
  value: z.number().min(0).max(100),
  tone: ToneSchema.default("purple"),
});

const MetricRowSchema = z.object({
  label: z.string().min(1).max(24),
  value: z.string().min(1).max(24),
  share: z.number().min(0).max(100).optional(),
  tone: ToneSchema.default("neutral"),
});

export const Schema = z.object({
  title: z.string().min(2).max(52).default("Performance Signal"),
  subtitle: z.string().min(2).max(96).default("Combine a simple evidence chart with KPI rows and a headline number."),
  footerText: z.string().min(2).max(80).default("Red Blue Professional"),
  pageNumber: z.string().min(1).max(4).default("04"),
  chartTitle: z.string().min(2).max(48).default("Indexed Comparison"),
  chartSubtitle: z.string().min(2).max(96).default("Values are displayed as relative index scores for slide-level comparison."),
  series: z.array(SeriesSchema).min(2).max(6).default([
    { label: "China", value: 84, tone: "china" },
    { label: "Japan", value: 68, tone: "japan" },
    { label: "Korea", value: 72, tone: "korea" },
  ]),
  metricTitle: z.string().min(2).max(36).default("KPI Readout"),
  metrics: z.array(MetricRowSchema).min(2).max(4).default([
    { label: "China", value: "84%", share: 84, tone: "china" },
    { label: "Japan", value: "68%", share: 68, tone: "japan" },
    { label: "Korea", value: "72%", share: 72, tone: "korea" },
  ]),
  calloutValue: z.string().min(1).max(16).default("84%"),
  calloutLabel: z.string().min(2).max(32).default("Lead signal"),
  calloutDescription: z.string().min(4).max(96).default("Use the callout to focus attention on the most important measured result."),
});

export const layoutId = "chart-metric-brief";
export const layoutName = "Chart Metric Brief";
export const layoutDescription = "Large chart plus KPI card and number callout for evidence-heavy red-blue pages.";
export const layoutTags = ["chart", "metrics", "number-callout", "red-blue"];
export const layoutRole = "content";
export const contentElements = ["heading", "chart", "metrics", "number-callout"];
export const useCases = ["market-research", "performance-analysis", "comparison"];
export const suitableFor = "Suitable when one chart is the primary evidence and side cards explain the signal.";
export const avoidFor = "Avoid for pure narrative or agenda pages.";
export const density = "high";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "medium";

const toneColor = (tone: z.infer<typeof ToneSchema>) => {
  if (tone === "china") return redBlueTheme.colors.china;
  if (tone === "japan") return redBlueTheme.colors.japan;
  if (tone === "korea") return redBlueTheme.colors.korea;
  if (tone === "purple") return redBlueTheme.colors.purple;
  return redBlueTheme.colors.neutral;
};

const ChartMetricBrief = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const maxValue = Math.max(100, ...parsed.series.map((item) => item.value));

  return (
    <RedBlueContentFrame title={parsed.title} subtitle={parsed.subtitle} footerText={parsed.footerText} pageNumber={parsed.pageNumber}>
      <div className="grid h-full grid-cols-[1.42fr_0.78fr] gap-[22px]">
        <RedBlueChartShell
          title={parsed.chartTitle}
          subtitle={parsed.chartSubtitle}
          legend={parsed.series.map((item) => ({ label: item.label, color: toneColor(item.tone) }))}
        >
          <div className="absolute inset-0 rounded-[14px]" style={{ backgroundColor: "#F8FAFC" }}>
            <div className="absolute bottom-[48px] left-[48px] right-[48px] h-[2px]" style={{ backgroundColor: redBlueTheme.colors.stroke }} />
            <div className="absolute bottom-[48px] left-[66px] right-[66px] flex h-[270px] items-end justify-around">
              {parsed.series.map((item) => (
                <div key={item.label} className="flex w-[76px] flex-col items-center gap-[12px]">
                  <div className="w-[48px] rounded-t-[12px]" style={{ height: `${Math.max(26, (item.value / maxValue) * 250)}px`, backgroundColor: toneColor(item.tone) }} />
                  <div className="text-center text-[13px] font-black" style={{ color: redBlueTheme.colors.mutedText }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </RedBlueChartShell>
        <div className="flex flex-col gap-[18px]">
          <RedBlueMetricCard title={parsed.metricTitle} rows={parsed.metrics} accentTone="purple" />
          <div className="flex-1">
            <RedBlueNumberCallout value={parsed.calloutValue} label={parsed.calloutLabel} description={parsed.calloutDescription} tone="purple" />
          </div>
        </div>
      </div>
    </RedBlueContentFrame>
  );
};

export default ChartMetricBrief;
