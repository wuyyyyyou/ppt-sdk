import React from "react";
import * as z from "zod";

import AgendaCard from "../components/AgendaCard.js";
import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";

const AgendaIconSchema = z.enum([
  "book-open",
  "list",
  "chart-pie",
  "chart-line",
  "laptop-code",
  "microchip",
  "chess",
  "shield",
  "route",
  "flag",
]);

const AgendaItemSchema = z.object({
  number: z.string().min(2).max(3),
  title: z.string().min(2).max(24),
  icon: AgendaIconSchema,
  highlighted: z.boolean().default(false),
});

export const Schema = z.object({
  title: z.string().min(2).max(20).default("目录"),
  brandName: z.string().min(2).max(80).default("GLOBAL FINANCE INSIGHTS"),
  footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(2).max(4).default("02"),
  items: z.array(AgendaItemSchema).min(2).max(10).default([
    { number: "01", title: "封面", icon: "book-open", highlighted: false },
    { number: "02", title: "目录", icon: "list", highlighted: true },
    { number: "03", title: "行业概况", icon: "chart-pie", highlighted: false },
    { number: "04", title: "市场趋势（2026）", icon: "chart-line", highlighted: false },
    { number: "05", title: "数字化转型", icon: "laptop-code", highlighted: false },
    { number: "06", title: "金融科技创新", icon: "microchip", highlighted: false },
    { number: "07", title: "竞争格局", icon: "chess", highlighted: false },
    { number: "08", title: "风险管理", icon: "shield", highlighted: false },
    { number: "09", title: "战略规划", icon: "route", highlighted: false },
    { number: "10", title: "总结展望", icon: "flag", highlighted: false },
  ]),
});

export const layoutId = "agenda-grid";
export const layoutName = "Agenda Grid";
export const layoutDescription =
  "A component-oriented finance agenda slide with editable section items and a stable two-column grid.";
export const layoutTags = ["agenda", "toc", "finance", "componentized"];
export const layoutRole = "agenda";
export const contentElements = ["agenda-grid", "outline", "numbered-list"];
export const useCases = ["agenda", "table-of-contents", "section-overview"];
export const suitableFor =
  "Suitable for agenda pages and section overviews when the deck needs a structured chapter list.";
export const avoidFor =
  "Avoid using this layout for narrative explanation, KPI summaries, or dense analytical content.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const AgendaGrid = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="bottom"
      metaIcon={<FinanceIcon name="bank" className="h-[22px] w-[22px]" />}
      metaText={parsed.brandName}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      showFooterDivider={false}
      contentTop={178}
    >
      <div className="grid w-full grid-cols-2 gap-x-[60px] gap-y-[24px]">
        {parsed.items.map((item) => (
          <AgendaCard
            key={`${item.number}-${item.title}`}
            number={item.number}
            title={item.title}
            icon={item.icon}
            highlighted={item.highlighted}
          />
        ))}
      </div>
    </FinanceContentFrame>
  );
};

export default AgendaGrid;
