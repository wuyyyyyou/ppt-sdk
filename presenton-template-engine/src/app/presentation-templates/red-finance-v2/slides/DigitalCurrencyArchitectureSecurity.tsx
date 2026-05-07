import React from "react";
import * as z from "zod";

import ChartCardShell from "../components/ChartCardShell.js";
import DualValueMetricCard from "../components/DualValueMetricCard.js";
import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon, type FinanceIconName } from "../components/FinanceIcons.js";
import FinanceRadarChart from "../components/FinanceRadarChart.js";
import FinanceSectionHeading from "../components/FinanceSectionHeading.js";
import HorizontalFeatureCard from "../components/HorizontalFeatureCard.js";
import MeasuredChartArea from "../components/MeasuredChartArea.js";
import SectionPanelShell from "../components/SectionPanelShell.js";
import { redFinanceTheme } from "../theme/tokens.js";

const layerIconSchema = z.enum([
  "smartphone",
  "microchip",
  "database",
  "security",
  "network",
  "architecture",
  "wallet",
  "shield",
]);

const metricIconSchema = z.enum([
  "bolt",
  "shield",
  "gavel",
  "route",
  "security",
  "regtech",
  "chart-line",
  "database",
]);

const architectureLayerSchema = z.object({
  icon: layerIconSchema.default("architecture"),
  title: z.string().min(2).max(44),
  description: z.string().min(4).max(76),
});

const radarSeriesSchema = z.object({
  label: z.string().min(1).max(28),
  shortLabel: z.string().min(1).max(6).optional(),
  color: z.string().min(4).max(32),
  fillColor: z.string().min(4).max(40).optional(),
  dashed: z.boolean().default(false),
  values: z.array(z.number().min(0).max(100)).min(3).max(8),
});

const metricCardSchema = z.object({
  icon: metricIconSchema.default("chart-line"),
  title: z.string().min(2).max(32),
  leftValue: z.number().min(0).max(100),
  rightValue: z.number().min(0).max(100),
  leftDisplayValue: z.string().min(1).max(12).optional(),
  rightDisplayValue: z.string().min(1).max(12).optional(),
});

export const Schema = z.object({
  title: z.string().min(2).max(34).default("数字货币技术架构与安全"),
  metaLabel: z.string().min(4).max(44).default("TECH ARCHITECTURE & SECURITY"),
  stackTitle: z.string().min(2).max(24).default("核心技术栈"),
  stackMeta: z.string().min(2).max(28).default("Tech Stack"),
  layers: z.array(architectureLayerSchema).min(3).max(5).default([
    {
      icon: "smartphone",
      title: "体验层 (Experience)",
      description: "数字钱包 · 硬件终端 · API 接口",
    },
    {
      icon: "microchip",
      title: "智能层 (Smart)",
      description: "智能合约 · 隐私计算 · 监管探针",
    },
    {
      icon: "database",
      title: "账本层 (Ledger)",
      description: "分布式账本 · 共识机制 · 状态机",
    },
    {
      icon: "security",
      title: "密钥层 (Key Security)",
      description: "HSM 机具 · 多重签名 · 门限签名",
    },
  ]),
  chartTitle: z.string().min(2).max(28).default("架构能力雷达"),
  radarLabels: z.array(z.string().min(1).max(14)).min(3).max(8).default([
    "吞吐量",
    "韧性",
    "治理",
    "合规",
    "隐私",
    "追溯",
  ]),
  radarSeries: z.array(radarSeriesSchema).min(2).max(4).default([
    {
      label: "中心化 (CBDC)",
      shortLabel: "C",
      color: redFinanceTheme.colors.primary,
      fillColor: "rgba(183, 28, 28, 0.18)",
      dashed: false,
      values: [95, 60, 90, 100, 80, 85],
    },
    {
      label: "去中心化 (Crypto)",
      shortLabel: "D",
      color: "#9E9E9E",
      fillColor: "rgba(158, 158, 158, 0.16)",
      dashed: true,
      values: [30, 95, 40, 20, 40, 70],
    },
  ]),
  radarTicks: z.array(z.number().min(0).max(100)).min(3).max(6).default([
    20, 40, 60, 80, 100,
  ]),
  metrics: z.array(metricCardSchema).min(2).max(6).default([
    {
      icon: "bolt",
      title: "吞吐量 (TPS)",
      leftValue: 95,
      rightValue: 30,
    },
    {
      icon: "shield",
      title: "系统韧性",
      leftValue: 60,
      rightValue: 95,
    },
    {
      icon: "gavel",
      title: "治理效率",
      leftValue: 90,
      rightValue: 40,
    },
    {
      icon: "route",
      title: "可追溯性",
      leftValue: 85,
      rightValue: 70,
    },
    {
      icon: "security",
      title: "隐私保护",
      leftValue: 80,
      rightValue: 40,
    },
    {
      icon: "regtech",
      title: "监管合规",
      leftValue: 100,
      rightValue: 20,
    },
  ]),
  footerText: z.string().min(4).max(120).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(6).default("19"),
});

export const layoutId = "digital-currency-architecture-security";
export const layoutName = "Digital Currency Architecture Security";
export const layoutDescription =
  "A component-oriented digital currency architecture slide with reusable layer cards, a radar chart, and dual-score metric cards.";
