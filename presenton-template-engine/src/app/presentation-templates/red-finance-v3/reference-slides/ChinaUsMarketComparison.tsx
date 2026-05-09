import * as z from "zod";

import ChartCardShell from "../components/ChartCardShell.js";
import ComparisonPanel from "../components/ComparisonPanel.js";
import DualValueMetricCard from "../components/DualValueMetricCard.js";
import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import FinanceRadarChart from "../components/FinanceRadarChart.js";
import MeasuredChartArea from "../components/MeasuredChartArea.js";
import { redFinanceTheme } from "../theme/tokens.js";

const radarSeriesSchema = z.object({
  label: z.string().min(1).max(24),
  color: z.string().min(4).max(32),
  fillColor: z.string().min(4).max(40).optional(),
  dashed: z.boolean().default(false),
  values: z.array(z.number().min(0).max(100)).min(3).max(10),
});

const metricIconSchema = z.enum([
  "bank",
  "chart-line",
  "smartphone",
  "users",
  "coins",
  "database",
  "globe",
  "briefcase",
]);

const metricCardSchema = z.object({
  icon: metricIconSchema,
  title: z.string().min(2).max(40),
  leftLabel: z.string().min(1).max(16).default("中国"),
  rightLabel: z.string().min(1).max(16).default("美国"),
  leftValue: z.string().min(1).max(20),
  rightValue: z.string().min(1).max(20),
  leftShare: z.number().min(0).max(100),
  rightShare: z.number().min(0).max(100),
});

const panelSectionSchema = z.object({
  badge: z.string().min(1).max(12),
  badgeColor: z.string().min(4).max(32).optional(),
  title: z.string().min(2).max(30),
  description: z.string().min(8).max(140),
});

const comparisonPanelSchema = z.object({
  icon: z.enum([
    "shield",
    "network",
    "coins",
    "briefcase",
    "database",
    "globe",
  ]),
  title: z.string().min(2).max(40),
  headerBackgroundColor: z.string().min(4).max(32).optional(),
  sections: z.array(panelSectionSchema).min(2).max(4),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("中美金融市场规模与结构对比"),
  metaLabel: z.string().min(4).max(40).default("CN-US MARKET COMPARISON"),
  radarTitle: z.string().min(2).max(24).default("结构成熟度对比"),
  radarSubtitle: z
    .string()
    .min(2)
    .max(28)
    .default("China vs US Market Structure"),
  radarLabels: z
    .array(z.string().min(1).max(16))
    .min(3)
    .max(10)
    .default([
      "银行资产深度",
      "资本市场深度",
      "数字化普及",
      "非息收入占比",
      "实时支付覆盖",
      "绿色金融政策",
    ]),
  radarSeries: z
    .array(radarSeriesSchema)
    .min(2)
    .max(4)
    .default([
      {
        label: "中国 (CN)",
        color: redFinanceTheme.colors.primary,
        fillColor: "rgba(183, 28, 28, 0.20)",
        values: [95, 60, 90, 50, 95, 85],
      },
      {
        label: "美国 (US)",
        color: "#1565C0",
        fillColor: "rgba(21, 101, 192, 0.18)",
        values: [65, 95, 75, 85, 60, 70],
      },
    ]),
  radarTicks: z
    .array(z.number().min(0).max(100))
    .min(3)
    .max(6)
    .default([25, 50, 75, 100]),
  metrics: z
    .array(metricCardSchema)
    .min(2)
    .max(8)
    .default([
      {
        icon: "bank",
        title: "银行资产 / GDP",
        leftLabel: "中国",
        rightLabel: "美国",
        leftValue: "310%",
        rightValue: "105%",
        leftShare: 75,
        rightShare: 25,
      },
      {
        icon: "chart-line",
        title: "股市总市值 / GDP",
        leftLabel: "中国",
        rightLabel: "美国",
        leftValue: "65%",
        rightValue: "180%",
        leftShare: 26,
        rightShare: 74,
      },
      {
        icon: "smartphone",
        title: "移动支付渗透率",
        leftLabel: "中国",
        rightLabel: "美国",
        leftValue: "92%",
        rightValue: "48%",
        leftShare: 66,
        rightShare: 34,
      },
      {
        icon: "users",
        title: "居民金融资产股票占比",
        leftLabel: "中国",
        rightLabel: "美国",
        leftValue: "18%",
        rightValue: "45%",
        leftShare: 28,
        rightShare: 72,
      },
    ]),
  comparisonPanels: z
    .array(comparisonPanelSchema)
    .min(1)
    .max(6)
    .default([
      {
        icon: "shield",
        title: "监管风格 (Regulation)",
        sections: [
          {
            badge: "CN",
            badgeColor: redFinanceTheme.colors.primary,
            title: "审慎监管 + 发展导向",
            description:
              "强调宏观审慎与风险防范，政策窗口指导力度强，兼顾行业发展与稳定。",
          },
          {
            badge: "US",
            badgeColor: "#1565C0",
            title: "规则导向 + 市场化",
            description:
              "以信息披露为核心，事后监管与执法力度大，强调市场自我调节机制。",
          },
        ],
      },
      {
        icon: "network",
        title: "分销渠道 (Distribution)",
        sections: [
          {
            badge: "CN",
            badgeColor: redFinanceTheme.colors.primary,
            title: "超级 App + 线下网点",
            description:
              "支付宝、微信等超级入口占据 C 端流量，银行网点向智能化、咨询型转型。",
          },
          {
            badge: "US",
            badgeColor: "#1565C0",
            title: "独立顾问 + 邮件体系",
            description:
              "独立理财顾问体系成熟，邮件营销仍是主流，App 功能相对垂直。",
          },
        ],
      },
      {
        icon: "coins",
        title: "利润结构 (Profit Mix)",
        sections: [
          {
            badge: "CN",
            badgeColor: redFinanceTheme.colors.primary,
            title: "息差主导 -> 非息提升",
            description:
              "传统利差收入占比仍高，但正快速向财富管理等中收业务转型。",
          },
          {
            badge: "US",
            badgeColor: "#1565C0",
            title: "多元化非息收入",
            description:
              "资管、投行、交易佣金等非息收入占比高，收入来源更加均衡。",
          },
        ],
      },
    ]),
  footerText: z
    .string()
    .min(4)
    .max(120)
    .default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(6).default("12"),
});

