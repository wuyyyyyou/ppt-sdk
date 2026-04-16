import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const institutionPlayerSchema = z.object({
    name: z.string().min(2).max(24),
    tag: z.string().min(1).max(16),
});

const institutionGroupSchema = z.object({
    icon: z.enum(["investment-bank", "custodian", "asset-manager", "payments", "market-infra"]),
    title: z.string().min(2).max(12),
    subtitle: z.string().min(4).max(18),
    players: z.array(institutionPlayerSchema).min(3).max(3),
});

const kpiSchema = z.object({
    label: z.string().min(8).max(32),
    value: z.string().min(1).max(8),
    unit: z.string().min(1).max(6),
    trend: z.string().min(3).max(12),
    trendDirection: z.enum(["up", "steady"]),
});

export const Schema = z.object({
    title: z.string().min(4).max(24).default("全球核心金融机构"),
    metaLabel: z.string().min(8).max(40).default("GLOBAL CORE PLAYERS"),
    groups: z.array(institutionGroupSchema).min(5).max(5).default([
        {
            icon: "investment-bank",
            title: "投资银行",
            subtitle: "Inv. Banks",
            players: [
                { name: "JPMorgan", tag: "综合" },
                { name: "Goldman Sachs", tag: "交易" },
                { name: "Morgan Stanley", tag: "财富" },
            ],
        },
        {
            icon: "custodian",
            title: "托管银行",
            subtitle: "Custodians",
            players: [
                { name: "BNY Mellon", tag: "全球第一" },
                { name: "State Street", tag: "数据" },
                { name: "Northern Trust", tag: "高端" },
            ],
        },
        {
            icon: "asset-manager",
            title: "资产管理",
            subtitle: "Asset Mgmt",
            players: [
                { name: "BlackRock", tag: "ETF" },
                { name: "Vanguard", tag: "指数" },
                { name: "Fidelity", tag: "主动" },
            ],
        },
        {
            icon: "payments",
            title: "支付网络",
            subtitle: "Payments",
            players: [
                { name: "Visa", tag: "规模" },
                { name: "Mastercard", tag: "科技" },
                { name: "Amex", tag: "高端" },
            ],
        },
        {
            icon: "market-infra",
            title: "市场基建",
            subtitle: "Market Infra",
            players: [
                { name: "CME Group", tag: "衍生品" },
                { name: "ICE", tag: "能源/数据" },
                { name: "SWIFT", tag: "通信" },
            ],
        },
    ]),
    dashboardTitle: z.string().min(4).max(24).default("关键绩效指标"),
    dashboardTag: z.string().min(8).max(36).default("KEY PERFORMANCE INDICATORS"),
    metrics: z.array(kpiSchema).min(4).max(4).default([
        { label: "全球资产管理规模 (AUM)", value: "$105", unit: "Tn+", trend: "8.5% YoY", trendDirection: "up" },
        { label: "支付网络年交易量 (TPV)", value: "$28", unit: "Tn", trend: "12% YoY", trendDirection: "up" },
        { label: "头部投行平均 ROE", value: "14.5", unit: "%", trend: "Stable", trendDirection: "steady" },
        { label: "托管资产规模 (AuC)", value: "$130", unit: "Tn+", trend: "5.2% YoY", trendDirection: "up" },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("14"),
});

export const layoutId = "global-core-financial-institutions";
export const layoutName = "Global Core Financial Institutions";
export const layoutDescription =
    "A five-column finance institution landscape slide with editable institution groups and a four-metric KPI dashboard.";

const GlobeIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 12h15M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const CategoryIcon = ({ name }: { name: z.infer<typeof institutionGroupSchema>["icon"] }) => {
    const className = "h-[16px] w-[16px]";

    switch (name) {
        case "investment-bank":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <rect x="5" y="6" width="14" height="12" rx="2.3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M9 10h6M9 13h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "custodian":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <rect x="6" y="11" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8.5 11V8.5a3.5 3.5 0 1 1 7 0V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
                </svg>
            );
        case "asset-manager":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <path d="M12 4.2A7.8 7.8 0 1 0 19.8 12H12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M12 4.2V12h7.8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
            );
        case "payments":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <rect x="4.5" y="6.2" width="15" height="11.6" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M4.5 10.2h15M8 14.2h3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "market-infra":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <rect x="6.2" y="4.8" width="11.6" height="5.2" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                    <rect x="6.2" y="13.8" width="11.6" height="5.2" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M9 8.8h6M9 17.8h6M12 10v3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const trendStyles: Record<z.infer<typeof kpiSchema>["trendDirection"], { color: string; backgroundColor: string }> = {
    up: { color: "#2E7D32", backgroundColor: "#E8F5E9" },
    steady: { color: "#EF6C00", backgroundColor: "#FFF3E0" },
};

const GlobalCoreFinancialInstitutions = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});

    return (
        <RedFinanceCanvas>
            <div className="relative z-10 h-full">
                <div className="absolute left-[60px] right-[60px] top-[30px] flex items-end justify-between pb-[10px]">
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[36px] w-[6px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1 className="whitespace-nowrap text-[36px] font-black tracking-[-0.02em]" style={{ color: "var(--background-text,#212121)" }}>
                            {parsed.title}
                        </h1>
                    </div>
                    <div className="flex w-[220px] items-center justify-end gap-[10px] whitespace-nowrap text-[14px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                        <div style={{ color: "var(--primary-color,#B71C1C)" }}>
                            <GlobeIcon />
                        </div>
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="absolute left-[60px] right-[60px] top-[101px] h-[2px] rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                <div className="absolute left-[60px] right-[60px] top-[122px] bottom-[40px] flex flex-col gap-[14px]">
                    <div className="grid h-[320px] grid-cols-5 gap-[14px]">
                        {parsed.groups.map((group) => (
                            <div
                                key={group.title}
                                className="relative overflow-hidden rounded-[8px] border shadow-[0_4px_10px_rgba(0,0,0,0.04)]"
                                style={{
                                    backgroundColor: "#FFFFFF",
                                    borderColor: "var(--stroke,#EEEEEE)",
                                }}
                            >
                                <div className="h-[5px] w-full flex-none" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />

                                <div className="px-[16px] pb-[12px] pt-[13px]" style={{ backgroundColor: "#FAFAFA" }}>
                                    <div className="flex items-center gap-[10px]">
                                        <div
                                            className="flex h-[32px] w-[32px] flex-none items-center justify-center rounded-[6px]"
                                            style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
                                        >
                                            <CategoryIcon name={group.icon} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="whitespace-nowrap text-[14px] font-bold leading-none" style={{ color: "var(--background-text,#212121)" }}>
                                                {group.title}
                                            </div>
                                            <div className="mt-[5px] whitespace-nowrap text-[11px] font-medium leading-none" style={{ color: "var(--text-muted,#757575)" }}>
                                                {group.subtitle}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mx-[16px] h-[1px]" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                                <div className="flex flex-col gap-[14px] px-[16px] py-[16px]">
                                    {group.players.map((player) => (
                                        <div key={player.name} className="flex items-center gap-[8px]">
                                            <div className="h-[6px] w-[6px] flex-none rounded-full" style={{ backgroundColor: "#EF5350" }} />
                                            <div className="min-w-0 flex-1 whitespace-nowrap text-[13px] font-medium leading-none" style={{ color: "var(--background-text,#212121)" }}>
                                                {player.name}
                                            </div>
                                            <div
                                                className="flex h-[20px] min-w-[68px] flex-none items-center justify-center rounded-[4px] px-[6px] whitespace-nowrap text-[10px] font-medium leading-none"
                                                style={{ backgroundColor: "#F5F5F5", color: "var(--text-muted,#616161)" }}
                                            >
                                                {player.tag}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div
                        className="relative h-[202px] overflow-hidden rounded-[8px] border px-[20px] pb-[16px] pt-[14px]"
                        style={{
                            backgroundColor: "#FAFAFA",
                            borderColor: "var(--stroke,#EEEEEE)",
                        }}
                    >
                        <div className="mb-[12px] flex items-center justify-between gap-[16px]">
                            <div className="flex items-center gap-[10px]">
                                <div
                                    className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[8px]"
                                    style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
                                >
                                    <FinanceIcon name="chart-line" className="h-[15px] w-[15px]" color="currentColor" />
                                </div>
                                <div className="whitespace-nowrap text-[14px] font-bold leading-none" style={{ color: "var(--background-text,#212121)" }}>
                                    {parsed.dashboardTitle}
                                </div>
                            </div>
                            <div className="whitespace-nowrap text-[11px] font-medium leading-none" style={{ color: "#8C8C8C" }}>
                                {parsed.dashboardTag}
                            </div>
                        </div>

                        <div className="mb-[12px] h-[1px] w-full" style={{ backgroundColor: "var(--stroke,#E7E7E7)" }} />

                        <div className="grid grid-cols-4 gap-[16px]">
                            {parsed.metrics.map((metric) => {
                                const trendStyle = trendStyles[metric.trendDirection];

                                return (
                                    <div
                                        key={metric.label}
                                        className="relative h-[124px] overflow-hidden rounded-[6px] border px-[14px] py-[14px]"
                                        style={{
                                            backgroundColor: "#FFFFFF",
                                            borderColor: "var(--stroke,#EEEEEE)",
                                        }}
                                    >
                                        <div className="absolute bottom-0 right-0 top-0 w-[4px]" style={{ backgroundColor: "#F8D9D9" }} />

                                        <div className="pr-[12px] text-[11px] font-medium leading-[1.35]" style={{ color: "var(--text-muted,#616161)" }}>
                                            {metric.label}
                                        </div>

                                        <div className="relative mt-[10px] h-[34px] w-[108px]">
                                            <div
                                                className="absolute left-0 top-0 w-[76px] whitespace-nowrap text-[22px] font-black leading-none"
                                                style={{ color: "var(--primary-color,#B71C1C)" }}
                                            >
                                                {metric.value}
                                            </div>
                                            <div
                                                className="absolute left-[70px] top-[10px] w-[34px] whitespace-nowrap text-[12px] font-medium leading-none"
                                                style={{ color: "var(--text-muted,#616161)" }}
                                            >
                                                {metric.unit}
                                            </div>
                                        </div>

                                        <div
                                            className="mt-[14px] inline-flex h-[24px] items-center rounded-full px-[12px] whitespace-nowrap text-[11px] font-medium leading-[1]"
                                            style={trendStyle}
                                        >
                                            {metric.trendDirection === "up" ? `↗ ${metric.trend}` : `− ${metric.trend}`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="absolute left-[60px] right-[60px] bottom-[40px] h-[1px]" style={{ backgroundColor: "#F5F5F5" }} />

                <div className="absolute bottom-0 left-[60px] right-[60px] flex h-[40px] items-center justify-between text-[12px]" style={{ color: "#9E9E9E" }}>
                    <div>{parsed.footerText}</div>
                    <div className="w-[28px] text-right font-bold whitespace-nowrap" style={{ color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </div>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default GlobalCoreFinancialInstitutions;
