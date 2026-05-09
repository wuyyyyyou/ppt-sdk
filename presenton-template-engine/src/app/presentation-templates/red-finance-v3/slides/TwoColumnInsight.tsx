import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import FinanceSectionHeading from "../components/FinanceSectionHeading.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import IconTextCard from "../components/IconTextCard.js";
import InfoListItem from "../components/InfoListItem.js";
import InsightCallout from "../components/InsightCallout.js";
import { redFinanceTheme } from "../theme/tokens.js";

const IconSchema = z.enum([
  "bank",
  "bolt",
  "brain",
  "chart-column",
  "chart-line",
  "chart-pie",
  "coins",
  "compass",
  "database",
  "document",
  "gavel",
  "grid",
  "laptop-code",
  "lightbulb",
  "microchip",
  "route",
  "shield",
  "wallet",
]);

const NarrativeItemSchema = z.object({
  icon: IconSchema,
  title: z.string().min(2).max(28),
  description: z.string().min(8).max(96),
});

const EvidenceCardSchema = z.object({
  icon: IconSchema,
  title: z.string().min(2).max(24),
  description: z.string().min(8).max(84),
  tag: z.string().min(2).max(18).default("evidence"),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("Two Column Insight"),
  metaLabel: z.string().min(2).max(48).default("BLUEPRINT / TWO COLUMN"),
  footerText: z.string().min(6).max(80).default("Red Finance V3 | Two Column Insight"),
  pageNumber: z.string().min(1).max(4).default("03"),
  variant: z.enum(["narrative-left-evidence-right", "evidence-left-narrative-right"]).default(
    "narrative-left-evidence-right",
  ),
  density: z.enum(["low", "medium", "high"]).default("medium"),
  narrativeTitle: z.string().min(2).max(28).default("核心判断"),
  narrativeSummary: z.string().min(8).max(96).default("左侧承载主判断和解释，右侧承载证据与补充信息。"),
  narrativeItems: z.array(NarrativeItemSchema).min(2).max(4).default([
    {
      icon: "lightbulb",
      title: "先给结论",
      description: "主叙事先给出判断，再用结构化条目逐层解释。",
    },
    {
      icon: "shield",
      title: "证据约束",
      description: "每页只承载少量证据，避免双栏同时变成大表格。",
    },
    {
      icon: "route",
      title: "导向清晰",
      description: "结尾用一条结论性 callout 收束，方便 Agent 接续下一页。",
    },
  ]),
  evidenceTitle: z.string().min(2).max(28).default("支撑证据"),
  evidenceCards: z.array(EvidenceCardSchema).min(2).max(4).default([
    {
      icon: "chart-column",
      title: "规模变化",
      description: "用简洁指标卡表达变化幅度和相对位置。",
      tag: "scale",
    },
    {
      icon: "bank",
      title: "结构差异",
      description: "将复杂事实拆成 2-4 张轻量卡片。",
      tag: "structure",
    },
    {
      icon: "coins",
      title: "经营信号",
      description: "避免塞入长文，把关键判断放在可编辑文本中。",
      tag: "signal",
    },
  ]),
  conclusion: z.string().min(8).max(120).default("适合先阐释观点，再用少量证据支撑判断的页面。"),
});

export const layoutId = "two-column-insight";
export const layoutName = "Two Column Insight";
export const layoutDescription =
  "A blueprint-first two-column slide with a primary narrative side and a compact evidence side.";
export const layoutTags = ["two-column", "insight", "analysis", "blueprint-first"];
export const layoutRole = "content";
export const contentElements = ["headline", "narrative-list", "evidence-cards", "callout"];
export const useCases = ["overview", "insight", "analysis", "explanation"];
export const suitableFor = "Suitable for pages that need one main argument and a small set of supporting facts.";
export const avoidFor = "Avoid using this layout for timelines, full comparison matrices, or pure KPI dashboards.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const TwoColumnInsight = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const isEvidenceFirst = parsed.variant === "evidence-left-narrative-right";
  const density = parsed.density === "low" ? "compact" : parsed.density === "high" ? "dense" : "normal";
  const cardColumns = parsed.density === "high" ? "grid-cols-2" : "grid-cols-1";

  const narrativePane = (
    <div className="flex h-full flex-col gap-[14px]">
      <FinanceSectionHeading title={parsed.narrativeTitle} subtitle={parsed.narrativeSummary} />
      <div className="flex flex-col gap-[2px]">
        {parsed.narrativeItems.map((item, index) => (
          <InfoListItem
            key={`${item.title}-${index}`}
            icon={item.icon}
            title={item.title}
            description={item.description}
            showDivider={index < parsed.narrativeItems.length - 1}
            density={density}
            textScale={parsed.density === "high" ? "small" : "normal"}
            descriptionMaxLines={parsed.density === "high" ? 2 : 3}
          />
        ))}
      </div>
      <InsightCallout text={parsed.conclusion} density={density} icon="lightbulb" />
    </div>
  );

  const evidencePane = (
    <div className="flex h-full flex-col gap-[14px]">
      <FinanceSectionHeading
        title={parsed.evidenceTitle}
        subtitle={parsed.variant === "narrative-left-evidence-right" ? "cards / metrics / compact evidence" : "evidence first"}
      />
      <div className={`grid ${cardColumns} gap-[12px]`}>
        {parsed.evidenceCards.map((card) => (
          <IconTextCard
            key={card.title}
            icon={card.icon}
            title={card.title}
            description={card.description}
            variant="compact"
            density={parsed.density === "high" ? "compact" : "normal"}
            align="left"
            descriptionMaxLines={3}
            cardPaddingX={14}
            cardPaddingTop={14}
            cardPaddingBottom={12}
            minHeight={118}
            iconBackgroundColor={redFinanceTheme.colors.paleRed}
          />
        ))}
      </div>
    </div>
  );

  return (
    <FinanceContentFrame
      title={parsed.title}
      metaIcon={<FinanceIcon name="bank" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={160}
      contentBottomInset={12}
    >
      <div className={`grid h-full min-h-0 gap-[24px] ${isEvidenceFirst ? "grid-cols-[1.08fr_0.92fr]" : "grid-cols-[0.98fr_1.02fr]"}`}>
        {isEvidenceFirst ? evidencePane : narrativePane}
        {isEvidenceFirst ? narrativePane : evidencePane}
      </div>
    </FinanceContentFrame>
  );
};

export default TwoColumnInsight;
