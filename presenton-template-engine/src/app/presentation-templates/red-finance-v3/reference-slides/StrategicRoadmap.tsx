import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import FinanceSectionHeading from "../components/FinanceSectionHeading.js";
import IconTextCard from "../components/IconTextCard.js";
import IconText from "../components/IconText.js";
import KpiMetricItem from "../components/KpiMetricItem.js";
import TimelineBoard from "../components/TimelineBoard.js";

const pillarIconSchema = z.enum(["customer", "pricing", "data", "ecosystem", "talent"]);

const pillarSchema = z.object({
  icon: pillarIconSchema,
  titleLines: z.array(z.string().min(2).max(10)).min(1).max(2),
});

const roadmapPhaseSchema = z.object({
  quarter: z.string().min(2).max(4),
  title: z.string().min(2).max(16),
  items: z.array(z.string().min(6).max(36)).min(2).max(4),
});

const roiMetricSchema = z.object({
  label: z.string().min(2).max(12),
  value: z.string().min(1).max(16),
  caption: z.string().min(2).max(24),
});

const kpiSchema = z.object({
  value: z.string().min(1).max(16),
  label: z.string().min(2).max(24),
});

export const Schema = z.object({
  title: z.string().min(2).max(24).default("战略规划与路线图"),
  metaLabel: z.string().min(4).max(40).default("STRATEGIC ROADMAP"),
  visionLabel: z.string().min(2).max(20).default("2026 战略愿景"),
  visionLines: z.array(z.string().min(2).max(20)).min(2).max(4).default([
    "稳增长 · 提效能",
    "优结构 · 强风控",
    "打造卓越客户体验",
  ]),
  pillarsTitle: z.string().min(2).max(20).default("五大战略支柱"),
  pillars: z.array(pillarSchema).min(4).max(6).default([
    { icon: "customer", titleLines: ["客户与品牌", "重塑"] },
    { icon: "pricing", titleLines: ["产品与定价", "优化"] },
    { icon: "data", titleLines: ["数字与数据", "驱动"] },
    { icon: "ecosystem", titleLines: ["生态与合作", "共赢"] },
    { icon: "talent", titleLines: ["组织与人才", "升级"] },
  ]),
  roadmapTitle: z.string().min(4).max(30).default("2026 执行路线图 (12个月)"),
  roadmapPhases: z.array(roadmapPhaseSchema).min(3).max(5).default([
    {
      quarter: "Q1",
      title: "基建与治理",
      items: ["启动统一数据湖建设", "成立数字化转型委员会", "完成核心系统云化评估"],
    },
    {
      quarter: "Q2",
      title: "试点与上线",
      items: ["发布智能营销 Copilot", "区块链平台 v1.0 上线", "完成 50 家网点改造"],
    },
    {
      quarter: "Q3",
      title: "扩围与优化",
      items: ["全面推广 RPA 自动化", "启动跨境支付实时结算", "发布 ESG 金融产品系列"],
    },
    {
      quarter: "Q4",
      title: "评估与迭代",
      items: ["完成年度战略 ROI 复盘", "优化 AI 风控模型参数", "制定 2027 深化改革方案"],
    },
  ]),
  roiTitle: z.string().min(2).max(20).default("投资与回报预期"),
  roiMetrics: z.array(roiMetricSchema).min(2).max(4).default([
    { label: "预算增幅", value: "15%", caption: "重点投向 AI 算力" },
    { label: "盈亏平衡", value: "18个月", caption: "由效率提升驱动" },
    { label: "三年 ROI", value: "250%", caption: "规模化落地兑现" },
  ]),
  kpiTitle: z.string().min(2).max(20).default("核心 KPI 框架"),
  kpis: z.array(kpiSchema).min(3).max(6).default([
    { value: "+18%", label: "非息收入增长" },
    { value: "<30%", label: "成本收入比" },
    { value: "1.85%", label: "风险调整收益率" },
    { value: "75%", label: "数字渠道活跃度" },
  ]),
  footerText: z.string().min(4).max(120).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(6).default("09"),
});

export const layoutId = "strategic-roadmap";
export const layoutName = "Strategic Roadmap";
export const layoutDescription =
  "A component-oriented roadmap slide with a vision block, lightweight strategy pillar cards, a stable timeline board, and KPI summaries.";
export const layoutTags = ["roadmap", "strategy", "timeline", "componentized"];
export const layoutRole = "timeline";
export const contentElements = ["vision-panel", "pillar-cards", "timeline-board", "kpi-summary"];
export const useCases = ["strategic-roadmap", "implementation-plan", "execution-plan"];
export const suitableFor =
  "Suitable for phased execution plans, transformation roadmaps, and strategy rollout pages with clear milestones and summary targets.";
export const avoidFor =
  "Avoid using this layout for deep process charts, chart-first analysis slides, or pages that mainly need editable comparison tables.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const resolvePillarIcon = (icon: z.infer<typeof pillarIconSchema>) => {
  switch (icon) {
    case "customer":
      return "user" as const;
    case "pricing":
      return "coins" as const;
    case "data":
      return "database" as const;
    case "ecosystem":
      return "network" as const;
    case "talent":
      return "users" as const;
  }
};

