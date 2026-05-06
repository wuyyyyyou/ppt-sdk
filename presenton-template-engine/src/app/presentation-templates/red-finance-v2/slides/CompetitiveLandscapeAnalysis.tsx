import React from "react";
import * as z from "zod";

import ComparisonMatrixTable from "../components/ComparisonMatrixTable.js";
import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import InfoListItem from "../components/InfoListItem.js";
import ShortInfoCard from "../components/ShortInfoCard.js";
import { redFinanceTheme } from "../theme/tokens.js";

const participantIconSchema = z.enum([
  "bank",
  "smartphone",
  "grid",
  "globe",
]);

const participantSchema = z.object({
  icon: participantIconSchema,
  title: z.string().min(2).max(32),
  description: z.string().min(4).max(40),
});

const forceIconSchema = z.enum([
  "users",
  "shuffle",
  "user-plus",
  "route",
]);

const forceSchema = z.object({
  icon: forceIconSchema,
  title: z.string().min(2).max(24),
  level: z.string().min(1).max(8),
  description: z.string().min(8).max(56),
});

const comparisonRowSchema = z.object({
  dimension: z.string().min(1).max(20),
  traditionalLead: z.string().min(1).max(44),
  traditionalSupport: z.string().max(56).default(""),
  techLead: z.string().min(1).max(44),
  techSupport: z.string().max(56).default(""),
  winningLead: z.string().min(1).max(44),
  winningSupport: z.string().max(56).default(""),
});

export const Schema = z.object({
  title: z.string().min(2).max(30).default("竞争格局分析"),
  metaLabel: z.string().min(2).max(40).default("COMPETITIVE LANDSCAPE"),
  participantsTitle: z.string().min(2).max(28).default("主要市场参与者"),
  participants: z.array(participantSchema).min(2).max(6).default([
    { icon: "bank", title: "传统银行/保险", description: "牌照/资本/网点优势" },
    { icon: "smartphone", title: "互联网巨头", description: "流量/场景/体验优势" },
    { icon: "grid", title: "FinTech 公司", description: "垂直领域技术创新" },
    { icon: "globe", title: "外资金融机构", description: "跨境/高端财富管理" },
  ]),
  forcesTitle: z.string().min(2).max(28).default("波特五力分析"),
  forces: z.array(forceSchema).min(2).max(6).default([
    { icon: "users", title: "同业竞争", level: "高", description: "存量博弈加剧，息差收窄，产品同质化严重。" },
    { icon: "shuffle", title: "替代品威胁", level: "高", description: "第三方支付、网络理财分流传统渠道流量。" },
    { icon: "user-plus", title: "客户议价能力", level: "高", description: "信息透明度提升，客户转换成本降低。" },
    { icon: "route", title: "潜在进入者", level: "中", description: "牌照监管壁垒高，但技术与场景渗透增强。" },
  ]),
  comparisonTitle: z.string().min(4).max(40).default("竞争焦点与差异化路径对比"),
  columns: z
    .object({
      dimension: z.string().min(1).max(20).default("竞争维度"),
      traditional: z.string().min(2).max(24).default("传统金融机构"),
      tech: z.string().min(2).max(24).default("互联网/科技巨头"),
      winning: z.string().min(2).max(24).default("差异化制胜路径"),
    })
    .default({
      dimension: "竞争维度",
      traditional: "传统金融机构",
      tech: "互联网/科技巨头",
      winning: "差异化制胜路径",
    }),
  comparisonRows: z.array(comparisonRowSchema).min(3).max(6).default([
    {
      dimension: "客户获取",
      traditionalLead: "依赖线下网点与存量转化",
      traditionalSupport: "获客成本高，增长放缓",
      techLead: "高频生活场景流量变现",
      techSupport: "流量垄断，获客成本低",
      winningLead: "公私联动与场景嵌入",
      winningSupport: "深耕 B 端产业链，批量获取 C 端",
    },
    {
      dimension: "产品创新",
      traditionalLead: "标准化、严监管产品为主",
      traditionalSupport: "迭代周期长，信誉度高",
      techLead: "碎片化、定制化理财/信贷",
      techSupport: "迭代快，聚焦长尾需求",
      winningLead: "综合金融与财富管理",
      winningSupport: "投行、商行、私行的一体化服务",
    },
    {
      dimension: "风险控制",
      traditionalLead: "抵押担保，强资本约束",
      traditionalSupport: "风控严谨，覆盖面有限",
      techLead: "大数据信用风控",
      techSupport: "数据驱动，信用下沉",
      winningLead: "智能风控与周期管理",
      winningSupport: "AI 模型与专家经验的混合模式",
    },
    {
      dimension: "服务体验",
      traditionalLead: "低频、严肃、流程繁琐",
      traditionalSupport: "人际信任感强",
      techLead: "高频、极致便捷、交互强",
      techSupport: "缺乏深度咨询服务",
      winningLead: "全渠道与有温度的智能",
      winningSupport: "线上便捷交易，线下复杂咨询",
    },
  ]),
  footerText: z.string().min(4).max(120).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(6).default("07"),
});

