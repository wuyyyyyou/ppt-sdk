import React from "react";
import * as z from "zod";

import ChartCardShell from "../components/ChartCardShell.js";
import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import FinanceRadarChart from "../components/FinanceRadarChart.js";
import InsightCallout from "../components/InsightCallout.js";
import MeasuredChartArea from "../components/MeasuredChartArea.js";
import PillarBulletCard from "../components/PillarBulletCard.js";
import { redFinanceTheme } from "../theme/tokens.js";

const riskSeriesSchema = z.object({
  label: z.string().min(2).max(24),
  color: z.string().min(4).max(20),
  fillColor: z.string().min(4).max(32).optional(),
  dashed: z.boolean().default(false),
  values: z.array(z.number().min(0).max(100)).min(5).max(8),
});

const pillarItemSchema = z.object({
  lead: z.string().min(1).max(24),
  body: z.string().min(4).max(120),
});

const pillarSchema = z.object({
  number: z.string().min(1).max(4).optional(),
  icon: z.enum(["briefcase", "coins", "robot", "shield"]),
  title: z.string().min(2).max(28),
  items: z.array(pillarItemSchema).min(2).max(4),
});

export const Schema = z.object({
  title: z.string().min(2).max(30).default("风险管理与合规"),
  metaLabel: z.string().min(4).max(40).default("RISK MANAGEMENT & COMPLIANCE"),
  riskMapTitle: z.string().min(2).max(24).default("全面风险全景图谱"),
  riskMapSubtitle: z.string().min(2).max(28).default("2026 风险热度分布"),
  radarLabels: z.array(z.string().min(2).max(12)).min(5).max(8).default([
    "信用风险",
    "市场风险",
    "流动性风险",
    "操作风险",
    "网络安全",
    "模型风险",
    "合规风险",
  ]),
  radarSeries: z.array(riskSeriesSchema).min(1).max(3).default([
    {
      label: "2026 风险关注度",
      color: "#B71C1C",
      fillColor: "rgba(183, 28, 28, 0.14)",
      dashed: false,
      values: [80, 75, 65, 70, 95, 90, 85],
    },
    {
      label: "2023 基准",
      color: "#9E9E9E",
      fillColor: "rgba(158, 158, 158, 0.08)",
      dashed: true,
      values: [85, 70, 75, 60, 65, 50, 70],
    },
  ]),
  radarTicks: z.array(z.number().min(0).max(100)).min(3).max(6).default([
    20, 40, 60, 80, 100,
  ]),
  insightBody: z
    .string()
    .min(12)
    .max(140)
    .default("随着数字化深入，网络安全与模型风险显著上升，已成为与传统信用风险并列的一级管控重点。"),
  pillarsTitle: z.string().min(2).max(24).default("风险治理四大支柱"),
  pillars: z.array(pillarSchema).min(3).max(4).default([
    {
      number: "01",
      icon: "briefcase",
      title: "前瞻性管理",
      items: [
        { lead: "压力测试", body: "建立宏观下行与极端波动场景库，系统检验资产组合韧性。" },
        { lead: "早期预警", body: "利用高频数据构建违约与市场异动指标，前移风险识别窗口。" },
        { lead: "拨备策略", body: "基于 ECL 模型动态调整拨备覆盖率，平衡风险暴露与盈利质量。" },
      ],
    },
    {
      number: "02",
      icon: "coins",
      title: "资产负债管理 (ALM)",
      items: [
        { lead: "流动性管控", body: "强化 LCR / NSFR 监控，优化资产负债期限与结构匹配。" },
        { lead: "利率风险", body: "应对利率市场化波动，结合久期管理与对冲工具稳定净息差。" },
        { lead: "资本规划", body: "确保核心一级资本充足率满足巴塞尔协议 III 最终版要求。" },
      ],
    },
    {
      number: "03",
      icon: "robot",
      title: "AI 与模型治理",
      items: [
        { lead: "模型可解释性", body: "确保信贷与风控模型具备可解释性，支持审计复核与监管披露。" },
        { lead: "数据质量", body: "治理训练数据偏差，降低算法歧视与伦理风险，夯实模型输入基础。" },
        { lead: "全生命周期", body: "建立开发、验证、部署、监控到退役的闭环治理体系。" },
      ],
    },
    {
      number: "04",
      icon: "shield",
      title: "合规与反洗钱",
      items: [
        { lead: "智能合规", body: "利用 NLP 自动解读监管要求，并将规则嵌入制度与系统流程。" },
        { lead: "反洗钱 (AML)", body: "升级交易监测能力，重点关注虚拟资产与跨境资金流动。" },
        { lead: "数据合规", body: "严格遵守数据安全法与 GDPR，落实跨境数据流动评估机制。" },
      ],
    },
  ]),
  footerText: z.string().min(4).max(120).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(6).default("08"),
});

