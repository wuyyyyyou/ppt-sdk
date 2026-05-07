import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import HorizontalFeatureCard from "../components/HorizontalFeatureCard.js";
import IconTextCard from "../components/IconTextCard.js";
import { redFinanceTheme } from "../theme/tokens.js";

const capabilityIconSchema = z.enum([
  "microchip",
  "network",
  "architecture",
  "brain",
  "regtech",
  "security",
]);

const detailSchema = z.object({
  lead: z.string().min(1).max(56),
  highlight: z.string().min(1).max(32),
  tail: z.string().min(1).max(88),
});

const comparisonRowSchema = z.object({
  icon: capabilityIconSchema,
  dimensionTitle: z.string().min(1).max(24),
  dimensionSubtitle: z.string().min(1).max(32),
  chinaTitle: z.string().min(1).max(40),
  chinaDetail: detailSchema,
  usTitle: z.string().min(1).max(44),
  usDetail: detailSchema,
});

export const Schema = z.object({
  title: z.string().min(2).max(40).default("中美金融科技与数字能力对比"),
  metaLabel: z.string().min(2).max(56).default("FINTECH & DIGITAL CAPABILITIES"),
  chinaLabel: z.string().min(1).max(20).default("中国 (CN)"),
  usLabel: z.string().min(1).max(20).default("美国 (US)"),
  dimensionLabel: z.string().min(2).max(40).default("对比维度 / Dimensions"),
  rows: z.array(comparisonRowSchema).min(4).max(8).default([
    {
      icon: "microchip",
      dimensionTitle: "支付轨道",
      dimensionSubtitle: "Payment Rails",
      chinaTitle: "超级 App 主导 · 实时结算",
      chinaDetail: {
        lead: "二维码普及率超 90%，",
        highlight: "移动端流量垄断",
        tail: "，T+0 实时结算成为体验基线。",
      },
      usTitle: "卡组织主导 · 逐步实时化",
      usDetail: {
        lead: "信用卡体系根基深厚，",
        highlight: "FedNow",
        tail: " 正推动实时支付基础设施完善。",
      },
    },
    {
      icon: "network",
      dimensionTitle: "开放银行",
      dimensionSubtitle: "Open Banking",
      chinaTitle: "生态平台驱动",
      chinaDetail: {
        lead: "通过",
        highlight: "场景嵌入",
        tail: "开放能力，API 标准持续统一，平台壁垒高。",
      },
      usTitle: "聚合器驱动 (Aggregators)",
      usDetail: {
        lead: "市场化主导，",
        highlight: "Plaid",
        tail: " 连接金融数据，FDX 标准逐渐成熟。",
      },
    },
    {
      icon: "architecture",
      dimensionTitle: "云与架构",
      dimensionSubtitle: "Cloud & Arch",
      chinaTitle: "云原生跨越式发展",
      chinaDetail: {
        lead: "核心系统",
        highlight: "分布式改造",
        tail: "激进，更多转向私有云与行业云组合。",
      },
      usTitle: "混合云与大型机并存",
      usDetail: {
        lead: "成熟",
        highlight: "公有云",
        tail: "应用广泛，但核心账务层仍保留大型机。",
      },
    },
    {
      icon: "brain",
      dimensionTitle: "AI 与分析",
      dimensionSubtitle: "AI & Analytics",
      chinaTitle: "消费端应用普及",
      chinaDetail: {
        lead: "人脸识别、",
        highlight: "极速信贷",
        tail: "与智能推荐广泛落地，训练数据规模大。",
      },
      usTitle: "企业级风控与量化",
      usDetail: {
        lead: "深耕",
        highlight: "MLOps",
        tail: " 与量化交易，在复杂衍生品定价上保持领先。",
      },
    },
    {
      icon: "regtech",
      dimensionTitle: "合规科技",
      dimensionSubtitle: "RegTech",
      chinaTitle: "大数据实时监测",
      chinaDetail: {
        lead: "侧重",
        highlight: "资金流向",
        tail: "监控，反洗钱规则迭代速度快。",
      },
      usTitle: "模型验证与制裁筛查",
      usDetail: {
        lead: "强调",
        highlight: "模型风险管理",
        tail: "，全球制裁名单筛查与审计链路更成熟。",
      },
    },
    {
      icon: "security",
      dimensionTitle: "网络安全",
      dimensionSubtitle: "Cybersecurity",
      chinaTitle: "数据主权与隐私计算",
      chinaDetail: {
        lead: "推行",
        highlight: "数据本地化",
        tail: "，多方安全计算在跨机构共享中更活跃。",
      },
      usTitle: "零信任架构 (Zero Trust)",
      usDetail: {
        lead: "防御边界持续弱化，身份认证与",
        highlight: "威胁情报",
        tail: "体系高度工业化。",
      },
    },
  ]),
  footerText: z.string().min(2).max(160).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(8).default("13"),
});

export const layoutId = "china-us-fintech-capabilities";
export const layoutName = "China US Fintech Capabilities";
export const layoutDescription =
  "A component-oriented China-US fintech comparison slide with mirrored capability cards and reusable dimension tiles.";
export const layoutTags = ["comparison", "cn-us", "fintech", "componentized"];
export const layoutRole = "comparison";
export const contentElements = ["country-comparison-cards", "dimension-tiles"];
export const useCases = ["capability-comparison", "cn-us-benchmark", "digital-maturity"];
export const suitableFor =
  "Suitable for bilateral comparison slides that need mirrored qualitative cards around a stable center dimension column.";
