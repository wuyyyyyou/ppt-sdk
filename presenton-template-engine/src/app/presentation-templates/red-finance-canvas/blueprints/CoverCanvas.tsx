import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import FinanceCanvas from "../components/FinanceCanvas.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import IconText from "../components/IconText.tsx";
import { redFinanceTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  brandName: z.string().min(2).max(80).default("GLOBAL FINANCE INSIGHTS"),
  canvasLabel: z.string().min(2).max(40).default("Cover Canvas"),
  title: z.string().min(2).max(42).default("Build a Distinct Opening"),
  subtitle: z
    .string()
    .min(4)
    .max(96)
    .default("Use this branded canvas as a starting point, then compose the cover from template components."),
  reportDate: z.string().min(2).max(32).default("2026"),
  presenter: z.string().min(2).max(48).default("Authoring Workspace"),
  showSlotGuides: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "cover-canvas";
export const layoutName = "Cover Canvas";
export const layoutDescription =
  "A minimal red finance cover canvas that provides brand framing and light slot guides for custom component composition.";
export const layoutTags = ["cover", "canvas", "finance", "component-first", "tsx-first"];
export const layoutRole = "cover";
export const contentElements = ["brand", "headline-slot", "subtitle-slot", "meta-slot", "decoration-slot"];
export const useCases = ["cover", "opening", "custom-composition", "executive-brief"];
export const suitableFor =
  "Suitable as a starting canvas for a custom cover when the final layout should be composed from reusable components instead of copied from a finished blueprint.";
export const avoidFor =
  "Avoid leaving this canvas unchanged in a final deck; it is an authoring base, not a finished production slide.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const guideStyle = {
  border: `1px dashed ${redFinanceTheme.colors.accentBorder}`,
  backgroundColor: redFinanceTheme.colors.accentTint,
} as const;

const CoverCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <FinanceCanvas>
      <div className="absolute left-0 top-[116px] h-[190px] w-[12px]" style={{ backgroundColor: redFinanceTheme.colors.accent }} />

      <div className="absolute left-[96px] right-[80px] top-[46px] z-20 flex items-center justify-between">
        <IconText
          icon={<FinanceIcon name="bank" className="h-7 w-7 flex-none" />}
          label={parsed.brandName}
          height={34}
          iconSize={28}
          gap={12}
          textWidth={560}
          fontSize={20}
          fontWeight={700}
        />
        <div className="text-[14px] font-black uppercase leading-none" style={{ color: redFinanceTheme.colors.accent }}>
          {parsed.canvasLabel}
        </div>
      </div>

      <div className="absolute left-[96px] top-[210px] z-10 w-[720px]">
        <div className="text-[70px] font-black leading-[0.98]" style={{ color: redFinanceTheme.colors.textPrimary }}>
          {parsed.title}
        </div>
        <div className="mt-[26px] w-[600px] text-[24px] font-medium leading-[1.38]" style={{ color: redFinanceTheme.colors.textMuted }}>
          {parsed.subtitle}
        </div>
      </div>

      {parsed.showSlotGuides ? (
        <div className="absolute right-[86px] top-[178px] z-10 flex h-[330px] w-[330px] items-center justify-center rounded-[8px]" style={guideStyle}>
          <div className="px-[36px] text-center text-[18px] font-black uppercase leading-[1.35]" style={{ color: redFinanceTheme.colors.accentMutedText }}>
            Compose cover visual here
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-[58px] left-[96px] z-10 flex items-center gap-[38px]">
        <IconText
          icon={<FinanceIcon name="calendar" className="h-[18px] w-[18px]" />}
          label={parsed.reportDate}
          minTextWidth={112}
        />
        <IconText
          icon={<FinanceIcon name="document" className="h-[18px] w-[18px]" />}
          label={parsed.presenter}
          minTextWidth={190}
        />
      </div>
    </FinanceCanvas>
  );
};

export default CoverCanvas;
