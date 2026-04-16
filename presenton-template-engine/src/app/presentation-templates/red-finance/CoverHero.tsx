import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";

const ChartBarSchema = z.object({
    height: z.number().min(80).max(360).default(120),
    opacity: z.number().min(0.2).max(1).default(0.4),
});

export const Schema = z.object({
    brandName: z.string().min(2).max(80).default("GLOBAL FINANCE INSIGHTS"),
    reportTag: z.string().min(6).max(60).default("Strategic Analysis 2026"),
    titleLineOne: z.string().min(2).max(24).default("金融行业"),
    titleLineTwo: z.string().min(2).max(32).default("战略分析报告"),
    subtitle: z.string().min(6).max(40).default("把握趋势 · 夯实风控 · 驱动增长"),
    reportDate: z.string().min(6).max(24).default("2026/03/02"),
    presenter: z.string().min(2).max(40).default("[Name Here]"),
    classification: z.string().min(4).max(40).default("绝密资料 · 内部参考"),
    chartBars: z.array(ChartBarSchema).min(3).max(8).default([
        { height: 120, opacity: 0.4 },
        { height: 180, opacity: 0.6 },
        { height: 150, opacity: 0.5 },
        { height: 240, opacity: 0.8 },
        { height: 320, opacity: 1 },
    ]),
});

export const layoutId = "cover-hero";
export const layoutName = "Cover Hero";
export const layoutDescription = "A finance-themed cover slide with an editorial headline, footer metadata, and abstract chart bars.";
export const layoutTags = ["cover", "finance", "hero"];
export const layoutRole = "cover";
export const contentElements = ["headline", "meta", "hero-graphic"];
export const useCases = ["cover", "opening", "executive-brief"];
export const suitableFor =
    "Suitable for opening a finance or strategy deck with a strong title, subtitle, and presenter metadata.";
export const avoidFor =
    "Avoid using this layout for analytical body content, process steps, or dense comparison text.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const BrandIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 flex-none" fill="none">
        <path d="M4 9.5 12 5l8 4.5" stroke="var(--primary-color,#B71C1C)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 10.5v6.5M10 10.5v6.5M14 10.5v6.5M17.5 10.5v6.5" stroke="var(--primary-color,#B71C1C)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4.5 19h15M3.5 8.8h17" stroke="var(--primary-color,#B71C1C)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const CalendarIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] flex-none" fill="none">
        <rect x="4" y="6" width="16" height="14" rx="2" stroke="var(--primary-color,#B71C1C)" strokeWidth="1.8" />
        <path d="M8 4v4M16 4v4M4 10h16" stroke="var(--primary-color,#B71C1C)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const UserIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] flex-none" fill="none">
        <circle cx="12" cy="8" r="3.2" stroke="var(--primary-color,#B71C1C)" strokeWidth="1.8" />
        <path d="M6.5 19c.9-3 3.15-4.5 5.5-4.5s4.6 1.5 5.5 4.5" stroke="var(--primary-color,#B71C1C)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const ShieldIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] flex-none" fill="none">
        <path d="M12 4 18 6.4V11c0 4.1-2.25 7-6 9-3.75-2-6-4.9-6-9V6.4L12 4Z" stroke="var(--primary-color,#B71C1C)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m9.5 12 1.7 1.7 3.6-3.9" stroke="var(--primary-color,#B71C1C)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const MetaItem = ({
    icon,
    text,
    minTextWidth,
}: {
    icon: JSX.Element;
    text: string;
    minTextWidth?: number;
}) => (
    <div className="flex items-center gap-[10px] text-[16px] leading-none" style={{ color: "var(--text-muted,#757575)" }}>
        {icon}
        <span
            className="font-medium"
            style={{
                color: "var(--background-text,#212121)",
                minWidth: minTextWidth ? `${minTextWidth}px` : undefined,
                whiteSpace: "nowrap",
                display: "inline-block",
            }}
        >
            {text}
        </span>
    </div>
);

const CoverHero = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});
    const brandName = ((data as Record<string, unknown> | undefined)?.__companyName__ as string | undefined) ?? parsed.brandName;

    return (
        <RedFinanceCanvas>
            <div
                className="absolute right-0 bottom-0 h-full w-1/2 opacity-30"
                style={{
                    backgroundImage: "radial-gradient(#e0e0e0 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                }}
            />

            <div
                className="absolute left-0 top-[108px] h-[180px] w-[12px]"
                style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
            />

            <div className="absolute left-[100px] right-[60px] top-[40px] z-20 flex items-center justify-between">
                <div className="flex items-center gap-3 text-[20px] font-bold tracking-[0.02em]" style={{ color: "var(--background-text,#212121)" }}>
                    <BrandIcon />
                    <span>{brandName}</span>
                </div>
                <div className="flex w-[305px] flex-col items-end">
                    <div
                        className="text-right text-[14px] font-bold uppercase leading-none tracking-[0.08em]"
                        style={{ color: "var(--primary-color,#B71C1C)" }}
                    >
                        {parsed.reportTag}
                    </div>
                    <div className="mt-[6px] h-[2px] w-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                </div>
            </div>

            <div
                className="absolute left-[100px] top-[236px] z-10 w-[430px] whitespace-nowrap text-[84px] font-black leading-[1.02] tracking-[-0.04em]"
                style={{ color: "var(--background-text,#212121)" }}
            >
                {parsed.titleLineOne}
            </div>

            <div
                className="absolute left-[100px] top-[320px] z-10 w-[640px] whitespace-nowrap text-[84px] font-black leading-[1.02] tracking-[-0.04em]"
                style={{ color: "var(--primary-color,#B71C1C)" }}
            >
                {parsed.titleLineTwo}
            </div>

            <div className="absolute left-[100px] top-[434px] z-10 inline-flex">
                <div
                    className="px-8 py-3 text-[24px] font-medium tracking-[0.08em]"
                    style={{
                        backgroundColor: "var(--primary-color,#B71C1C)",
                        color: "var(--primary-text,#FFFFFF)",
                    }}
                >
                    {parsed.subtitle}
                </div>
                <div className="h-full w-[10px]" style={{ backgroundColor: "#8E0000" }} />
            </div>

            <div className="absolute bottom-[100px] right-[80px] z-10 flex items-end gap-[20px]">
                {parsed.chartBars.map((bar, index) => (
                    <div
                        key={`${bar.height}-${bar.opacity}-${index}`}
                        className="w-[40px] rounded-t-[4px]"
                        style={{
                            height: `${bar.height}px`,
                            opacity: bar.opacity,
                            backgroundColor: "var(--primary-color,#B71C1C)",
                            boxShadow: "4px 4px 10px rgba(0,0,0,0.1)",
                        }}
                    />
                ))}
            </div>

            <div className="absolute bottom-[60px] left-[100px] z-10 flex items-center gap-[40px]">
                <MetaItem icon={<CalendarIcon />} text={parsed.reportDate} minTextWidth={112} />
                <MetaItem icon={<UserIcon />} text={`报告人：${parsed.presenter}`} />
                <MetaItem icon={<ShieldIcon />} text={parsed.classification} />
            </div>
        </RedFinanceCanvas>
    );
};

export default CoverHero;