export const avoidFor =
  "Avoid using this layout for chart-first comparisons, very long narrative paragraphs, or dense numeric tables.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const CountryBadge = ({
  label,
  country,
}: {
  label: string;
  country: "cn" | "us";
}) => {
  const isChina = country === "cn";
  const backgroundColor = isChina ? redFinanceTheme.colors.primary : "#1565C0";
  const shadowColor = isChina ? "rgba(183,28,28,0.16)" : "rgba(21,101,192,0.16)";

  return (
    <div
      className="inline-flex h-[34px] items-center gap-[8px] rounded-[9px] px-[12px] text-[13px] font-black"
      style={{
        backgroundColor,
        color: "#FFFFFF",
        boxShadow: `0 4px 10px ${shadowColor}`,
      }}
    >
      <FinanceIcon
        name={isChina ? "flag" : "globe"}
        className="h-[15px] w-[15px]"
        stroke="#FFFFFF"
      />
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
};

const HighlightedDetail = ({
  detail,
  accentColor,
}: {
  detail: z.infer<typeof detailSchema>;
  accentColor: string;
}) => (
  <span>
    <span>{detail.lead}</span>
    <span style={{ color: accentColor, fontWeight: 700 }}>{detail.highlight}</span>
    <span>{detail.tail}</span>
  </span>
);

const ChinaUsFintechCapabilities = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const rowCount = parsed.rows.length;
  const rowGap = rowCount >= 7 ? 6 : rowCount >= 6 ? 8 : rowCount === 5 ? 10 : 14;
  const rowMinHeight = rowCount >= 7 ? 54 : rowCount >= 6 ? 62 : rowCount === 5 ? 72 : 84;
  const dimensionDensity = rowCount >= 6 ? "dense" : "compact";
  const dimensionIconSize = rowCount >= 6 ? 30 : 34;
  const dimensionTitleFontSize = rowCount >= 6 ? 10 : 11;
  const dimensionCardPadding = rowCount >= 6 ? 8 : 10;

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="microchip" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={138}
      contentHeight={516}
      contentBottomInset={8}
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between pb-[4px]">
          <div className="flex flex-1 justify-start">
            <CountryBadge label={parsed.chinaLabel} country="cn" />
          </div>
          <div className="flex w-[174px] flex-none justify-center">
            <div
              className="text-[12px] font-bold"
              style={{ color: redFinanceTheme.colors.mutedText }}
            >
              {parsed.dimensionLabel}
            </div>
          </div>
          <div className="flex flex-1 justify-end">
            <CountryBadge label={parsed.usLabel} country="us" />
          </div>
        </div>

        <div className="mb-[8px] flex gap-[4px]">
          {Array.from({ length: 28 }).map((_, index) => (
            <div
              key={index}
              className="h-[2px] flex-1 rounded-full"
              style={{ backgroundColor: "#E6E6E6" }}
            />
          ))}
        </div>

        <div
          className="grid min-h-0 flex-1"
          style={{
            gap: rowGap,
            gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
          }}
        >
          {parsed.rows.map((row, index) => (
            <div
              key={`${row.dimensionTitle}-${index}`}
              className="grid h-full min-h-0 items-stretch gap-[16px]"
              style={{ gridTemplateColumns: "1fr 190px 1fr" }}
            >
              <HorizontalFeatureCard
                className="h-full"
                title={row.chinaTitle}
                description={(
                  <HighlightedDetail
                    detail={row.chinaDetail}
                    accentColor={redFinanceTheme.colors.primary}
                  />
                )}
                density="dense"
                minHeight={rowMinHeight}
                railColor={redFinanceTheme.colors.primary}
                railSide="right"
                contentAlign="right"
                cardBackgroundColor="#FFEEF0"
                borderColor="#F7D8DD"
                descriptionColor={redFinanceTheme.colors.mutedText}
                shadow="0 4px 10px rgba(183,28,28,0.05)"
              />

              <IconTextCard
                className="h-full"
                icon={row.icon}
                titleLines={[row.dimensionTitle, row.dimensionSubtitle]}
                topAccent={false}
                density={dimensionDensity}
                minHeight={rowMinHeight}
                iconSize={dimensionIconSize}
                iconShape="circle"
                titleFontSize={dimensionTitleFontSize}
                descriptionFontSize={10}
                cardPaddingX={dimensionCardPadding}
                cardPaddingTop={dimensionCardPadding}
                cardPaddingBottom={dimensionCardPadding}
                shadow="0 4px 10px rgba(0,0,0,0.035)"
                cardBackgroundColor="#FFFFFF"
                cardBorderColor="#F0F0F0"
                borderRadius={12}
                iconBackgroundColor="#FAFAFA"
                accentColor={redFinanceTheme.colors.backgroundText}
              />

              <HorizontalFeatureCard
                className="h-full"
                title={row.usTitle}
                description={(
                  <HighlightedDetail
                    detail={row.usDetail}
                    accentColor="#1565C0"
                  />
                )}
                density="dense"
                minHeight={rowMinHeight}
                railColor="#1565C0"
                railSide="left"
                contentAlign="left"
                cardBackgroundColor="#EAF4FF"
                borderColor="#D3E7FB"
                descriptionColor={redFinanceTheme.colors.mutedText}
                shadow="0 4px 10px rgba(21,101,192,0.05)"
              />
            </div>
          ))}
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default ChinaUsFintechCapabilities;
