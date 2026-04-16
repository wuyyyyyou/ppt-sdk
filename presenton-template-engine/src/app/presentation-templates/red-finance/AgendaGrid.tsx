import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { BrandIcon, FinanceIcon } from "./shared/icons.js";

const agendaItemSchema = z.object({
    number: z.string().min(2).max(3),
    title: z.string().min(2).max(24),
    icon: z.enum([
        "book-open",
        "list",
        "chart-pie",
        "chart-line",
        "laptop-code",
        "microchip",
        "chess",
        "shield-alt",
        "route",
        "flag-checkered",
    ]),
    highlighted: z.boolean().default(false),
});

export const Schema = z.object({
    title: z.string().min(2).max(20).default("目录"),
    brandName: z.string().min(2).max(80).default("GLOBAL FINANCE INSIGHTS"),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("02"),
    watermarkIcon: z.enum(["list-ol"]).default("list-ol"),
    items: z.array(agendaItemSchema).min(2).max(10).default([
        { number: "01", title: "封面", icon: "book-open", highlighted: false },
        { number: "02", title: "目录", icon: "list", highlighted: true },
        { number: "03", title: "行业概况", icon: "chart-pie", highlighted: false },
        { number: "04", title: "市场趋势（2026）", icon: "chart-line", highlighted: false },
        { number: "05", title: "数字化转型", icon: "laptop-code", highlighted: false },
        { number: "06", title: "金融科技创新", icon: "microchip", highlighted: false },
        { number: "07", title: "竞争格局", icon: "chess", highlighted: false },
        { number: "08", title: "风险管理", icon: "shield-alt", highlighted: false },
        { number: "09", title: "战略规划", icon: "route", highlighted: false },
        { number: "10", title: "总结展望", icon: "flag-checkered", highlighted: false },
    ]),
});

export const layoutId = "agenda-grid";
export const layoutName = "Agenda Grid";
export const layoutDescription = "A finance-themed table of contents slide with a two-column agenda grid and current-section highlight.";
export const layoutTags = ["agenda", "toc", "finance"];
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

const watermarkSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 367 367">
  <g fill="none" stroke="#B71C1C" stroke-opacity="0.03" stroke-width="34" stroke-linecap="round">
    <path d="M145 94h180" />
    <path d="M145 184h180" />
    <path d="M145 274h180" />
  </g>
  <g fill="#B71C1C" fill-opacity="0.03" font-family="Roboto,Arial,sans-serif" font-size="120" font-weight="700">
    <text x="34" y="115">1</text>
    <text x="24" y="205">2</text>
    <text x="20" y="295">3</text>
  </g>
</svg>
`;

const watermarkDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(watermarkSvg)}`;

const AgendaGrid = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});
    const brandName = ((data as Record<string, unknown> | undefined)?.__companyName__ as string | undefined) ?? parsed.brandName;

    return (
        <RedFinanceCanvas>
            <div className="absolute left-0 top-0 z-10 h-[12px] w-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />

            <img
                src={watermarkDataUri}
                alt=""
                aria-hidden="true"
                className="absolute bottom-[18px] right-[22px] z-0 h-[220px] w-[220px]"
            />

            <div className="relative z-10 mx-[80px] mb-[40px] flex items-end justify-between px-0 pb-[20px] pt-[60px]">
                <div>
                    <h1
                        className="text-[48px] font-black tracking-[-0.02em]"
                        style={{ color: "var(--background-text,#212121)" }}
                    >
                        {parsed.title}
                    </h1>
                </div>

                <div className="flex items-center gap-[10px] text-[16px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                    <BrandIcon className="h-[22px] w-[22px]" color="var(--primary-color,#B71C1C)" />
                    <span>{brandName}</span>
                </div>
            </div>

            <div className="absolute left-[80px] right-[80px] top-[138px] z-10 h-[2px]" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />
            <div className="absolute left-[80px] top-[132px] z-10 h-[6px] w-[120px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />

            <div className="relative z-10 flex flex-1 items-start justify-center px-[80px] pb-[40px]">
                <div className="grid w-full max-w-[1100px] grid-cols-2 gap-x-[60px] gap-y-[24px]">
                    {parsed.items.map((item) => {
                        const isHighlighted = item.highlighted;

                        return (
                            <div
                                key={item.number}
                                className="relative flex items-center overflow-hidden rounded-[4px] border px-[24px] py-[16px] shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
                                style={{
                                    backgroundColor: isHighlighted ? "#FFEBEE" : "var(--card-color,#FFFFFF)",
                                    borderColor: "var(--stroke,#EEEEEE)",
                                }}
                            >
                                {isHighlighted ? (
                                    <div
                                        className="absolute left-0 top-0 h-full w-[5px]"
                                        style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
                                    />
                                ) : null}
                                <span
                                    className="mr-[20px] w-[40px] text-right text-[24px] font-black"
                                    style={{ color: "var(--primary-color,#B71C1C)" }}
                                >
                                    {item.number}
                                </span>
                                <p
                                    className="flex-1 text-[20px] font-medium"
                                    style={{ color: isHighlighted ? "var(--primary-color,#B71C1C)" : "var(--background-text,#212121)" }}
                                >
                                    {item.title}
                                </p>
                                <FinanceIcon
                                    name={item.icon}
                                    className="ml-[15px] h-6 w-6"
                                    color={isHighlighted ? "var(--primary-color,#B71C1C)" : "#E0E0E0"}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            <div
                className="relative z-20 flex h-[50px] items-center justify-between border-t px-[60px] text-[12px]"
                style={{ borderColor: "#F5F5F5", color: "#9E9E9E", backgroundColor: "var(--background-color,#FFFFFF)" }}
            >
                <p>{parsed.footerText}</p>
                <p className="font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                    {parsed.pageNumber}
                </p>
            </div>
        </RedFinanceCanvas>
    );
};

export default AgendaGrid;
