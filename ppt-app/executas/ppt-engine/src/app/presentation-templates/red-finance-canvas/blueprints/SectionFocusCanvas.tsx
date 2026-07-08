import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import FinanceSectionFocusFrame from "../components/FinanceSectionFocusFrame.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import IconText from "../components/IconText.tsx";
import { redFinanceTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  sectionNumber: z.string().min(1).max(4).default("01"),
  eyebrow: z.string().min(2).max(28).default("Section Canvas"),
  title: z.string().min(2).max(34).default("Shape the Transition"),
  subtitle: z
    .string()
    .min(8)
    .max(110)
    .default("Use the focus frame for section dividers, strategic emphasis, or topic transitions with custom right-side components."),
  rightGuideTitle: z.string().min(2).max(40).default("Compose focus modules"),
  rightGuideText: z
    .string()
    .min(8)
    .max(120)
    .default("Replace this guide with cards, metrics, timelines, or a compact evidence module from components/."),
  footerText: z.string().min(4).max(80).default("Red Finance Canvas | Section Focus"),
  pageNumber: z.string().min(1).max(4).default("03"),
  showSlotGuides: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "section-focus-canvas";
export const layoutName = "Section Focus Canvas";
export const layoutDescription =
  "A minimal red finance section focus frame with a strong left statement area and a right-side component composition slot.";
export const layoutTags = ["section", "transition", "canvas", "finance", "component-first", "tsx-first"];
export const layoutRole = "section-divider";
export const contentElements = ["section-number", "headline", "subtitle", "focus-slot", "footer-meta"];
export const useCases = ["section-divider", "transition", "strategic-focus", "custom-composition"];
export const suitableFor =
  "Suitable for section dividers and focus pages where the right side should be tailored from existing finance components.";
export const avoidFor =
  "Avoid using it for dense charts, large matrices, or as an unchanged final slide.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const SectionFocusCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <FinanceSectionFocusFrame
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      leftContent={
        <div className="flex h-full flex-col justify-center">
          <div
            className="mb-[24px] flex h-[72px] w-[72px] items-center justify-center rounded-[6px] text-[34px] font-black leading-none"
            style={{
              color: redFinanceTheme.colors.accentText,
              backgroundColor: redFinanceTheme.colors.accent,
            }}
          >
            {parsed.sectionNumber}
          </div>
          <div className="mb-[18px]">
            <IconText
              icon={<FinanceIcon name="compass" className="h-[22px] w-[22px]" />}
              label={parsed.eyebrow.toUpperCase()}
              height={22}
              iconSize={22}
              gap={12}
              fontSize={16}
              fontWeight={900}
              textColor={redFinanceTheme.colors.accent}
            />
          </div>
          <div className="mb-[26px] text-[62px] font-black leading-[1.04]" style={{ color: redFinanceTheme.colors.textPrimary }}>
            {parsed.title}
          </div>
          <div className="w-[510px] text-[22px] font-medium leading-[1.45]" style={{ color: redFinanceTheme.colors.textMuted }}>
            {parsed.subtitle}
          </div>
        </div>
      }
      rightContent={
        parsed.showSlotGuides ? (
          <div className="flex h-full items-center">
            <div
              className="flex h-[360px] w-full items-center justify-center rounded-[8px]"
              style={{
                border: `1px dashed ${redFinanceTheme.colors.accentBorder}`,
                backgroundColor: redFinanceTheme.colors.accentTint,
              }}
            >
              <div className="px-[42px] text-center">
                <div className="text-[24px] font-black leading-none" style={{ color: redFinanceTheme.colors.accent }}>
                  {parsed.rightGuideTitle}
                </div>
                <div className="mt-[18px] text-[17px] font-medium leading-[1.5]" style={{ color: redFinanceTheme.colors.textMuted }}>
                  {parsed.rightGuideText}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div />
        )
      }
    />
  );
};

export default SectionFocusCanvas;
