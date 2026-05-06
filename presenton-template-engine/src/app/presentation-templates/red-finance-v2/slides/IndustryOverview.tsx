import React from "react";
import * as z from "zod";

import ChartCardShell from "../components/ChartCardShell.js";
import FinanceContentFrame from "../components/FinanceContentFrame.js";
import FinanceBarChart from "../components/FinanceBarChart.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import InfoListItem from "../components/InfoListItem.js";
import InsightCallout from "../components/InsightCallout.js";

const overviewIconSchema = z.enum([
  "bank",
  "chart-line",
  "coins",
  "briefcase",
]);

const overviewItemSchema = z.object({
  icon: overviewIconSchema,
  title: z.string().min(2).max(20),
  description: z.string().min(12).max(96),
});

const chartBarSchema = z.object({
  label: z.string().min(1).max(12),
  value: z.number().min(0).max(1_000_000),
});

export const Schema = z.object({
  title: z.string().min(2).max(20).default("行业概况"),
  metaLabel: z.string().min(4).max(40).default("MARKET OVERVIEW"),
  footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(2).max(4).default("03"),
  infoItems: z.array(overviewItemSchema).min(1).max(8).default([
    {
      icon: "bank",
      title: "宏观与监管",
      description:
        "稳增长与强监管并行，结构性政策持续优化。政策导向聚焦金融服务实体经济，防范系统性金融风险。",
    },
    {
      icon: "chart-line",
      title: "行业规模",
      description:
        "银行、证券、保险与资管多业态协同发展。银行业资产总额稳步增长，保险保费规模持续扩大。",
    },
    {
      icon: "coins",
      title: "收入结构",
      description:
        "息差持续承压，驱动业务转型。非息收入与财富管理业务占比显著抬升，成为新增长极。",
    },
    {
      icon: "briefcase",
      title: "业务重心",
      description:
        "企业金融+零售金融“双轮驱动”。供应链金融与场景金融深度融合，数字化服务能力成为核心竞争力。",
    },
  ]),
  keyInsight: z
    .string()
    .min(12)
    .max(96)
    .default("关键启示：未来三年应重点提升中间业务收入，持续优化资产质量，并做强综合金融服务能力。"),
  chartTitle: z.string().min(2).max(64).default("金融行业资产规模趋势 (2022-2026E)"),
  chartSubtitle: z.string().max(48).default("单位：万亿元 (RMB)"),
  chartMin: z.number().min(0).max(1_000_000).default(300),
  chartMax: z.number().min(1).max(1_000_000).default(550),
  chartTicks: z.array(z.number().min(0).max(1_000_000)).min(2).max(10).default([
    300,
    350,
    400,
    450,
    500,
    550,
  ]),
  chartBars: z.array(chartBarSchema).min(2).max(8).default([
    { label: "2022", value: 370 },
    { label: "2023", value: 405 },
    { label: "2024", value: 442 },
    { label: "2025", value: 480 },
    { label: "2026E", value: 525 },
  ]),
});

export const layoutId = "industry-overview";
export const layoutName = "Industry Overview";
export const layoutDescription =
  "A component-oriented finance industry overview slide with editable policy highlights, a key insight callout, and a screenshot-safe bar chart.";
export const layoutTags = ["overview", "chart", "insight", "componentized"];
export const layoutRole = "content";
export const contentElements = ["chart", "insight-card", "icon-list"];
export const useCases = ["industry-overview", "market-overview", "executive-summary"];
export const suitableFor =
  "Suitable for overview pages that combine key takeaways, structured highlights, and one compact supporting chart.";
export const avoidFor =
  "Avoid using this layout for detailed process flows, roadmap plans, or long-form narrative sections.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const IndustryOverview = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const infoItemCount = parsed.infoItems.length;
  const infoDensity =
    infoItemCount > 6
      ? "dense"
      : infoItemCount > 4
        ? "compact"
        : "normal";
  const infoListGap = infoDensity === "dense" ? 0 : infoDensity === "compact" ? 10 : 20;
  const calloutMarginTop = infoDensity === "dense" ? 6 : infoDensity === "compact" ? 8 : 10;

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="chart-pie" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={170}
      contentHeight={500}
    >
      <div className="flex h-full gap-[50px] overflow-hidden">
        <div className="flex w-[600px] flex-none flex-col">
          <div
            className="flex flex-col overflow-hidden"
            style={{ gap: infoListGap }}
          >
            {parsed.infoItems.map((item, index) => (
              <InfoListItem
                key={`${item.title}-${index}`}
                icon={item.icon}
                title={item.title}
                description={item.description}
                showDivider={index < parsed.infoItems.length - 1}
                density={infoDensity}
              />
            ))}
          </div>

          <div style={{ marginTop: calloutMarginTop }}>
            <InsightCallout text={parsed.keyInsight} density={infoDensity} />
          </div>
        </div>

        <div className="flex flex-1 items-start">
          <ChartCardShell title={parsed.chartTitle} subtitle={parsed.chartSubtitle}>
            <FinanceBarChart
              labels={parsed.chartBars.map((bar) => bar.label)}
              series={[
                {
                  label: "资产规模",
                  color: "#B71C1C",
                  values: parsed.chartBars.map((bar) => bar.value),
                },
              ]}
              minValue={parsed.chartMin}
              maxValue={parsed.chartMax}
              ticks={parsed.chartTicks}
              yAxisWidth={58}
            />
          </ChartCardShell>
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default IndustryOverview;