export const layoutTags = [
  "digital-currency",
  "architecture",
  "security",
  "radar-chart",
  "componentized",
];
export const layoutRole = "content";
export const contentElements = [
  "architecture-layer-cards",
  "radar-chart",
  "dual-score-metric-cards",
];
export const useCases = [
  "digital-currency-security",
  "technology-architecture",
  "cbdc-crypto-comparison",
];
export const suitableFor =
  "Suitable for digital currency, payment infrastructure, or financial technology slides that need layered architecture plus a compact capability comparison.";
export const avoidFor =
  "Avoid using this layout for long process flows, detailed protocol diagrams, or more than six capability metric cards.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const shortLegendLabel = (series: z.infer<typeof radarSeriesSchema>, index: number) =>
  series.shortLabel ?? (series.label.trim().slice(0, 2) || `S${index + 1}`);

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
    <span className="text-[11px]" style={{ color: redFinanceTheme.colors.mutedText }}>
      {label}
    </span>
  </div>
);

const DigitalCurrencyArchitectureSecurity = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const primarySeries = parsed.radarSeries[0];
  const secondarySeries = parsed.radarSeries[1];
  const layerCompact =
    parsed.layers.length >= 5 ||
    parsed.layers.some((item) => item.title.length > 18 || item.description.length > 34);
  const metricDensity =
    parsed.metrics.length >= 5 ||
    parsed.metrics.some((item) => item.title.length > 10)
      ? "compact"
      : "normal";
  const metricRows = Math.ceil(parsed.metrics.length / 2);

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="security" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={144}
      contentHeight={526}
      contentBottomInset={12}
    >
      <div className="flex h-full gap-[26px] overflow-hidden">
        <SectionPanelShell
          className="relative w-[358px] flex-none overflow-hidden"
          radius={12}
          paddingX={18}
          paddingY={16}
        >
          <FinanceSectionHeading
            title={parsed.stackTitle}
            subtitle={parsed.stackMeta}
            marginBottom={layerCompact ? 12 : 16}
          />
          <div
            className="absolute bottom-[42px] left-[42px] top-[72px] w-[2px] rounded-full"
            style={{ backgroundColor: "#E0E0E0" }}
          />
          <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center gap-[12px]">
            {parsed.layers.map((layer, index) => (
              <HorizontalFeatureCard
                key={`${layer.title}-${index}`}
                iconName={layer.icon as FinanceIconName}
                title={layer.title}
                description={layer.description}
                density={layerCompact ? "dense" : "compact"}
                tone="accent"
                minHeight={layerCompact ? 76 : 86}
                railWidth={5}
                iconBoxSize={layerCompact ? 38 : 42}
                titleFontSize={layerCompact ? 13 : 15}
                descriptionFontSize={layerCompact ? 10 : 11}
                descriptionLineHeight={1.28}
                titleNoWrap={false}
                cardBackgroundColor="#FFFFFF"
                shadow="0 4px 10px rgba(0,0,0,0.04)"
              />
            ))}
          </div>
        </SectionPanelShell>

        <div className="flex min-w-0 flex-1">
          <div className="flex min-h-0 flex-1 gap-[22px]">
            <div className="w-[386px] flex-none">
              <ChartCardShell
                title={parsed.chartTitle}
                className="h-full"
                padding={16}
                headerMarginBottom={8}
              >
                <MeasuredChartArea minHeight={330} className="pt-[2px]">
                  {({ width, height }) => (
                    <FinanceRadarChart
                      labels={parsed.radarLabels}
                      series={parsed.radarSeries}
                      minValue={0}
                      maxValue={100}
                      ticks={parsed.radarTicks}
                      width={width}
                      height={height}
                      outerRadius={parsed.radarLabels.length >= 7 ? "72%" : "80%"}
                      legendReserve={40}
                      radiusAxisWidth={18}
                      labelFontSize={parsed.radarLabels.length >= 7 ? 9 : 10}
                      legend={
                        <div className="flex flex-wrap items-center justify-center gap-x-[18px] gap-y-[6px]">
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
              className="grid min-w-0 flex-1 gap-[12px]"
              style={{
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gridTemplateRows: `repeat(${metricRows}, minmax(0, 1fr))`,
              }}
            >
              {parsed.metrics.map((metric, index) => (
                <DualValueMetricCard
                  key={`${metric.title}-${index}`}
                  title={metric.title}
                  icon={
                    <FinanceIcon
                      name={metric.icon}
                      className="h-[16px] w-[16px]"
                      stroke="#8A8A8A"
                    />
                  }
                  leftLabel={shortLegendLabel(primarySeries, 0)}
                  rightLabel={shortLegendLabel(secondarySeries, 1)}
                  leftValue={metric.leftDisplayValue ?? `${metric.leftValue}%`}
                  rightValue={metric.rightDisplayValue ?? `${metric.rightValue}%`}
                  leftShare={metric.leftValue}
                  rightShare={metric.rightValue}
                  leftColor={primarySeries.color}
                  rightColor={secondarySeries.color}
                  density={metricDensity}
                  progressMode="stacked"
                  cardHeight="100%"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default DigitalCurrencyArchitectureSecurity;
