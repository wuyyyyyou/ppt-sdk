import React from "react";
import * as z from "zod";

import { CoverComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import ThemeCanvas from "../components/ThemeCanvas.tsx";
import ThemePanelShell from "../components/ThemePanelShell.tsx";
import ThemePill from "../components/ThemePill.tsx";
import { redBlueComparisonTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  eyebrow: z.string().min(2).max(32).default("Closing Canvas"),
  title: z.string().min(2).max(34).default("Thank You"),
  subtitle: z
    .string()
    .min(4)
    .max(120)
    .default("Use this low-density page for contact details, final framing, or next-step prompts."),
  primaryContact: z.string().min(2).max(60).default("contact@example.com"),
  secondaryContact: z.string().min(2).max(60).default("www.example.com"),
  showSlotGuides: z.boolean().default(true),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "closing-canvas";
export const layoutName = "Closing Canvas";
export const layoutDescription =
  "A low-density red-blue comparison closing canvas for final contact, thanks, or follow-up pages.";
export const layoutTags = ["closing", "canvas", "contact", "comparison", "component-first", "tsx-first"];
export const layoutRole = "closing";
export const contentElements = ["eyebrow", "closing-title", "subtitle", "contact-slot", "footer-slot"];
export const useCases = ["closing", "thank-you", "contact", "next-steps"];
export const suitableFor =
  "Suitable for final pages that need a polished low-density close while preserving the red-blue comparison language.";
export const avoidFor =
  "Avoid for analytical conclusions with dense recommendations, charts, or tables.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const ClosingCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <ThemeCanvas>
      {parsed.showDecorations ? <CoverComparisonDecorations /> : null}

      <div className="absolute left-[190px] top-[142px] z-10 w-[900px] text-center">
        <div className="mb-[28px] flex justify-center">
          <ThemePill tone="purple" width={210}>
            {parsed.eyebrow}
          </ThemePill>
        </div>
        <div className="text-[78px] font-black leading-none" style={{ color: redBlueComparisonTheme.colors.primary }}>
          {parsed.title}
        </div>
        <div className="mx-auto mt-[26px] w-[720px] text-[24px] font-medium leading-[1.42]" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
          {parsed.subtitle}
        </div>

        <div className="mt-[54px] flex justify-center">
          <ThemePanelShell className="flex w-[650px] items-center justify-center gap-[20px]" padding={18}>
            <ThemePill tone="red" width={270}>
              {parsed.primaryContact}
            </ThemePill>
            <ThemePill tone="blue" width={270}>
              {parsed.secondaryContact}
            </ThemePill>
          </ThemePanelShell>
        </div>

        {parsed.showSlotGuides ? (
          <div
            className="mx-auto mt-[30px] w-[520px] rounded-[8px] py-[14px] text-[14px] font-black uppercase leading-none"
            style={{
              color: redBlueComparisonTheme.colors.primary,
              backgroundColor: "rgba(245,243,255,0.78)",
              border: `1px dashed ${redBlueComparisonTheme.tone.purple.border}`,
            }}
          >
            Replace contact module or add concise next-step component
          </div>
        ) : null}
      </div>
    </ThemeCanvas>
  );
};

export default ClosingCanvas;