export const layoutId = "china-us-market-comparison";
export const layoutName = "China US Market Comparison";
export const layoutDescription =
  "A component-oriented comparison slide with a reusable radar chart panel, dual-value metric cards, and flexible multi-section comparison panels.";
export const layoutTags = [
  "comparison",
  "cn-us",
  "radar-chart",
  "componentized",
];
export const layoutRole = "comparison";
export const contentElements = [
  "radar-chart",
  "metric-cards",
  "comparison-panels",
];
export const useCases = [
  "market-comparison",
  "regional-benchmark",
  "cross-market-analysis",
];
export const suitableFor =
  "Suitable for country, region, or strategy benchmark slides that combine visual structure comparison, dual metrics, and qualitative text panels.";
export const avoidFor =
  "Avoid using this layout for pure timelines, heavy process diagrams, or very large editable matrices.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const SeriesLegend = ({
  label,
  color,
  dashed = false,
}: {
  label: string;
  color: string;
  dashed?: boolean;
}) => (
  <div className="flex items-center gap-[8px]">
    <div className="relative h-[10px] w-[26px] flex-none">
      <div
        className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          backgroundColor: "#FFFFFF",
          border: `2px solid ${color}`,
        }}
      />
    </div>
    <span
      className="text-[11px]"
      style={{ color: redFinanceTheme.colors.mutedText }}
    >
      {label}
    </span>
  </div>
);

const ChinaUsMarketComparison = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const metricDensity =
    parsed.metrics.length > 4 ||
    parsed.metrics.some((metric) => metric.title.length > 14)
      ? "compact"
      : "normal";
  const panelDensity =
    parsed.comparisonPanels.length > 3 ||
    parsed.comparisonPanels.some(
      (panel) =>
        panel.sections.length > 2 ||
        panel.sections.some((section) => section.description.length > 44),
    )
      ? "compact"
      : "normal";

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="chart-line" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={144}
      contentHeight={526}
      contentBottomInset={12}
    >
      <div className="flex h-full flex-col gap-[18px] overflow-hidden">
        <div className="flex h-[286px] gap-[22px]">
          <div className="w-[432px] flex-none">
            <ChartCardShell
              title={parsed.radarTitle}
              className="h-full"
              padding={16}
              headerMarginBottom={6}
            >
              <MeasuredChartArea minHeight={220} className="pt-[2px]">
                {({ width, height }) => (
                  <FinanceRadarChart
                    labels={parsed.radarLabels}
                    series={parsed.radarSeries}
                    minValue={0}
                    maxValue={100}
                    ticks={parsed.radarTicks}
                    width={width}
                    height={height}
                    // outerRadius={parsed.radarLabels.length >= 8 ? "80%" : "90%"}
                    outerRadius="100%"
                    legendReserve={34}
                    radiusAxisWidth={14}
                    labelFontSize={9}
                    tickFormatter={(value) => `${value}`}
                    legend={
                      <div className="flex items-center justify-center gap-[22px]">
                        {parsed.radarSeries.map((series) => (
                          <SeriesLegend
                            key={series.label}
                            label={series.label}
                            color={series.color}
                            dashed={series.dashed}
                          />
                        ))}
                      </div>
                    }
                  />
                )}
              </MeasuredChartArea>
            </ChartCardShell>
          </div>

          <div
            className="grid min-w-0 flex-1 gap-[18px]"
            style={{
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            {parsed.metrics.map((metric, index) => (
              <DualValueMetricCard
                key={`${metric.title}-${index}`}
                title={metric.title}
                icon={
                  <FinanceIcon
                    name={metric.icon}
                    className="h-[17px] w-[17px]"
                    stroke="#9E9E9E"
                  />
                }
                leftLabel={metric.leftLabel}
                rightLabel={metric.rightLabel}
                leftValue={metric.leftValue}
                rightValue={metric.rightValue}
                leftShare={metric.leftShare}
                rightShare={metric.rightShare}
                density={metricDensity}
              />
            ))}
          </div>
        </div>

        <div
          className="grid min-h-0 flex-1 gap-[18px]"
          style={{
            gridTemplateColumns: `repeat(${parsed.comparisonPanels.length}, minmax(0, 1fr))`,
          }}
        >
          {parsed.comparisonPanels.map((panel, index) => (
            <ComparisonPanel
              key={`${panel.title}-${index}`}
              title={panel.title}
              icon={
                <FinanceIcon
                  name={panel.icon}
                  className="h-[18px] w-[18px]"
                  stroke="#EF5350"
                />
              }
              sections={panel.sections}
              headerBackgroundColor={
                panel.headerBackgroundColor ??
                redFinanceTheme.colors.backgroundText
              }
              density={panelDensity}
            />
          ))}
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default ChinaUsMarketComparison;
