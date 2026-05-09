import React from "react";
import * as z from "zod";

import FinanceSectionFocusFrame from "../components/FinanceSectionFocusFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import HorizontalFeatureCard from "../components/HorizontalFeatureCard.js";
import { redFinanceTheme } from "../theme/tokens.js";

const PointIconSchema = z.enum(["grid", "shuffle", "chart-line", "route", "shield"]);

const PointSchema = z.object({
  title: z.string().min(2).max(32),
  description: z.string().min(4).max(90),
  tag: z.string().min(2).max(16).default("focus"),
  icon: PointIconSchema.default("grid"),
});

export const Schema = z.object({
  sectionNumber: z.string().min(1).max(3).default("01"),
  eyebrow: z.string().min(2).max(24).default("Architecture"),
  title: z.string().min(2).max(26).default("蓝图优先架构"),
  subtitle: z
    .string()
    .min(8)
    .max(96)
    .default("先确定表达结构、槽位和组件家族，再生成具体页面，降低不同 deck 之间的同质化。"),
  footerText: z.string().min(4).max(80).default("Red Finance V3 | Blueprint-first Baseline"),
  pageNumber: z.string().min(1).max(4).default("02"),
  variant: z.enum(["left-statement-right-cards", "minimal-statement"]).default("left-statement-right-cards"),
  density: z.enum(["low", "medium"]).default("medium"),
  points: z
    .array(PointSchema)
    .min(2)
    .max(4)
    .default([
      {
        title: "Blueprint catalog",
        description: "catalog 描述可用结构、适用内容类型和选择规则。",
        tag: "structure",
        icon: "grid",
      },
      {
        title: "Slot contract",
        description: "每个槽位声明允许的组件家族、密度范围和变体边界。",
        tag: "slots",
        icon: "shuffle",
      },
      {
        title: "Generic renderers",
        description: "slides 负责稳定渲染，业务主题由数据和蓝图实例驱动。",
        tag: "render",
        icon: "chart-line",
      },
    ]),
});

export const layoutId = "section-divider";
export const layoutName = "Section Divider";
export const layoutDescription =
  "A blueprint-first finance section divider with editable section statement and reusable feature cards.";
export const layoutTags = ["section", "divider", "finance", "blueprint-first"];
export const layoutRole = "section-divider";
export const contentElements = ["section-number", "headline", "subtitle", "feature-cards"];
export const useCases = ["section-divider", "transition", "framework-introduction"];
export const suitableFor =
  "Suitable for separating major sections, introducing an analytical frame, or switching topics in a formal finance deck.";
export const avoidFor =
  "Avoid using this layout for detailed comparisons, dense tables, KPI dashboards, or chart-heavy analysis.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const SectionDivider = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const showCards = parsed.variant === "left-statement-right-cards";
  const titleFontSize = parsed.density === "low" ? 70 : 64;

  return (
    <FinanceSectionFocusFrame
      leftWidth={showCards ? 560 : 780}
      columnGap={showCards ? 76 : 0}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      leftContent={
        <div className="flex h-full flex-col justify-center">
          <div
            className="mb-[24px] flex h-[72px] w-[72px] items-center justify-center rounded-[6px] text-[34px] font-black leading-none"
            style={{
              color: redFinanceTheme.colors.primaryText,
              backgroundColor: redFinanceTheme.colors.primary,
            }}
          >
            {parsed.sectionNumber}
          </div>
          <div
            className="mb-[18px] flex items-center gap-[12px] text-[16px] font-black uppercase leading-none"
            style={{ color: redFinanceTheme.colors.primary }}
          >
            <FinanceIcon name="compass" className="h-[22px] w-[22px]" />
            {parsed.eyebrow}
          </div>
          <div
            className="mb-[26px] text-[64px] font-black leading-[1.04]"
            style={{ color: redFinanceTheme.colors.backgroundText, fontSize: titleFontSize }}
          >
            {parsed.title}
          </div>
          <div
            className="w-[510px] text-[22px] font-medium leading-[1.45]"
            style={{ color: redFinanceTheme.colors.mutedText }}
          >
            {parsed.subtitle}
          </div>
        </div>
      }
      rightContent={
        showCards ? (
        <div className="flex h-full flex-col justify-center gap-[18px]">
          {parsed.points.map((point, index) => (
            <HorizontalFeatureCard
              key={`${point.title}-${index}`}
              title={point.title}
              description={point.description}
              iconName={point.icon}
              tag={point.tag}
              tone={index === 0 ? "accent" : "default"}
              minHeight={112}
              titleFontSize={18}
              descriptionFontSize={14}
              descriptionLineHeight={1.45}
            />
          ))}
        </div>
        ) : (
          <div />
        )
      }
    />
  );
};

export default SectionDivider;
