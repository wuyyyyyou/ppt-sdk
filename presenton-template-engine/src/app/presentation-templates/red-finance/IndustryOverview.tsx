import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const overviewItemSchema = z.object({
    icon: z.enum(["university", "chart-line", "coins", "briefcase"]),
    title: z.string().min(2).max(20),
    description: z.string().min(12).max(96),
});

const chartBarSchema = z.object({
    label: z.string().min(4).max(8),
    value: z.number().min(300).max(600),
});

export const Schema = z.object({
    title: z.string().min(2).max(20).default("行业概况"),
    metaLabel: z.string().min(4).max(40).default("MARKET OVERVIEW"),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("03"),
    infoItems: z.array(overviewItemSchema).min(4).max(4).default([
        {
            icon: "university",
            title: "宏观与监管",
            description: "稳增长与强监管并行，结构性政策持续优化。政策导向聚焦金融服务实体经济，防范系统性金融风险。",
        },
        {
            icon: "chart-line",
            title: "行业规模",
            description: "银行、证券、保险与资管多业态协同发展。银行业资产总额稳步增长，保险保费规模持续扩大。",
        },
        {
            icon: "coins",
            title: "收入结构",
            description: "息差持续承压，驱动业务转型。非息收入与财富管理业务占比显著抬升，成为新增长极。",
        },
        {
            icon: "briefcase",
            title: "业务重心",
            description: "企业金融+零售金融“双轮驱动”。供应链金融与场景金融深度融合，数字化服务能力成为核心竞争力。",
        },
    ]),
    keyInsight: z
        .string()
        .min(12)
        .max(96)
        .default("关键启示：未来三年应重点提升中间业务收入，持续优化资产质量，并做强综合金融服务能力。"),
    chartTitle: z.string().min(8).max(48).default("金融行业资产规模趋势 (2022-2026E)"),
    chartSubtitle: z.string().min(6).max(32).default("单位：万亿元 (RMB)"),
    chartBars: z.array(chartBarSchema).min(5).max(6).default([
        { label: "2022", value: 370 },
        { label: "2023", value: 405 },
        { label: "2024", value: 442 },
        { label: "2025", value: 480 },
        { label: "2026E", value: 525 },
    ]),
});

export const layoutId = "industry-overview";
export const layoutName = "Industry Overview";
export const layoutDescription = "A finance industry overview slide with policy highlights, strategic insight, and a static asset-growth bar chart.";
export const layoutTags = ["overview", "chart", "insight"];
export const layoutRole = "content";
export const contentElements = ["chart", "insight-card", "icon-list"];
export const useCases = ["industry-overview", "market-overview", "executive-summary"];
export const suitableFor =
    "Suitable for overview pages that combine key takeaways, structured highlights, and one compact supporting chart.";
export const avoidFor =
    "Avoid using this layout for detailed process flows, roadmap plans, or long-form narrative sections.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const chartMin = 300;
const chartMax = 550;
const plotHeight = 250;
const yTicks = [300, 350, 400, 450, 500, 550];