export const layoutId = "risk-management-compliance";
export const layoutName = "Risk Management Compliance";
export const layoutDescription =
  "A component-oriented risk slide with a reusable radar chart panel, a compact insight callout, and governance pillar cards.";
export const layoutTags = ["risk", "compliance", "radar-chart", "componentized"];
export const layoutRole = "content";
export const contentElements = ["radar-chart-panel", "insight-callout", "pillar-cards"];
export const useCases = ["risk-management", "compliance", "governance", "control-framework"];
export const suitableFor =
  "Suitable for risk, compliance, and governance slides that need a chart-first overview plus several structured action pillars.";
export const avoidFor =
  "Avoid using this layout for detailed process diagrams, very long policy text, or slides that need editable non-chart tables.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const SectionHeading = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) => (
  <div className="mb-[10px] flex items-end justify-between gap-[12px]">
    <div className="flex items-center gap-[10px]">
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
    {subtitle ? (
      <div
        className="whitespace-nowrap text-[12px]"
        style={{ color: redFinanceTheme.colors.subtleText }}
      >
        {subtitle}
      </div>
    ) : null}
  </div>
);

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

const RiskManagementCompliance = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const pillarCount = parsed.pillars.length;
  const pillarRows = pillarCount <= 2 ? 1 : 2;
  const pillarDensity =
    parsed.pillars.some((pillar) => pillar.items.length > 3 || pillar.title.length > 12)
      ? "compact"
      : "normal";
  const hasPillarOverflowRisk = parsed.pillars.some(
    (pillar) =>
      pillar.items.length >= 3 ||
      pillar.title.length > 8 ||
      pillar.items.some((item) => item.body.length > 26),
  );
  const pillarHeaderDensity = hasPillarOverflowRisk ? "tight" : "compact";
  const pillarTextScale = hasPillarOverflowRisk ? "xsmall" : "small";

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="shield" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={154}
      contentHeight={516}
    >
      <div className="flex h-full gap-[28px] overflow-hidden">
        <div className="flex w-[390px] flex-none flex-col">
          <ChartCardShell
            title={parsed.riskMapTitle}
            subtitle={parsed.riskMapSubtitle}
            className="h-[388px]"
            padding={16}
            headerMarginBottom={8}
          >
            <MeasuredChartArea minHeight={300} className="pt-[2px]">
              {({ width, height }) => (
                <FinanceRadarChart
                  labels={parsed.radarLabels}
                  series={parsed.radarSeries}
                  minValue={0}
                  maxValue={100}
                  ticks={parsed.radarTicks}
                  width={width}
                  height={height}
                  outerRadius={parsed.radarLabels.length >= 8 ? "72%" : "76%"}
                  legendReserve={34}
                  radiusAxisWidth={18}
                  labelFontSize={10}
                  legend={
                    <div className="flex flex-wrap items-center justify-center gap-x-[20px] gap-y-[6px]">
                      {parsed.radarSeries.map((item) => (
                        <SeriesLegend
                          key={item.label}
                          label={item.label}
                          color={item.color}
                          dashed={item.dashed}
                        />
                      ))}
                    </div>
                  }
                />
              )}
            </MeasuredChartArea>
          </ChartCardShell>

          <div className="mt-[12px]">
            <InsightCallout text={parsed.insightBody} icon="lightbulb" density="compact" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <SectionHeading title={parsed.pillarsTitle} />
          <div
            className="grid min-h-0 flex-1"
            style={{
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gridTemplateRows: `repeat(${pillarRows}, minmax(0, 1fr))`,
              gap: "18px",
            }}
          >
            {parsed.pillars.map((pillar, index) => (
              <div key={`${pillar.title}-${index}`} className="min-h-0">
                <PillarBulletCard
                  number={pillar.number}
                  icon={pillar.icon}
                  title={pillar.title}
                  items={pillar.items}
                  density={pillarDensity}
                  titlePlacement="right"
                  showWatermark={false}
                  dividerStyle="dashed"
                  headerDensity={pillarHeaderDensity}
                  textScale={pillarTextScale}
                  dividerThickness={2}
                  dividerDash="10 6"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default RiskManagementCompliance;
