import React from "react";
import * as z from "zod";

import ChartCardShell from "../components/ChartCardShell.js";
import FinanceContentFrame from "../components/FinanceContentFrame.js";
import FinanceDonutChart from "../components/FinanceDonutChart.js";
import { FinanceIcon, type FinanceIconName } from "../components/FinanceIcons.js";
import IconText from "../components/IconText.js";
import IconTextCard from "../components/IconTextCard.js";
import MeasuredChartArea from "../components/MeasuredChartArea.js";
import StableMatrixGrid from "../components/StableMatrixGrid.js";
import StatusPill from "../components/StatusPill.js";
import { redFinanceTheme } from "../theme/tokens.js";

const featureSchema = z.object({
  icon: z.enum(["code", "bolt", "shield", "contract"]),
  label: z.string().min(2).max(16),
});

const categorySchema = z.object({
  icon: z.enum(["bank", "coins", "microchip"]),
  title: z.string().min(4).max(40),
  description: z.string().min(10).max(120),
});

const chartSegmentSchema = z.object({
  label: z.string().min(2).max(16),
  value: z.number().min(1).max(100),
  color: z.string().min(4).max(16),
});

const comparisonRowSchema = z.object({
  category: z.string().min(2).max(18),
  issuer: z.string().min(2).max(30),
  backing: z.string().min(2).max(30),
  volatility: z.string().min(2).max(18),
  volatilityTone: z.enum(["low", "high"]),
  regulation: z.string().min(2).max(30),
});

export const Schema = z.object({
  title: z.string().min(4).max(30).default("数字货币概述与分类"),
  metaLabel: z.string().min(4).max(40).default("OVERVIEW & TAXONOMY"),
  definitionLabel: z.string().min(2).max(18).default("核心定义"),
  definitionText: z
    .string()
    .min(20)
    .max(160)
    .default("以电子形式存在的价值数字化表示，具备交易媒介、记账单位和价值储存功能，依托密码学技术实现价值流转。"),
  features: z.array(featureSchema).min(3).max(5).default([
    { icon: "code", label: "可编程性" },
    { icon: "bolt", label: "即时结算" },
    { icon: "shield", label: "隐私分层" },
    { icon: "contract", label: "合规设计" },
  ]),
  categories: z.array(categorySchema).min(2).max(3).default([
    {
      icon: "bank",
      title: "央行数字货币 (CBDC)",
      description: "由央行发行，具有法偿性的国家法定货币数字化形态。",
    },
    {
      icon: "coins",
      title: "稳定币 (Stablecoins)",
      description: "锚定法币或资产组合，旨在维持价格稳定的支付工具。",
    },
    {
      icon: "microchip",
      title: "加密资产 (Crypto)",
      description: "去中心化发行，由市场供需决定价格，主要作为投机或存储资产。",
    },
  ]),
  chartTitle: z.string().min(2).max(28).default("数字货币市值分布"),
  chartCenterLabel: z.string().min(2).max(14).default("市值分布"),
  chartSegments: z.array(chartSegmentSchema).min(3).max(5).default([
    { label: "加密资产", value: 65, color: "#B71C1C" },
    { label: "稳定币", value: 30, color: "#EF5350" },
    { label: "CBDC", value: 5, color: "#FFCDD2" },
  ]),
  columns: z
    .object({
      category: z.string().min(2).max(16).default("分类类别"),
      issuer: z.string().min(2).max(16).default("发行主体"),
      backing: z.string().min(2).max(16).default("价值背书"),
      volatility: z.string().min(2).max(16).default("波动性"),
      regulation: z.string().min(2).max(16).default("监管态势"),
    })
    .default({
      category: "分类类别",
      issuer: "发行主体",
      backing: "价值背书",
      volatility: "波动性",
      regulation: "监管态势",
    }),
  comparisonRows: z.array(comparisonRowSchema).min(3).max(5).default([
    {
      category: "CBDC",
      issuer: "中央银行",
      backing: "国家信用",
      volatility: "极低 (1:1)",
      volatilityTone: "low",
      regulation: "主导与推广",
    },
    {
      category: "稳定币",
      issuer: "私人机构",
      backing: "储备资产",
      volatility: "低 (锚定)",
      volatilityTone: "low",
      regulation: "准入与审计",
    },
    {
      category: "加密资产",
      issuer: "去中心化网络",
      backing: "共识/算力",
      volatility: "极高",
      volatilityTone: "high",
      regulation: "反洗钱/牌照",
    },
  ]),
  footerText: z.string().min(6).max(120).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(8).default("16"),
});

