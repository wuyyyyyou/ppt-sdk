import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import AnalyticsCardShell from "../components/AnalyticsCardShell.tsx";
import AnalyticsSourceFooter from "../components/AnalyticsSourceFooter.tsx";
import ChartPanelShell from "../components/ChartPanelShell.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import { chartAnalyticsTheme } from "../theme/tokens.ts";

const InsightSchema = z.object({
  label: z.string().min(2).max(28),
  text: z.string().min(8).max(120),
});

export const Schema = z.object({
  eyebrow: z.string().min(2).max(44).default("Chart and Evidence Canvas"),
  title: z.string().min(4).max(72).default("Primary Evidence With Interpretation"),
  headerMetaLabel: z.string().min(2).max(24).default("Anchor"),
  headerMetaValue: z.string().min(2).max(36).default("Chart / Image / Timeline"),
  headerIcon: z.string().min(2).max(32).default("chart-line"),
  chartTitle: z.string().min(2).max(52).default("Primary evidence area"),
  chartSubtitle: z.string().min(4).max(110).default("Place one dominant chart, image, table, or timeline component here"),
  legendLabel: z.string().min(2).max(24).default("Evidence"),
  insightTitle: z.string().min(2).max(42).default("Interpretation Rail"),
  insights: z.array(InsightSchema).min(2).max(4).default([
    { label: "Claim", text: "State the grounded takeaway supported by the primary visual." },
    { label: "Caveat", text: "Add methodology, coverage, or confidence notes without overloading the chart." },
    { label: "Action", text: "Connect the evidence to the page-level decision or recommendation." },
  ]),
  footerSource: z.string().min(4).max(120).default("Sources: attach data source, image credit, or research evidence reference."),
  confidentialityLabel: z.string().min(2).max(32).default("CANVAS"),
  pageNumber: z.string().min(1).max(6).default("04"),
  showSlotGuides: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "chart-evidence-canvas";
export const layoutName = "Chart Evidence Canvas";
export const layoutDescription =
  "A broad canvas for one dominant chart, table, image, screenshot, map, timeline, or other evidence anchor plus an interpretation rail.";
export const layoutTags = ["chart", "evidence", "timeline", "canvas", "analytics", "component-first", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "primary-evidence-slot", "interpretation-rail", "source-footer"];
export const useCases = ["chart-analysis", "visual-evidence", "timeline", "source-backed-claim"];
export const suitableFor = "Suitable when one visual or evidence module should dominate the page.";
export const avoidFor = "Avoid for pages with many unrelated charts, covers, closing pages, or text-only summaries.";
export const density = "high";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const ChartEvidenceCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
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

      <div className="grid h-[582px] grid-cols-[minmax(0,1fr)_320px] gap-[28px] px-[48px] py-[32px]">
        <ChartPanelShell
          title={parsed.chartTitle}
          subtitle={parsed.chartSubtitle}
          legend={[{ label: parsed.legendLabel, color: chartAnalyticsTheme.colors.primary }]}
        >
          {parsed.showSlotGuides ? (
            <div
              className="flex h-full min-h-0 items-center justify-center rounded-[8px] border border-dashed"
              style={{
                borderColor: "#BFDBFE",
                backgroundColor: "#EFF6FF",
                color: chartAnalyticsTheme.colors.primary,
              }}
            >
              <div className="w-[560px] text-center text-[22px] font-black uppercase leading-[1.45]">
                Replace with AnalyticsLineChart, AnalyticsGroupedBarChart, AnalyticsImageShowcasePanel,
                ComparisonMatrixBoard, or HorizontalMilestoneTimeline
              </div>
            </div>
          ) : null}
        </ChartPanelShell>

        <AnalyticsCardShell dark padding={24}>
          <div className="text-[22px] font-black leading-[1.12] text-white">{parsed.insightTitle}</div>
          <div className="mt-[18px] flex flex-1 flex-col gap-[14px]">
            {parsed.insights.map((insight) => (
              <div key={insight.label} className="rounded-[8px] border border-white/10 bg-white/[0.06] p-[16px]">
                <div className="text-[11px] font-bold uppercase leading-none" style={{ color: "#60A5FA" }}>
                  {insight.label}
                </div>
                <div className="mt-[8px] text-[14px] font-medium leading-[1.42] text-slate-200">{insight.text}</div>
              </div>
            ))}
          </div>
        </AnalyticsCardShell>
      </div>

      <AnalyticsSourceFooter
        source={parsed.footerSource}
        confidentialityLabel={parsed.confidentialityLabel}
        pageNumber={parsed.pageNumber}
      />
    </AnalyticsCanvas>
  );
};

export default ChartEvidenceCanvas;
