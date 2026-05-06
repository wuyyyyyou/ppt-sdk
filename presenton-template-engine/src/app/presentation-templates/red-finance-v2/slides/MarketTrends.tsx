import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import TrendChartsPanel from "../components/TrendChartsPanel.js";
import TrendSignalCard from "../components/TrendSignalCard.js";

const trendIconSchema = z.enum([
  "robot",
  "coins",
  "network",
  "leaf",
  "globe",
]);

const trendCardSchema = z.object({
  icon: trendIconSchema,
  title: z.string().min(2).max(24),
  description: z.string().min(8).max(80),
});

const lineSeriesSchema = z.object({
  label: z.string().min(1).max(16),
  color: z.string().min(4).max(32),
  values: z.array(z.number().min(0).max(100)).min(2).max(8),
});

const barSeriesSchema = z.object({
  label: z.string().min(1).max(16),
  color: z.string().min(4).max(32),
  values: z.array(z.number().min(0).max(100)).min(2).max(8),
});

export const Schema = z.object({
  title: z.string().min(2).max(24).default("市场趋势"),
  metaLabel: z.string().min(4).max(40).default("MARKET TRENDS"),
  footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(2).max(4).default("04"),
  trends: z.array(trendCardSchema).min(3).max(6).default([
    {
      icon: "robot",
      title: "AI规模化落地",
      description: "客服、风控与运营自动化持续提速，生成式 AI 开始重塑前中后台流程。",
    },
    {
      icon: "coins",
      title: "财富管理崛起",
      description: "从吃息差转向赚中收，投顾、托管与私行业务协同增强。",
    },
    {
      icon: "network",
      title: "开放金融生态",
      description: "API 协作与跨界联合加深，平台化金融服务成为主要抓手。",
    },
    {
      icon: "leaf",
      title: "绿色与ESG",
      description: "绿色信贷体系完善，碳金融产品创新和信息披露进入常态化阶段。",
    },
    {
      icon: "globe",
      title: "跨境业务深化",
      description: "跨境支付、清算与互联互通机制优化，国际化服务能力继续提升。",
    },
  ]),
  aiChartTitle: z.string().min(4).max(48).default("金融机构AI技术应用渗透率预测"),
  aiChartTag: z.string().min(2).max(20).default("2024-2027E"),
  aiChartLabels: z.array(z.string().min(1).max(12)).min(2).max(8).default([
    "2024",
    "2025",
    "2026E",
    "2027E",
  ]),
  aiChartSeries: z.array(lineSeriesSchema).min(1).max(5).default([
    { label: "智能客服", color: "#B71C1C", values: [45, 58, 72, 85] },
    { label: "智能风控", color: "#EF5350", values: [60, 68, 78, 88] },
    { label: "智能投研", color: "#FF8A80", values: [30, 42, 55, 68] },
  ]),
  incomeChartTitle: z.string().min(4).max(40).default("银行业收入结构变化趋势"),
  incomeChartTag: z.string().min(2).max(24).default("非息收入占比 (%)"),
  incomeChartLabels: z.array(z.string().min(1).max(12)).min(2).max(8).default([
    "大型银行",
    "股份制银行",
    "城商行",
  ]),
  incomeChartSeries: z.array(barSeriesSchema).min(1).max(4).default([
    { label: "2024", color: "#FFCDD2", values: [28, 32, 18] },
    { label: "2026E", color: "#B71C1C", values: [35, 40, 24] },
  ]),
});

export const layoutId = "market-trends";
export const layoutName = "Market Trends";
export const layoutDescription =
  "A component-oriented finance trend slide with trend signal cards and two screenshot-safe Recharts forecast panels.";
export const layoutTags = ["trend", "forecast", "chart", "componentized"];
export const layoutRole = "content";
export const contentElements = ["trend-cards", "line-chart", "bar-chart"];
export const useCases = ["market-trends", "forecast", "industry-outlook"];
export const suitableFor =
  "Suitable for market trend, outlook, and forecast slides that combine short qualitative signals with two compact charts.";
export const avoidFor =
  "Avoid using this layout for long-form strategy explanation, process decomposition, or single-chart deep dives.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const MarketTrends = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="chart-line" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={154}
      contentHeight={498}
    >
      <div className="flex h-full flex-col gap-[20px] overflow-hidden">
        <div
          className="grid gap-[15px]"
          style={{ gridTemplateColumns: `repeat(${parsed.trends.length}, minmax(0, 1fr))` }}
        >
          {parsed.trends.map((trend, index) => (
            <TrendSignalCard
              key={`${trend.title}-${index}`}
              icon={trend.icon}
              title={trend.title}
              description={trend.description}
            />
          ))}
        </div>

        <div className="min-h-0 flex-1">
          <TrendChartsPanel
            aiChartTitle={parsed.aiChartTitle}
            aiChartTag={parsed.aiChartTag}
            aiChartLabels={parsed.aiChartLabels}
            aiChartSeries={parsed.aiChartSeries}
            incomeChartTitle={parsed.incomeChartTitle}
            incomeChartTag={parsed.incomeChartTag}
            incomeChartLabels={parsed.incomeChartLabels}
            incomeChartSeries={parsed.incomeChartSeries}
          />
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default MarketTrends;