export const layoutId = "digital-currency-overview-taxonomy";
export const layoutName = "Digital Currency Overview & Taxonomy";
export const layoutDescription =
  "A digital-currency overview slide with feature pills, reusable taxonomy cards, a donut composition chart, and an editable comparison matrix.";
export const layoutTags = ["digital-currency", "taxonomy", "donut-chart", "table", "componentized"];
export const layoutRole = "content";
export const contentElements = ["definition-panel", "feature-pills", "taxonomy-cards", "donut-chart", "comparison-table"];
export const useCases = ["taxonomy-overview", "concept-classification", "market-composition"];
export const suitableFor =
  "Suitable for category overviews that need a short definition, a few signal cards, one composition chart, and a compact comparison table.";
export const avoidFor =
  "Avoid using this layout for timeline-heavy narratives, long bullet text, or large data tables with many rows.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const featureIconMap: Record<z.infer<typeof featureSchema>["icon"], FinanceIconName> = {
  code: "laptop-code",
  bolt: "bolt",
  shield: "shield",
  contract: "document",
};

const VolatilityBadge = ({
  label,
  tone,
}: {
  label: string;
  tone: z.infer<typeof comparisonRowSchema>["volatilityTone"];
}) => {
  const palette =
    tone === "low"
      ? { backgroundColor: "#E8F5E9", color: "#2E7D32" }
      : { backgroundColor: "#FFEBEE", color: "#C62828" };

  return (
    <StatusPill
      label={label}
      backgroundColor={palette.backgroundColor}
      textColor={palette.color}
      minWidth={76}
      height={22}
      paddingX={12}
      fontSize={12}
      borderRadius={6}
    />
  );
};

