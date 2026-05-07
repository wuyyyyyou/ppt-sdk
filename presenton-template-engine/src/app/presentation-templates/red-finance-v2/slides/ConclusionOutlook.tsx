import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import IconTextCard from "../components/IconTextCard.js";
import SectionPanelShell from "../components/SectionPanelShell.js";
import { redFinanceTheme } from "../theme/tokens.js";

const conclusionCardSchema = z.object({
  icon: z.enum(["chart-line", "microchip", "shield"]),
  title: z.string().min(2).max(18),
  description: z.string().min(18).max(120),
});

const priorityItemSchema = z.object({
  title: z.string().min(2).max(24),
  description: z.string().min(10).max(96),
});

const successFactorIconSchema = z.enum(["flag", "database", "users"]);

const successFactorSchema = z.object({
  icon: successFactorIconSchema,
  titleLines: z.array(z.string().min(2).max(12)).min(1).max(2),
});

const nextStepSchema = z.object({
  action: z.string().min(6).max(32),
  timing: z.string().min(2).max(10),
});

export const Schema = z.object({
  title: z.string().min(2).max(24).default("总结与展望"),
  metaLabel: z.string().min(4).max(40).default("CONCLUSION & OUTLOOK"),
  conclusions: z.array(conclusionCardSchema).min(3).max(3).default([
    {
      icon: "chart-line",
      title: "非息驱动增强",
      description:
        "盈利模式正从传统息差依赖转向多元化收入结构，财富管理、资产托管与投行业务协同将持续抬升轻资本业务贡献。",
    },
    {
      icon: "microchip",
      title: "数字能力为底座",
      description:
        "数据治理与 AI 基础设施已从 IT 投入升级为增长引擎，全行级数据湖与智能中台将支撑精细运营和敏捷创新。",
    },
    {
      icon: "shield",
      title: "风控与合规并重",
      description:
        "在创新提速的同时，需要同步强化网络安全、模型风险与跨境合规能力，构建主动型、智能化的全面风险管理体系。",
    },
  ]),
  prioritiesTitle: z.string().min(2).max(28).default("未来12个月优先事项"),
  prioritiesTag: z.string().min(2).max(20).default("Priorities"),
  priorities: z.array(priorityItemSchema).min(2).max(4).default([
    {
      title: "数据治理攻坚战",
      description: "完成主数据标准统一，消除核心系统之间的数据孤岛，夯实经营分析与风控建模底座。",
    },
    {
      title: "AI场景规模化落地",
      description: "聚焦智能客服、信贷审批辅助与营销 Copilot 三个场景，形成可复制的规模化交付路径。",
    },
    {
      title: "大财富管理体系构建",
      description: "整合私行与投行资源，面向高净值客户推出定制化全权委托与综合资产配置服务。",
    },
  ]),
  successFactorsTitle: z.string().min(2).max(28).default("关键成功要素"),
  successFactorsTag: z.string().min(2).max(24).default("Key Success Factors"),
  successFactors: z.array(successFactorSchema).min(2).max(4).default([
    { icon: "flag", titleLines: ["一把手工程", "顶层推动"] },
    { icon: "database", titleLines: ["数据与IT", "治理能力"] },
    { icon: "users", titleLines: ["敏捷组织", "与人才"] },
  ]),
  nextStepsTitle: z.string().min(2).max(20).default("后续动作"),
  nextStepsTag: z.string().min(2).max(16).default("Next Steps"),
  nextSteps: z.array(nextStepSchema).min(2).max(4).default([
    { action: "明确首批数字化试点项目清单", timing: "T+1月" },
    { action: "确立季度关键里程碑与 KPI", timing: "T+2月" },
    { action: "建立战略执行闭环复盘机制", timing: "T+3月" },
  ]),
  footerText: z.string().min(4).max(120).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(6).default("10"),
});

export const layoutId = "conclusion-outlook";
export const layoutName = "Conclusion Outlook";
export const layoutDescription =
  "A component-oriented conclusion slide with reusable icon-text summary cards, dual section panels, and a closing next-step strip.";
export const layoutTags = ["conclusion", "summary", "next-steps", "componentized"];
export const layoutRole = "conclusion";
export const contentElements = ["summary-cards", "priority-panel", "success-factor-panel", "next-steps-strip"];
export const useCases = ["conclusion", "executive-summary", "next-steps"];
export const suitableFor =
  "Suitable for closing sections that need summary takeaways, priority actions, and a clear next-step message.";
export const avoidFor =
  "Avoid using this layout for detailed data analysis, agendas, or multi-stage process explanations.";
export const density = "medium";
export const visualWeight = "text-heavy";
export const editableTextPriority = "high";

const SectionHeader = ({
  title,
  tag,
  icon,
}: {
  title: string;
  tag?: string;
  icon: React.ReactNode;
}) => (
  <div className="mb-[14px]">
    <div className="flex items-center justify-between gap-[12px]">
      <div className="flex items-center gap-[10px]">
        <div
          className="flex h-[32px] w-[32px] flex-none items-center justify-center rounded-[10px]"
          style={{ backgroundColor: redFinanceTheme.colors.paleRed }}
        >
          {icon}
        </div>
        <h2
          className="text-[16px] font-bold leading-none"
          style={{ color: redFinanceTheme.colors.backgroundText }}
        >
          {title}
        </h2>
      </div>
      {tag ? (
        <div
          className="whitespace-nowrap text-[12px] font-medium leading-none"
          style={{ color: "#9E9E9E" }}
        >
          {tag}
        </div>
      ) : null}
    </div>
    <div className="mt-[10px] flex w-full gap-[4px]">
      {Array.from({ length: 18 }).map((_, index) => (
        <div
          key={index}
          className="flex-1 rounded-full"
          style={{ height: 2, backgroundColor: "#E2E2E2" }}
        />
      ))}
    </div>
  </div>
);

