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
  value: z.number().min(0),
  tone: ToneSchema.default("purple"),
});

const MetricRowSchema = z.object({
  label: z.string().min(1).max(24),
  value: z.string().min(1).max(24),
  share: z.number().min(0).max(100).optional(),
  tone: ToneSchema.default("neutral"),
});

const CalloutSchema = z.object({
  value: z.string().min(1).max(18),
  label: z.string().min(2).max(36),
  description: z.string().min(4).max(96).optional(),
  tone: ToneSchema.default("purple"),
});

export const Schema = z.object({
  title: z.string().min(2).max(52).default("Performance Signal"),
  subtitle: z.string().min(2).max(96).default("Combine a simple evidence chart with KPI rows and a headline number."),
  footerText: z.string().min(2).max(80).default("Red Blue Professional"),
  pageNumber: z.string().min(1).max(4).default("04"),
  chartTitle: z.string().min(2).max(48).default("Indexed Comparison"),
  chartSubtitle: z.string().min(2).max(96).default("Values are displayed as relative index scores for slide-level comparison."),
  chartUnit: z.string().max(24).optional(),
  maxValue: z.number().min(0).optional(),
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
  callouts: z.array(CalloutSchema).min(1).max(2).default([
    {
      value: "84%",
      label: "China lead signal",
      description: "Use this card for the primary measured position.",
      tone: "china",
    },
    {
      value: "68%",
      label: "Japan benchmark",
      description: "Use this card for the comparison benchmark.",
      tone: "japan",
    },
  ]),
  calloutValue: z.string().min(1).max(18).default("84%"),
  calloutLabel: z.string().min(2).max(36).default("Lead signal"),
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

export const sampleData = {
  title: "Performance Signal",
  subtitle: "Combine one evidence chart with KPI rows and headline results for fast reading.",
  footerText: "Red Blue Professional | Chart Metric Brief",
  pageNumber: "04",
  chartTitle: "Indexed Market Position",
  chartSubtitle: "Relative index scores for slide-level comparison; replace with validated source data.",
  chartUnit: "Index score",
  maxValue: 100,
  series: [
    { label: "China", value: 84, tone: "china" },
    { label: "Japan", value: 68, tone: "japan" },
    { label: "Korea", value: 72, tone: "korea" },
  ],
  metricTitle: "KPI Readout",
  metrics: [
    { label: "China", value: "84%", share: 84, tone: "china" },
    { label: "Japan", value: "68%", share: 68, tone: "japan" },
    { label: "Korea", value: "72%", share: 72, tone: "korea" },
  ],
  callouts: [
    {
      value: "84%",
      label: "China lead signal",
      description: "Use this card for the primary measured position.",
      tone: "china",
    },
    {
      value: "68%",
      label: "Japan benchmark",
      description: "Use this card for the comparison benchmark.",
      tone: "japan",
    },
  ],
  calloutValue: "84%",
  calloutLabel: "China lead signal",
  calloutDescription: "Use this card for the primary measured position.",
} satisfies z.infer<typeof Schema>;

const toneColor = (tone: z.infer<typeof ToneSchema>) => {
  if (tone === "china") return redBlueTheme.colors.china;
  if (tone === "japan") return redBlueTheme.colors.japan;
  if (tone === "korea") return redBlueTheme.colors.korea;
  if (tone === "purple") return redBlueTheme.colors.purple;
  return redBlueTheme.colors.neutral;
};

const ChartMetricBrief = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const maxSeriesValue = Math.max(...parsed.series.map((item) => item.value), 1);
  const maxValue = parsed.maxValue && parsed.maxValue > 0
    ? parsed.maxValue
    : Math.ceil((maxSeriesValue * 1.12) / 5) * 5;
  const callouts = parsed.callouts?.length
    ? parsed.callouts
    : [{
        value: parsed.calloutValue,
        label: parsed.calloutLabel,
        description: parsed.calloutDescription,
        tone: "purple" as const,
      }];
  const calloutDensity = callouts.length > 1 ? "compact" : "normal";
  const plot = {
    left: 82,
    right: 34,
    bottom: 58,
    height: 250,
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const formatTick = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);

  return (
    <RedBlueContentFrame title={parsed.title} subtitle={parsed.subtitle} footerText={parsed.footerText} pageNumber={parsed.pageNumber}>
      <div className="grid h-full grid-cols-[1.42fr_0.78fr] gap-[22px]">
        <RedBlueChartShell
          title={parsed.chartTitle}
          subtitle={parsed.chartSubtitle}
          legend={parsed.series.map((item) => ({ label: item.label, color: toneColor(item.tone) }))}
        >
          <div className="absolute inset-0 rounded-[14px]" style={{ backgroundColor: "#F8FAFC" }}>
            <div
              className="absolute w-[2px]"
              style={{
                left: plot.left,
                bottom: plot.bottom,
                height: plot.height,
                backgroundColor: redBlueTheme.colors.stroke,
              }}
            />
            <div
              className="absolute h-[2px]"
              style={{
                left: plot.left,
                right: plot.right,
                bottom: plot.bottom,
                backgroundColor: redBlueTheme.colors.stroke,
              }}
            />
            {ticks.map((ratio) => (
              <div
                key={ratio}
                className="absolute h-px"
                style={{
                  left: plot.left,
                  right: plot.right,
                  bottom: plot.bottom + ratio * plot.height,
                  backgroundColor: ratio === 0 ? redBlueTheme.colors.stroke : "rgba(148,163,184,0.18)",
                }}
              >
                <span
                  className="absolute right-[calc(100%+12px)] top-[-9px] w-[42px] text-right text-[11px] font-bold"
                  style={{ color: redBlueTheme.colors.subtleText }}
                >
                  {formatTick(maxValue * ratio)}
                </span>
              </div>
            ))}
            <div
              className="absolute flex items-end justify-around"
              style={{
                left: plot.left + 24,
                right: plot.right + 12,
                bottom: plot.bottom,
                height: plot.height,
              }}
            >
              {parsed.series.map((item) => (
                <div key={item.label} className="flex w-[76px] flex-col items-center gap-[12px]">
                  <div className="relative flex h-full items-end">
                    <div
                      className="absolute bottom-[calc(100%+6px)] left-1/2 translate-x-[-50%] text-[11px] font-black"
                      style={{ color: toneColor(item.tone) }}
                    >
                      {formatTick(item.value)}
                    </div>
                    <div
                      className="w-[48px] rounded-t-[12px]"
                      style={{
                        height: `${Math.max(26, Math.min(plot.height, (item.value / maxValue) * plot.height))}px`,
                        backgroundColor: toneColor(item.tone),
                      }}
                    />
                  </div>
                  <div
                    className="absolute bottom-[-32px] text-center text-[13px] font-black"
                    style={{ color: redBlueTheme.colors.mutedText }}
                  >
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute left-[28px] top-[22px] text-[11px] font-bold" style={{ color: redBlueTheme.colors.subtleText }}>
              {parsed.chartUnit ?? `Max ${maxValue}`}
            </div>
          </div>
        </RedBlueChartShell>
        <div className="grid min-h-0 grid-rows-[auto_1fr] gap-[14px]">
          <RedBlueMetricCard title={parsed.metricTitle} rows={parsed.metrics} accentTone="purple" />
          <div className="grid min-h-0 gap-[12px]" style={{ gridTemplateRows: `repeat(${callouts.length}, minmax(0, 1fr))` }}>
            {callouts.map((callout) => (
              <RedBlueNumberCallout
                key={`${callout.label}-${callout.value}`}
                value={callout.value}
                label={callout.label}
                description={callout.description}
                tone={callout.tone}
                density={calloutDensity}
              />
            ))}
          </div>
        </div>
      </div>
    </RedBlueContentFrame>
  );
};

export default ChartMetricBrief;