const DigitalCurrencyOverviewTaxonomy = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const featureCount = parsed.features.length;
  const categoryCount = parsed.categories.length;
  const comparisonRowCount = parsed.comparisonRows.length;
  const hasLongDefinition = parsed.definitionText.length > 82;
  const hasLongFeatureLabel = parsed.features.some((item) => item.label.length > 6);
  const hasLongCategoryText = parsed.categories.some(
    (item) => item.title.length > 22 || item.description.length > 38,
  );
  const hasLongTableText = parsed.comparisonRows.some(
    (row) =>
      row.category.length > 8 ||
      row.issuer.length > 10 ||
      row.backing.length > 10 ||
      row.volatility.length > 10 ||
      row.regulation.length > 12,
  );

  const sectionGap = comparisonRowCount >= 5 ? 12 : 14;
  const topSectionHeight = hasLongDefinition || featureCount >= 5 ? 108 : 96;
  const middleSectionHeight =
    comparisonRowCount >= 5 ? 178 : comparisonRowCount >= 4 || hasLongCategoryText ? 188 : 196;
  const featureFontSize = featureCount >= 5 || hasLongFeatureLabel ? 12 : 13;
  const featureGap = featureCount >= 5 ? 6 : 8;
  const definitionFontSize = hasLongDefinition ? 13 : 14;
  const categoryDensity = hasLongCategoryText ? "dense" : "compact";
  const categoryDescriptionFontSize = hasLongCategoryText ? 11 : 12;
  const categoryTitleFontSize = hasLongCategoryText ? 15 : 17;
  const categoryDescriptionLines = hasLongCategoryText ? 4 : 3;
  const tableDensity =
    comparisonRowCount >= 5 ? "dense" : comparisonRowCount >= 4 || hasLongTableText ? "compact" : "normal";
  const chartLegendWidth = parsed.chartSegments.length >= 5 ? 152 : 144;
  const chartLegendFontSize = parsed.chartSegments.length >= 5 ? 11 : 12;

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="list" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={152}
      contentHeight={520}
    >
      <div className="flex h-full flex-col overflow-hidden" style={{ gap: sectionGap }}>
        <div
          className="grid grid-cols-[448px_minmax(0,1fr)] gap-[18px]"
          style={{ height: topSectionHeight }}
        >
          <div
            className="relative flex h-full overflow-hidden rounded-[12px] px-[24px] py-[18px]"
            style={{
              backgroundColor: "#FAFAFA",
              border: `1px solid ${redFinanceTheme.colors.stroke}`,
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            }}
          >
            <div
              className="absolute bottom-[18px] left-[20px] top-[18px] w-[4px] rounded-full"
              style={{ backgroundColor: redFinanceTheme.colors.primary }}
            />
            <div className="pl-[18px]">
              <div
                className="mb-[6px] text-[13px] font-bold uppercase tracking-[0.12em]"
                style={{ color: redFinanceTheme.colors.primary }}
              >
                {parsed.definitionLabel}
              </div>
              <div
                className="font-medium leading-[1.55]"
                style={{
                  fontSize: definitionFontSize,
                  color: redFinanceTheme.colors.backgroundText,
                }}
              >
                {parsed.definitionText}
              </div>
            </div>
          </div>

          <div
            className="grid h-full gap-[12px]"
            style={{
              gridTemplateColumns: `repeat(${featureCount}, minmax(0, 1fr))`,
            }}
          >
            {parsed.features.map((feature, index) => (
              <div
                key={`${feature.label}-${index}`}
                className="flex h-full items-center justify-center rounded-[999px] border px-[14px]"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: redFinanceTheme.colors.stroke,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                }}
              >
                <IconText
                  icon={
                    <FinanceIcon
                      name={featureIconMap[feature.icon]}
                      className="h-[18px] w-[18px]"
                      stroke={redFinanceTheme.colors.primary}
                    />
                  }
                  label={feature.label}
                  height={24}
                  iconSize={18}
                  gap={featureGap}
                  fontSize={featureFontSize}
                  fontWeight={700}
                  textColor={redFinanceTheme.colors.backgroundText}
                />
              </div>
            ))}
          </div>
        </div>

        <div
          className="grid gap-[18px]"
          style={{
            height: middleSectionHeight,
            gridTemplateColumns: "minmax(0,1fr) 392px",
          }}
        >
          <div
            className="grid gap-[14px]"
            style={{
              gridTemplateColumns: `repeat(${categoryCount}, minmax(0, 1fr))`,
            }}
          >
            {parsed.categories.map((category, index) => (
              <IconTextCard
                key={`${category.title}-${index}`}
                icon={category.icon}
                title={category.title}
                description={category.description}
                density={categoryDensity}
                minHeight={middleSectionHeight}
                iconSize={hasLongCategoryText ? 50 : 56}
                titleFontSize={categoryTitleFontSize}
                descriptionFontSize={categoryDescriptionFontSize}
                descriptionMaxLines={categoryDescriptionLines}
                borderRadius={12}
                topAccentThickness={6}
                shadow="0 4px 6px rgba(0,0,0,0.02)"
                iconBackgroundColor="#FFEBEE"
                cardBorderColor={redFinanceTheme.colors.stroke}
              />
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <ChartCardShell
              title={parsed.chartTitle}
              className="h-full bg-[#FFFFFF]"
              padding={14}
              headerMarginBottom={8}
            >
              <MeasuredChartArea minHeight={120}>
                {({ width, height }) => (
                  <div className="flex h-full items-center">
                    <FinanceDonutChart
                      segments={parsed.chartSegments}
                      centerLabel={parsed.chartCenterLabel}
                      width={width}
                      height={height}
                      strokeWidth={22}
                      legendWidth={chartLegendWidth}
                      centerXRatio={0.32}
                      innerLabelFontSize={14}
                      legendLabelFontSize={chartLegendFontSize}
                      legendValueFontSize={chartLegendFontSize}
                    />
                  </div>
                )}
              </MeasuredChartArea>
            </ChartCardShell>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <StableMatrixGrid
            density={tableDensity}
            rowHeaderLabel={parsed.columns.category}
            rowHeaderWidth={comparisonRowCount >= 5 ? 156 : 168}
            columns={[
              { label: parsed.columns.issuer, width: comparisonRowCount >= 5 ? 190 : 210 },
              { label: parsed.columns.backing, width: comparisonRowCount >= 5 ? 190 : 210 },
              { label: parsed.columns.volatility, width: comparisonRowCount >= 5 ? 156 : 168 },
              { label: parsed.columns.regulation, width: "minmax(0, 1fr)" },
            ]}
            headerBackgroundColor="#212121"
            headerTextColor="#FFFFFF"
            outerBorderColor={redFinanceTheme.colors.stroke}
            rowDividerColor={redFinanceTheme.colors.stroke}
            stripeColors={["#FFFFFF", "#FFFFFF"]}
            rows={parsed.comparisonRows.map((row) => ({
              header: row.category,
              headerAlign: "center",
              cells: [
                { lead: row.issuer, leadColor: redFinanceTheme.colors.backgroundText },
                { lead: row.backing, leadColor: redFinanceTheme.colors.backgroundText },
                {
                  lead: row.volatility,
                  content: <VolatilityBadge label={row.volatility} tone={row.volatilityTone} />,
                },
                { lead: row.regulation, leadColor: redFinanceTheme.colors.backgroundText },
              ],
            }))}
          />
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default DigitalCurrencyOverviewTaxonomy;