const StrategicRoadmap = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const pillarDensity =
    parsed.pillars.length >= 5 ? "dense" : "compact";
  const timelineDensity =
    parsed.roadmapPhases.length >= 5 ||
    parsed.roadmapPhases.some((phase) => phase.items.length >= 4 || phase.title.length > 8)
      ? "compact"
      : "normal";
  const kpiColumns = Math.min(parsed.kpis.length, 4);

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="route" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={154}
      contentHeight={516}
      contentBottomInset={0}
    >
      <div className="flex h-full flex-col gap-[10px] overflow-hidden">
        <div className="flex h-[148px] gap-[16px]">
          <div
            className="flex w-[300px] flex-none flex-col justify-center rounded-[12px] px-[22px] py-[18px]"
            style={{
              backgroundColor: "var(--primary-color,#B71C1C)",
              boxShadow: "0 8px 18px rgba(183,28,28,0.18)",
            }}
          >
            <div
              className="mb-[10px] text-[13px] font-bold uppercase tracking-[0.12em]"
              style={{ color: "rgba(255,255,255,0.88)" }}
            >
              {parsed.visionLabel}
            </div>
            <div className="flex flex-col gap-[6px]">
              {parsed.visionLines.map((line, index) => (
                <div
                  key={`${line}-${index}`}
                  className="text-[22px] font-black leading-[1.12]"
                  style={{ color: "#FFFFFF" }}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex min-w-0 flex-1 flex-col rounded-[12px] border px-[16px] py-[12px]"
            style={{ backgroundColor: "#FAFAFA", borderColor: "var(--stroke,#EEEEEE)" }}
          >
            <FinanceSectionHeading title={parsed.pillarsTitle} marginBottom={8} />
            <div
              className="grid min-h-0 flex-1 gap-[10px]"
              style={{
                gridTemplateColumns: `repeat(${parsed.pillars.length}, minmax(0, 1fr))`,
              }}
            >
              {parsed.pillars.map((pillar, index) => (
                <IconTextCard
                  key={`${pillar.titleLines.join("-")}-${index}`}
                  icon={resolvePillarIcon(pillar.icon)}
                  titleLines={pillar.titleLines}
                  topAccent={false}
                  density={pillarDensity}
                  iconBackgroundColor="#FFEBEE"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex h-[232px] min-h-0 flex-col">
          <FinanceSectionHeading title={parsed.roadmapTitle} />
          <div className="min-h-0 flex-1">
            <TimelineBoard
              phases={parsed.roadmapPhases.map((phase) => ({
                label: phase.quarter,
                title: phase.title,
                items: phase.items,
              }))}
              density={timelineDensity}
            />
          </div>
        </div>

        <div className="grid h-[96px] grid-cols-[350px_minmax(0,1fr)] gap-[18px]">
          <div
            className="flex flex-col rounded-[12px] border px-[14px] py-[12px]"
            style={{ backgroundColor: "#FAFAFA", borderColor: "var(--stroke,#EEEEEE)" }}
          >
            <IconText
              icon={<FinanceIcon name="coins" className="h-[18px] w-[18px]" />}
              label={parsed.roiTitle}
              height={24}
              iconSize={18}
              gap={8}
              fontSize={14}
              fontWeight={700}
              textColor="var(--background-text,#212121)"
            />
            <div className="mt-[8px] flex min-h-0 flex-1 items-stretch justify-between gap-[8px]">
              {parsed.roiMetrics.map((metric, index) => (
                <div key={`${metric.label}-${index}`} className="flex flex-1 items-stretch gap-[8px]">
                  <div className="flex flex-1 flex-col justify-center">
                    <div
                      className="mb-[4px] text-[11px] font-semibold uppercase tracking-[0.06em]"
                      style={{ color: "#9E9E9E" }}
                    >
                      {metric.label}
                    </div>
                    <div
                      className="mb-[2px] whitespace-nowrap text-[18px] font-black leading-none"
                      style={{ color: "var(--primary-color,#B71C1C)" }}
                    >
                      {metric.value}
                    </div>
                    <div className="text-[10px] leading-[1.2]" style={{ color: "var(--text-muted,#616161)" }}>
                      {metric.caption}
                    </div>
                  </div>
                  {index < parsed.roiMetrics.length - 1 ? (
                    <div
                      className="w-px flex-none self-stretch rounded-full"
                      style={{ backgroundColor: "#E5E5E5" }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex flex-col rounded-[12px] border px-[14px] py-[12px]"
            style={{ backgroundColor: "#FAFAFA", borderColor: "var(--stroke,#EEEEEE)" }}
          >
            <IconText
              icon={<FinanceIcon name="chart-column" className="h-[18px] w-[18px]" />}
              label={parsed.kpiTitle}
              height={24}
              iconSize={18}
              gap={8}
              fontSize={14}
              fontWeight={700}
              textColor="var(--background-text,#212121)"
            />
            <div
              className="mt-[8px] min-h-0 flex-1"
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: `repeat(${kpiColumns}, minmax(0, 1fr))`,
                alignItems: "center",
              }}
            >
              {parsed.kpis.map((metric) => (
                <div
                  key={`${metric.label}-${metric.value}`}
                  className="flex h-full items-center justify-center rounded-[8px] border px-[6px] py-[8px]"
                  style={{ backgroundColor: "#FFFFFF", borderColor: "var(--stroke,#EEEEEE)" }}
                >
                  <KpiMetricItem value={metric.value} label={metric.label} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default StrategicRoadmap;