export const layoutId = "competitive-landscape-analysis";
export const layoutName = "Competitive Landscape Analysis";
export const layoutDescription =
  "A component-oriented competition slide with reusable short cards, a force-analysis list, and a flexible comparison matrix table.";
export const layoutTags = ["competition", "landscape", "table", "componentized"];
export const layoutRole = "content";
export const contentElements = ["participant-cards", "force-analysis", "comparison-table"];
export const useCases = ["competitive-landscape", "market-mapping", "strategic-comparison"];
export const suitableFor =
  "Suitable for competition, positioning, and differentiation slides that need both qualitative mapping and a structured comparison matrix.";
export const avoidFor =
  "Avoid using this layout for chart-first slides, long narrative chapters, or deep process explanations.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const SectionHeading = ({ title }: { title: string }) => (
  <div className="mb-[8px] flex items-center gap-[10px]">
    <div
      className="h-[22px] w-[4px] rounded-full"
      style={{ backgroundColor: redFinanceTheme.colors.primary }}
    />
    <h2
      className="text-[18px] font-bold"
      style={{ color: redFinanceTheme.colors.backgroundText }}
    >
      {title}
    </h2>
  </div>
);

const getForceLevelStyles = (level: string) => {
  if (level.includes("高") || /high/i.test(level)) {
    return { backgroundColor: "#FFCDD2", color: "#B71C1C" };
  }
  if (level.includes("低") || /low/i.test(level)) {
    return { backgroundColor: "#E8F5E9", color: "#2E7D32" };
  }
  return { backgroundColor: "#FFE0B2", color: "#E65100" };
};

const CompetitiveLandscapeAnalysis = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const participantDensity =
    parsed.participants.length > 3 ? "dense" : "compact";
  const forceDensity = "compact";
  const matrixDensity =
    parsed.comparisonRows.length > 5
      ? "dense"
      : parsed.comparisonRows.length > 4
        ? "compact"
        : "normal";

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="chess" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={154}
      contentHeight={516}
    >
      <div className="flex h-full gap-[28px] overflow-hidden">
        <div className="flex w-[360px] flex-none flex-col">
          <div className="mb-[8px]">
            <SectionHeading title={parsed.participantsTitle} />
            <div className="grid grid-cols-2 gap-[6px]">
              {parsed.participants.map((item, index) => (
                <ShortInfoCard
                  key={`${item.title}-${index}`}
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  topAccent={false}
                  density={participantDensity}
                  descriptionMaxLines={1}
                />
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <SectionHeading title={parsed.forcesTitle} />
            <div
              className="grid min-h-0 flex-1 overflow-hidden rounded-[8px] border px-[14px] py-[8px]"
              style={{
                gridTemplateRows: `repeat(${parsed.forces.length}, minmax(0, 1fr))`,
                backgroundColor: redFinanceTheme.colors.background,
                borderColor: redFinanceTheme.colors.stroke,
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              {parsed.forces.map((item, index) => (
                <InfoListItem
                  key={`${item.title}-${index}`}
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  density={forceDensity}
                  descriptionMaxLines={2}
                  showDivider={index < parsed.forces.length - 1}
                  fillHeight
                  titleSuffix={
                    <div
                      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] px-[5px] text-[11px] font-bold leading-none"
                      style={getForceLevelStyles(item.level)}
                    >
                      {item.level}
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <SectionHeading title={parsed.comparisonTitle} />
          <div className="min-h-0 flex-1 overflow-hidden">
            <ComparisonMatrixTable
              density={matrixDensity}
              dimensionHeader={parsed.columns.dimension}
              columns={[
                { label: parsed.columns.traditional, width: 200 },
                { label: parsed.columns.tech, width: 200 },
                { label: parsed.columns.winning },
              ]}
              rows={parsed.comparisonRows.map((row) => ({
                dimension: row.dimension,
                cells: [
                  {
                    lead: row.traditionalLead,
                    support: row.traditionalSupport || undefined,
                  },
                  {
                    lead: row.techLead,
                    support: row.techSupport || undefined,
                  },
                  {
                    lead: row.winningLead,
                    support: row.winningSupport || undefined,
                    tone: "accent",
                  },
                ],
              }))}
            />
          </div>
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default CompetitiveLandscapeAnalysis;
