import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import IconText from "../components/IconText.js";
import KpiMetricItem from "../components/KpiMetricItem.js";
import StrategyPillarCard from "../components/StrategyPillarCard.js";

const strategyItemSchema = z.object({
  lead: z.string().min(1).max(24),
  body: z.string().min(4).max(120),
});

const strategyPanelSchema = z.object({
  number: z.string().min(1).max(4),
  icon: z.enum(["compass", "database", "network"]),
  title: z.string().min(2).max(24),
  items: z.array(strategyItemSchema).min(1).max(4),
});

const metricItemSchema = z.object({
  value: z.string().min(1).max(16),
  name: z.string().min(2).max(36),
});

export const Schema = z.object({
  title: z.string().min(4).max(24).default("银行业数字化转型"),
  metaLabel: z.string().min(4).max(40).default("DIGITAL TRANSFORMATION"),
  introText: z
    .string()
    .min(20)
    .max(180)
    .default(
      "为应对数字经济时代的挑战，银行需构建以客户为中心的“3+1”转型策略体系，从顶层设计、数据底座到前台运营进行全面重塑，实现业务模式的根本性变革。",
    ),
  panels: z.array(strategyPanelSchema).min(1).max(4).default([
    {
      number: "01",
      icon: "compass",
      title: "目标蓝图",
      items: [
        { lead: "端到端数字化", body: "重塑客户旅程，打通前中后台断点，实现全流程在线化。" },
        { lead: "业技融合", body: "业务架构与 IT 架构深度融合，消除部门壁垒，提升响应速度。" },
        { lead: "敏捷组织", body: "建立跨职能敏捷小组，推动产品快速迭代与创新。" },
      ],
    },
    {
      number: "02",
      icon: "database",
      title: "数据与治理",
      items: [
        { lead: "统一数据平台", body: "打破数据孤岛，构建湖仓一体的实时数据底座。" },
        { lead: "主数据治理", body: "建立全行级数据标准体系，确保数据资产的高质量与可用性。" },
        { lead: "安全与隐私", body: "强化数据全生命周期安全管理，合规应用隐私计算技术。" },
      ],
    },
    {
      number: "03",
      icon: "network",
      title: "运营与渠道",
      items: [
        { lead: "全渠道无缝体验", body: "实现线上线下渠道协同，保证一致的服务体验与品牌形象。" },
        { lead: "智能营销决策", body: "基于 AI 模型的实时客户洞察，实现千人千面的精准营销。" },
        { lead: "流程自动化", body: "大规模应用 RPA 与智能流程挖掘，大幅降低运营成本。" },
      ],
    },
  ]),
  metricsLabel: z.string().min(4).max(32).default("成功衡量指标 (KPIs)"),
  metrics: z.array(metricItemSchema).min(1).max(6).default([
    { value: "60%+", name: "数字渠道渗透率" },
    { value: "<35%", name: "成本收入比 (CIR)" },
    { value: "55+", name: "净推荐值 (NPS)" },
    { value: "25%", name: "IT投入年均增长" },
  ]),
  footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(2).max(4).default("05"),
});

export const layoutId = "banking-digital-transformation";
export const layoutName = "Banking Digital Transformation";
export const layoutDescription =
  "A component-oriented transformation slide with an intro note, adaptive strategy pillar cards, and a KPI summary strip.";
export const layoutTags = ["transformation", "strategy", "kpi", "componentized"];
export const layoutRole = "content";
export const contentElements = ["intro-note", "pillar-cards", "kpi-strip"];
export const useCases = ["digital-transformation", "strategy-pillars", "capability-upgrade"];
export const suitableFor =
  "Suitable for strategy, transformation, and capability-building slides that need a short narrative, several action pillars, and measurable targets.";
export const avoidFor =
  "Avoid using this layout for dense process diagrams, detailed technical architectures, or data-heavy chart pages.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const BankingDigitalTransformation = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const panelCount = parsed.panels.length;
  const panelGap = panelCount >= 4 ? 20 : 30;
  const metricWrapClass =
    parsed.metrics.length > 4
      ? "flex flex-1 flex-wrap items-center justify-end gap-x-[28px] gap-y-[10px]"
      : "flex flex-1 flex-wrap items-center justify-end gap-[40px]";

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="laptop-code" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={156}
      contentHeight={514}
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="relative mb-[20px] max-w-[920px] pl-[16px]">
          <div
            className="absolute bottom-0 left-0 top-0 w-[4px] rounded-full"
            style={{ backgroundColor: "#FFEBEE" }}
          />
          <p
            className="text-[15px] leading-[1.5]"
            style={{ color: "var(--text-muted,#616161)" }}
          >
            {parsed.introText}
          </p>
        </div>

        <div
          className="mb-[14px] grid min-h-0 flex-1"
          style={{
            gap: `${panelGap}px`,
            gridTemplateColumns: `repeat(${panelCount}, minmax(0, 1fr))`,
          }}
        >
          {parsed.panels.map((panel) => (
            <StrategyPillarCard
              key={panel.number}
              number={panel.number}
              icon={panel.icon}
              title={panel.title}
              items={panel.items}
            />
          ))}
        </div>

        <div
          className="mt-auto flex items-center gap-[18px] rounded-[8px] border px-[24px] py-[12px]"
          style={{
            backgroundColor: "#FAFAFA",
            borderColor: "var(--stroke,#E5E7EB)",
          }}
        >
          <div className="flex-none">
            <IconText
              icon={<FinanceIcon name="chart-column" className="h-[18px] w-[18px]" />}
              label={parsed.metricsLabel}
              height={24}
              iconSize={18}
              gap={8}
              fontSize={13}
              fontWeight={700}
              textColor="var(--background-text,#212121)"
            />
          </div>

          <div className={metricWrapClass}>
            {parsed.metrics.map((metric) => (
              <KpiMetricItem
                key={`${metric.name}-${metric.value}`}
                value={metric.value}
                label={metric.name}
              />
            ))}
          </div>
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default BankingDigitalTransformation;