const OverviewIcon = ({ name }: { name: z.infer<typeof overviewItemSchema>["icon"] }) => {
    const className = "h-[18px] w-[18px]";
    const color = "var(--primary-color,#B71C1C)";

    switch (name) {
        case "university":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={{ color }}>
                    <path d="M4 9.5 12 5l8 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.5 10.5v6.5M10 10.5v6.5M14 10.5v6.5M17.5 10.5v6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M4.5 19h15M3.5 8.8h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "chart-line":
            return <FinanceIcon name="chart-line" className={className} color={color} />;
        case "coins":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={{ color }}>
                    <ellipse cx="12" cy="7" rx="5.5" ry="2.8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M6.5 7v4.4C6.5 13 9 14.2 12 14.2s5.5-1.2 5.5-2.8V7M8 13.4v3.1c0 1.2 1.8 2.2 4 2.2s4-1 4-2.2v-3.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "briefcase":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={{ color }}>
                    <rect x="4" y="8" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M9 8V6.4A1.4 1.4 0 0 1 10.4 5h3.2A1.4 1.4 0 0 1 15 6.4V8M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const InsightIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 flex-none" fill="none">
        <path
            d="M9.2 16.4h5.6M10 19h4M8 10.2a4 4 0 1 1 8 0c0 1.4-.58 2.12-1.5 3.2-.68.8-1.14 1.65-1.3 2.5h-2.4c-.16-.85-.62-1.7-1.3-2.5-.92-1.08-1.5-1.8-1.5-3.2Z"
            stroke="var(--primary-text,#FFFFFF)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const IndustryOverview = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});

    return (
        <RedFinanceCanvas>
            <div className="relative z-10 flex h-full flex-col">
                <div
                    className="mx-[60px] flex items-end justify-between pb-[20px] pt-[40px]"
                    style={{ backgroundColor: "var(--background-color,#FFFFFF)" }}
                >
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[42px] w-[8px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1 className="text-[42px] font-black tracking-[-0.02em]" style={{ color: "var(--background-text,#212121)" }}>
                            {parsed.title}
                        </h1>
                    </div>

                    <div className="flex items-center gap-[10px] text-[14px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                        <FinanceIcon name="chart-pie" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="mx-[60px] mb-[30px] h-[2px]" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                <div className="flex flex-1 gap-[50px] overflow-hidden px-[60px] pb-[20px]">
                    <div className="flex basis-[55%] flex-col">
                        <div className="flex flex-col gap-[20px]">
                            {parsed.infoItems.map((item, index) => (
                                <div key={`${item.title}-${index}`} className="relative flex items-start gap-[15px] pb-[15px]">
                                    <div
                                        className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full"
                                        style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
                                    >
                                        <OverviewIcon name={item.icon} />
                                    </div>
                                    <div className="pr-[8px]">
                                        <h3 className="mb-[4px] text-[18px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
                                            {item.title}
                                        </h3>
                                        <p className="text-[15px] leading-[1.5]" style={{ color: "var(--text-muted,#616161)" }}>
                                            {item.description}
                                        </p>
                                    </div>
                                    {index < parsed.infoItems.length - 1 ? (
                                        <div className="absolute bottom-0 left-[55px] right-0 h-px" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />
                                    ) : null}
                                </div>
                            ))}
                        </div>

                        <div
                            className="mt-[10px] flex items-center gap-[15px] rounded-[6px] px-[20px] py-[15px]"
                            style={{
                                backgroundColor: "var(--primary-color,#B71C1C)",
                                color: "var(--primary-text,#FFFFFF)",
                                boxShadow: "0 4px 10px rgba(183, 28, 28, 0.2)",
                            }}
                        >
                            <InsightIcon />
                            <p className="text-[15px] font-medium leading-[1.4]">{parsed.keyInsight}</p>
                        </div>
                    </div>

                    <div
                        className="flex flex-1 flex-col rounded-[8px] border px-[20px] py-[20px]"
                        style={{
                            backgroundColor: "#FAFAFA",
                            borderColor: "var(--stroke,#EEEEEE)",
                            boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
                        }}
                    >
                        <div className="mb-[15px] text-center">
                            <div className="text-[18px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
                                {parsed.chartTitle}
                            </div>
                            <div className="text-[12px]" style={{ color: "var(--text-muted,#616161)" }}>
                                {parsed.chartSubtitle}
                            </div>
                        </div>

                        <div className="flex flex-1 items-center">
                            <div className="relative h-[320px] w-full">
                                <div className="absolute left-0 top-0 bottom-[34px] w-[44px]">
                                    {yTicks.map((tick) => {
                                        const bottom = ((tick - chartMin) / (chartMax - chartMin)) * plotHeight;

                                        return (
                                            <div
                                                key={tick}
                                                className="absolute right-[10px] translate-y-1/2 text-[11px]"
                                                style={{ bottom: `${bottom}px`, color: "#757575" }}
                                            >
                                                {tick}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="absolute left-[44px] right-0 top-[6px] bottom-[34px]">
                                    {yTicks.map((tick) => {
                                        const bottom = ((tick - chartMin) / (chartMax - chartMin)) * plotHeight;

                                        return (
                                            <div
                                                key={tick}
                                                className="absolute left-0 right-0 h-px"
                                                style={{ bottom: `${bottom}px`, backgroundColor: "var(--stroke,#EEEEEE)" }}
                                            />
                                        );
                                    })}

                                    <div className="absolute bottom-0 left-0 right-0 h-px" style={{ backgroundColor: "#D0D0D0" }} />

                                    <div className="absolute inset-x-[10px] bottom-0 top-0 flex items-end justify-between gap-[18px]">
                                        {parsed.chartBars.map((bar) => {
                                            const height = Math.max(24, ((bar.value - chartMin) / (chartMax - chartMin)) * plotHeight);

                                            return (
                                                <div key={bar.label} className="flex flex-1 items-end justify-center">
                                                    <div
                                                        className="w-[52px] rounded-t-[4px]"
                                                        style={{
                                                            height: `${height}px`,
                                                            backgroundColor: "var(--primary-color,#B71C1C)",
                                                            boxShadow: "0 4px 8px rgba(183, 28, 28, 0.12)",
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="absolute left-[44px] right-0 bottom-0 flex justify-between px-[10px]">
                                    {parsed.chartBars.map((bar) => (
                                        <div
                                            key={bar.label}
                                            className="flex flex-1 justify-center text-[12px] font-bold"
                                            style={{ color: "#424242" }}
                                        >
                                            {bar.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className="flex h-[40px] items-center justify-between border-t px-[60px] text-[12px]"
                    style={{ borderColor: "#F5F5F5", color: "#9E9E9E", backgroundColor: "var(--background-color,#FFFFFF)" }}
                >
                    <p>{parsed.footerText}</p>
                    <p className="font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </p>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default IndustryOverview;