const PriorityListItem = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="flex items-start gap-[12px] rounded-[8px] px-[4px] py-[2px]">
    <div
      className="mt-[2px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full"
      style={{ backgroundColor: redFinanceTheme.colors.paleRed }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[12px] w-[12px]" fill="none">
        <path
          d="m6.8 12.3 3.2 3.1 7.2-7.4"
          stroke={redFinanceTheme.colors.primary}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <div className="min-w-0 flex-1">
      <div
        className="mb-[3px] text-[14px] font-bold leading-[1.25]"
        style={{ color: redFinanceTheme.colors.backgroundText }}
      >
        {title}
      </div>
      <div className="text-[12px] leading-[1.45]" style={{ color: redFinanceTheme.colors.mutedText }}>
        {description}
      </div>
    </div>
  </div>
);

const NextStepStrip = ({
  title,
  tag,
  steps,
}: {
  title: string;
  tag?: string;
  steps: Array<z.infer<typeof nextStepSchema>>;
}) => (
  <div
    className="relative flex h-[95px] items-center gap-[18px] overflow-hidden rounded-[12px] px-[24px] py-[16px]"
    style={{
      backgroundColor: "#2F2F2F",
      boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
    }}
  >
    <div
      className="absolute left-0 top-0 h-full w-[8px]"
      style={{ backgroundColor: redFinanceTheme.colors.primary }}
    />
    <div className="w-[186px] flex-none pl-[6px]">
      {tag ? (
        <div className="mb-[4px] text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: "#F29A9A" }}>
          {tag}
        </div>
      ) : null}
      <div className="text-[20px] font-bold leading-none" style={{ color: "#FFFFFF" }}>
        {title}
      </div>
    </div>

    <div className="flex min-w-0 flex-1 gap-[12px]">
      {steps.map((item) => (
        <div
          key={`${item.action}-${item.timing}`}
          className="flex min-w-0 flex-1 items-center gap-[10px] rounded-[10px] px-[12px] py-[12px]"
          style={{ backgroundColor: "rgba(255,255,255,0.07)" }}
        >
          <div
            className="flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full"
            style={{ backgroundColor: "#5A1D1D" }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[12px] w-[12px]" fill="none">
              <path
                d="m8 6 6 6-6 6"
                stroke="#EF5350"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium leading-[1.3]" style={{ color: "#FFFFFF" }}>
              {item.action}
            </div>
            <div className="mt-[5px]">
              <div
                className="inline-flex min-w-[56px] items-center justify-center rounded-full px-[8px] py-[3px] text-[11px] font-bold leading-none"
                style={{ backgroundColor: "rgba(239,83,80,0.16)", color: "#FFB2B0" }}
              >
                {item.timing}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ConclusionOutlook = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const conclusionDescriptionMaxLines = parsed.conclusions.some((item) => item.description.length > 54) ? 7 : 6;
  const successFactorDensity =
    parsed.successFactors.length >= 4 || parsed.successFactors.some((item) => item.titleLines.join("").length > 10)
      ? "dense"
      : "compact";

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="flag" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={154}
      contentHeight={516}
      contentBottomInset={4}
    >
      <div className="flex h-full flex-col gap-[12px] overflow-hidden">
        <div className="flex h-[184px] gap-[18px]">
          {parsed.conclusions.map((item, index) => (
            <IconTextCard
              key={`${item.title}-${index}`}
              icon={item.icon}
              title={item.title}
              description={item.description}
              topAccent
              variant="summary"
              align="left"
              density="normal"
              descriptionMaxLines={conclusionDescriptionMaxLines}
              cardPaddingX={22}
              cardPaddingTop={22}
              cardPaddingBottom={18}
              minHeight={184}
            />
          ))}
        </div>

        <div className="flex h-[212px] gap-[24px]">
          <SectionPanelShell className="h-full w-[642px] flex-none">
            <SectionHeader
              title={parsed.prioritiesTitle}
              tag={parsed.prioritiesTag}
              icon={<FinanceIcon name="calendar" className="h-[18px] w-[18px]" />}
            />
            <div className="flex flex-1 flex-col justify-between">
              {parsed.priorities.map((item) => (
                <PriorityListItem
                  key={item.title}
                  title={item.title}
                  description={item.description}
                />
              ))}
            </div>
          </SectionPanelShell>

          <SectionPanelShell className="min-w-0 flex-1">
            <SectionHeader
              title={parsed.successFactorsTitle}
              tag={parsed.successFactorsTag}
              icon={<FinanceIcon name="briefcase" className="h-[18px] w-[18px]" />}
            />
            <div className="grid flex-1 grid-cols-3 gap-[12px]">
              {parsed.successFactors.map((item, index) => (
                <IconTextCard
                  key={`${item.icon}-${index}`}
                  icon={item.icon}
                  titleLines={item.titleLines}
                  density={successFactorDensity}
                  topAccent={false}
                  iconShape="rounded"
                  iconBackgroundColor="#FFEBEE"
                />
              ))}
            </div>
          </SectionPanelShell>
        </div>

        <NextStepStrip
          title={parsed.nextStepsTitle}
          tag={parsed.nextStepsTag}
          steps={parsed.nextSteps}
        />
      </div>
    </FinanceContentFrame>
  );
};

export default ConclusionOutlook;
