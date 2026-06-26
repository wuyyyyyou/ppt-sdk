import React from "react";
import * as z from "zod";

import AlternatingTimeline from "../components/AlternatingTimeline.tsx";
import ThemeCanvas from "../components/ThemeCanvas.tsx";
import ThemeSoftCircle from "../components/ThemeSoftCircle.tsx";
import ThemeTitleBlock from "../components/ThemeTitleBlock.tsx";
import { type RedBlueTone, redBlueComparisonTheme } from "../theme/tokens.ts";

const ToneSchema = z.enum(["red", "blue", "purple", "neutral"]);

const TimelineItemSchema = z.object({
  date: z.string().min(1).max(18),
  title: z.string().min(2).max(42),
  description: z.string().min(8).max(120),
  tone: ToneSchema.default("purple"),
});

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(34).default("History:"),
  titleHighlight: z.string().min(2).max(36).default("Key Milestones"),
  subtitle: z.string().min(8).max(130).optional(),
  footerText: z.string().min(4).max(90).default("Red Blue Comparison | Historical Timeline"),
  pageNumber: z.string().min(1).max(4).default("09"),
  timelineItems: z.array(TimelineItemSchema).min(3).max(6).default([
    {
      date: "Phase 1",
      title: "Early Context",
      description: "Use this slot for the opening milestone that frames the historical arc.",
      tone: "purple",
    },
    {
      date: "Phase 2",
      title: "Turning Point",
      description: "Highlight the shift that changed relations, markets, or strategic direction.",
      tone: "purple",
    },
    {
      date: "Phase 3",
      title: "Normalization",
      description: "Capture the period where institutions, agreements, or operating norms emerged.",
      tone: "purple",
    },
    {
      date: "Phase 4",
      title: "Renewed Tension",
      description: "Summarize a later conflict, constraint, or external pressure point.",
      tone: "purple",
    },
    {
      date: "Phase 5",
      title: "Current Dynamics",
      description: "Close with the present-day balance of cooperation, competition, or uncertainty.",
      tone: "purple",
    },
  ]),
  showDecorations: z.boolean().default(true),
});

export const layoutId = "historical-milestones-timeline";
export const layoutName = "Historical Milestones Timeline";
export const layoutDescription =
  "A TSX-first horizontal alternating timeline page with a centered title, soft purple structure line, and diamond milestone markers.";
export const layoutTags = ["timeline", "history", "milestones", "sequence", "comparison", "red-blue", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["centered-page-title", "optional-subtitle", "horizontal-timeline", "date-pills", "milestone-markers", "footer"];
export const useCases = ["historical timeline", "relationship milestones", "policy evolution", "strategic roadmap", "market development sequence"];
export const suitableFor =
  "Suitable for showing three to six sequential milestones where date labels and concise event descriptions should read as one visual arc.";
export const avoidFor =
  "Avoid using this layout for dense chronology, more than six events, detailed evidence tables, or quantitative trend charts.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const TimelineDecorations = () => (
  <>
    <ThemeSoftCircle tone="purple" left={-88} top={-128} size={350} alpha={0.035} />
    <ThemeSoftCircle tone="purple" left={1040} top={510} size={280} alpha={0.12} />
    <ThemeSoftCircle tone="purple" left={488} top={134} size={150} alpha={0.024} />
  </>
);

const HistoricalMilestonesTimeline = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <ThemeCanvas>
      {parsed.showDecorations ? <TimelineDecorations /> : null}

      <div className="absolute left-[72px] right-[72px] top-[32px] z-10 flex justify-center">
        <ThemeTitleBlock
          titlePrefix={parsed.titlePrefix}
          titleHighlight={parsed.titleHighlight}
          subtitle={parsed.subtitle}
          tone="purple"
          align="center"
          titleFontSize={60}
          titleMaxWidth={1060}
          subtitleMaxWidth={860}
        />
      </div>

      <div className="absolute left-[60px] right-[60px] top-[210px] z-10 h-[390px]">
        <AlternatingTimeline
          items={parsed.timelineItems.map((item) => ({
            ...item,
            tone: item.tone as RedBlueTone,
          }))}
        />
      </div>

      <div
        className="absolute bottom-0 left-0 z-20 flex w-full items-center justify-between px-[60px] text-[12px]"
        style={{
          height: redBlueComparisonTheme.size.footerHeight,
          color: redBlueComparisonTheme.colors.subtleText,
          backgroundColor: redBlueComparisonTheme.colors.background,
          borderTop: redBlueComparisonTheme.border.hairline,
        }}
      >
        <div className="min-w-0 truncate">{parsed.footerText}</div>
        <div className="flex-none font-black" style={{ color: redBlueComparisonTheme.colors.primary }}>
          {parsed.pageNumber}
        </div>
      </div>
    </ThemeCanvas>
  );
};

export default HistoricalMilestonesTimeline;
