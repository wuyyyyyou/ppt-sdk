import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import { BalancedComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";
import ThemePanelShell from "../components/ThemePanelShell.tsx";
import ThemePill from "../components/ThemePill.tsx";
import { redBlueComparisonTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(34).default("Chart"),
  titleHighlight: z.string().min(2).max(34).default("Evidence Canvas"),
  subtitle: z
    .string()
    .min(8)
    .max(120)
    .default("Use the left area for a primary chart or visual evidence, and the right rail for interpretation."),
  footerText: z.string().min(4).max(80).default("Red Blue Comparison Canvas | Evidence"),
  pageNumber: z.string().min(1).max(4).default("04"),
  chartGuideTitle: z.string().min(2).max(48).default("Primary chart or evidence slot"),
  chartGuideText: z.string().min(8).max(140).default("Use ChartContainer with a chart module, or ImageShowcasePanel for one visual asset."),
  railGuideTitle: z.string().min(2).max(40).default("Interpretation rail"),
  railGuideText: z.string().min(8).max(140).default("Compose insight cards, KPI rows, source notes, or a compact comparison table."),
  showSlotGuides: z.boolean().default(true),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "chart-evidence-canvas";
export const layoutName = "Chart Evidence Canvas";
export const layoutDescription =
  "A red-blue comparison canvas for one primary chart or evidence visual plus a right-side interpretation area.";
export const layoutTags = ["chart", "evidence", "canvas", "comparison", "component-first", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "subtitle", "primary-visual-slot", "interpretation-slot", "footer-meta"];
export const useCases = ["chart analysis", "visual evidence", "image with interpretation", "chart plus insight rail"];
export const suitableFor =
  "Suitable when a page needs one dominant chart, image, or table evidence anchor with concise interpretation beside it.";
export const avoidFor =
  "Avoid for multi-chart dashboards, agenda pages, closing pages, or pages without a clear primary visual anchor.";
export const density = "medium";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const ChartEvidenceCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <ThemeContentFrame
      titlePrefix={parsed.titlePrefix}
      titleHighlight={parsed.titleHighlight}
      subtitle={parsed.subtitle}
      meta={<ThemePill tone="purple" width={180}>Evidence Slot</ThemePill>}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      tone="purple"
      showHeaderDivider={false}
      contentTop={150}
      contentHeight={512}
    >
      {parsed.showDecorations ? <BalancedComparisonDecorations /> : null}
      <div className="relative z-10 grid h-full min-h-0 grid-cols-[1.35fr_0.78fr] gap-[28px]">
        <ThemePanelShell
          className="flex min-h-0 items-center justify-center text-center"
          borderColor={redBlueComparisonTheme.tone.blue.border}
          backgroundColor="rgba(239,246,255,0.68)"
          shadow={redBlueComparisonTheme.shadow.panel}
        >
          {parsed.showSlotGuides ? (
            <div className="w-[500px]">
              <div className="text-[28px] font-black leading-none" style={{ color: redBlueComparisonTheme.colors.japanBlue }}>
                {parsed.chartGuideTitle}
              </div>
              <div className="mt-[18px] text-[17px] font-medium leading-[1.5]" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
                {parsed.chartGuideText}
              </div>
            </div>
          ) : null}
        </ThemePanelShell>
        <ThemePanelShell
          className="flex min-h-0 items-center justify-center text-center"
          borderColor={redBlueComparisonTheme.tone.red.border}
          backgroundColor="rgba(255,241,243,0.72)"
          shadow={redBlueComparisonTheme.shadow.card}
        >
          {parsed.showSlotGuides ? (
            <div className="px-[10px]">
              <div className="text-[24px] font-black leading-none" style={{ color: redBlueComparisonTheme.colors.chinaRed }}>
                {parsed.railGuideTitle}
              </div>
              <div className="mt-[18px] text-[16px] font-medium leading-[1.55]" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
                {parsed.railGuideText}
              </div>
            </div>
          ) : null}
        </ThemePanelShell>
      </div>
    </ThemeContentFrame>
  );
};

export default ChartEvidenceCanvas;
