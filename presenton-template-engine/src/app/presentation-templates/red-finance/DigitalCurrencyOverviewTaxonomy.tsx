import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const featureSchema = z.object({
    icon: z.enum(["code", "bolt", "shield", "contract"]),
    label: z.string().min(2).max(12),
});

const categorySchema = z.object({
    icon: z.enum(["landmark", "anchor", "microchip"]),
    title: z.string().min(6).max(32),
    description: z.string().min(12).max(72),
});

const chartSegmentSchema = z.object({
    label: z.string().min(2).max(16),
    value: z.number().min(1).max(100),
    color: z.string().min(4).max(16),
});

const comparisonRowSchema = z.object({
    category: z.string().min(2).max(16),
    issuer: z.string().min(2).max(24),
    backing: z.string().min(2).max(24),
    volatility: z.string().min(2).max(16),
    volatilityTone: z.enum(["low", "high"]),
    regulation: z.string().min(2).max(24),
});

export const Schema = z.object({
    title: z.string().min(6).max(28).default("数字货币概述与分类"),
    metaLabel: z.string().min(6).max(32).default("OVERVIEW & TAXONOMY"),
    definitionLabel: z.string().min(2).max(16).default("核心定义"),
    definitionText: z
        .string()
        .min(24)
        .max(120)
        .default("以电子形式存在的价值数字化表示，具备交易媒介、记账单位和价值储存功能，依托密码学技术实现价值流转。"),
    features: z.array(featureSchema).min(4).max(4).default([
        { icon: "code", label: "可编程性" },
        { icon: "bolt", label: "即时结算" },
        { icon: "shield", label: "隐私分层" },
        { icon: "contract", label: "合规设计" },
    ]),
    categories: z.array(categorySchema).min(3).max(3).default([
        {
            icon: "landmark",
            title: "央行数字货币 (CBDC)",
            description: "由央行发行，具有法偿性的国家法定货币数字化形态。",
        },
        {
            icon: "anchor",
            title: "稳定币 (Stablecoins)",
            description: "锚定法币或资产组合，旨在维持价格稳定的支付工具。",
        },
        {
            icon: "microchip",
            title: "加密资产 (Crypto)",
            description: "去中心化发行，由市场供需决定价格，主要作为投机或存储资产。",
        },
    ]),
    chartCenterLabel: z.string().min(2).max(12).default("市值分布"),
    chartSegments: z.array(chartSegmentSchema).min(3).max(4).default([
        { label: "加密资产", value: 65, color: "#B71C1C" },
        { label: "稳定币", value: 30, color: "#EF5350" },
        { label: "CBDC", value: 5, color: "#FFCDD2" },
    ]),
    columns: z
        .object({
            category: z.string().min(2).max(12).default("分类类别"),
            issuer: z.string().min(2).max(12).default("发行主体"),
            backing: z.string().min(2).max(12).default("价值背书"),
            volatility: z.string().min(2).max(12).default("波动性"),
            regulation: z.string().min(2).max(12).default("监管态势"),
        })
        .default({
            category: "分类类别",
            issuer: "发行主体",
            backing: "价值背书",
            volatility: "波动性",
            regulation: "监管态势",
        }),
    comparisonRows: z.array(comparisonRowSchema).min(3).max(4).default([
        {
            category: "CBDC",
            issuer: "中央银行",
            backing: "国家信用",
            volatility: "极低 (1:1)",
            volatilityTone: "low",
            regulation: "主导与推广",
        },
        {
            category: "稳定币",
            issuer: "私人机构",
            backing: "储备资产",
            volatility: "低 (锚定)",
            volatilityTone: "low",
            regulation: "准入与审计",
        },
        {
            category: "加密资产",
            issuer: "去中心化网络",
            backing: "共识/算力",
            volatility: "极高",
            volatilityTone: "high",
            regulation: "反洗钱/牌照",
        },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("16"),
});

export const layoutId = "digital-currency-overview-taxonomy";
export const layoutName = "Digital Currency Overview & Taxonomy";
export const layoutDescription =
    "A digital-currency overview slide with a definition block, taxonomy cards, a screenshot-safe donut chart, and an editable comparison matrix.";

const svgDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const FeatureIcon = ({ name }: { name: z.infer<typeof featureSchema>["icon"] }) => {
    const className = "h-[18px] w-[18px]";
    const style = { color: "#E53935" };

    switch (name) {
        case "code":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6 10.5 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "bolt":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M13.5 3 6.8 12h4.4L10.5 21l6.7-9h-4.4L13.5 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
            );
        case "shield":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M12 4 18 6.4V11c0 4.1-2.25 7-6 9-3.75-2-6-4.9-6-9V6.4L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <circle cx="12" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9.6 14.2c.45-1.65 1.35-2.5 2.4-2.5 1.05 0 1.95.85 2.4 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
            );
        case "contract":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M7 4.8h8l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6.3A1.5 1.5 0 0 1 7.5 4.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M15 4.8v3h3M9 11h6M9 14.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        default:
            return null;
    }
};

const createDonutChartSvg = ({
    centerLabel,
    segments,
}: {
    centerLabel: string;
    segments: Array<z.infer<typeof chartSegmentSchema>>;
}) => {
    const width = 318;
    const height = 160;
    const centerX = 88;
    const centerY = 80;
    const radius = 42;
    const strokeWidth = 22;
    const circumference = 2 * Math.PI * radius;
    const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;

    let offset = 0;
    const rings = segments
        .map((segment) => {
            const length = (segment.value / total) * circumference;
            const dashoffset = -offset;
            offset += length;

            return `
                <circle
                    cx="${centerX}"
                    cy="${centerY}"
                    r="${radius}"
                    fill="none"
                    stroke="${segment.color}"
                    stroke-width="${strokeWidth}"
                    stroke-dasharray="${length} ${circumference - length}"
                    stroke-dashoffset="${dashoffset}"
                    transform="rotate(-90 ${centerX} ${centerY})"
                />
            `;
        })
        .join("");

    const legend = segments
        .map((segment, index) => {
            const y = 48 + index * 32;
            const percentage = `${Math.round((segment.value / total) * 100)}%`;
            return `
                <rect x="182" y="${y - 8}" width="10" height="10" rx="3" fill="${segment.color}" />
                <text x="200" y="${y}" font-size="11" font-weight="700" fill="#212121" font-family="Roboto, Noto Sans SC, sans-serif">${segment.label}</text>
                <text x="286" y="${y}" text-anchor="end" font-size="11" fill="#757575" font-family="Roboto, Noto Sans SC, sans-serif">${percentage}</text>
            `;
        })
        .join("");

    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <rect width="${width}" height="${height}" rx="14" fill="#FFFFFF" />
            <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="#F2F2F2" stroke-width="${strokeWidth}" />
            ${rings}
            <text x="${centerX}" y="${centerY + 5}" text-anchor="middle" font-size="12" font-weight="700" fill="#616161" font-family="Roboto, Noto Sans SC, sans-serif">${centerLabel}</text>
            ${legend}
        </svg>
    `;
};

const VolatilityTag = ({ label, tone }: { label: string; tone: z.infer<typeof comparisonRowSchema>["volatilityTone"] }) => {
    const palette =
        tone === "low"
            ? { backgroundColor: "#E8F5E9", color: "#2E7D32" }
            : { backgroundColor: "#FFEBEE", color: "#C62828" };

    return (
        <div
            className="flex h-[24px] w-[98px] items-center justify-center rounded-[6px] text-[11px] font-bold whitespace-nowrap"
            style={palette}
        >
            {label}
        </div>
    );
};

const tableGridTemplate = "repeat(5, minmax(0, 1fr))";

const DigitalCurrencyOverviewTaxonomy = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});
    const donutChartDataUri = svgDataUri(
        createDonutChartSvg({
            centerLabel: parsed.chartCenterLabel,
            segments: parsed.chartSegments,
        }),
    );

    return (
        <RedFinanceCanvas>
            <div className="relative z-10 flex h-full flex-col">
                <div className="mx-[60px] flex items-end justify-between pb-[10px] pt-[30px]">
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[36px] w-[6px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1
                            className="text-[36px] font-black tracking-[-0.02em] whitespace-nowrap"
                            style={{ width: "540px", color: "var(--background-text,#212121)" }}
                        >
                            {parsed.title}
                        </h1>
                    </div>
                    <div
                        className="flex items-center gap-[10px] text-[14px] font-medium whitespace-nowrap"
                        style={{ width: "240px", color: "var(--text-muted,#616161)" }}
                    >
                        <FinanceIcon name="list" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="mx-[60px] mb-[16px] flex-none">
                    <div className="h-[2px] w-full rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />
                </div>

                <div className="flex flex-1 flex-col px-[60px] pb-[20px]">
                    <div className="mb-[18px] grid h-[102px] grid-cols-[470px_1fr] gap-[20px]">
                        <div
                            className="relative flex h-full items-center overflow-hidden rounded-[8px] px-[20px] py-[16px]"
                            style={{ backgroundColor: "#FAFAFA" }}
                        >
                            <div className="absolute bottom-[16px] left-[20px] top-[16px] w-[4px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                            <div className="pl-[18px]">
                                <div
                                    className="mb-[6px] text-[12px] font-bold uppercase tracking-[0.12em] whitespace-nowrap"
                                    style={{ width: "96px", color: "var(--primary-color,#B71C1C)" }}
                                >
                                    {parsed.definitionLabel}
                                </div>
                                <div className="text-[14px] font-medium leading-[1.55]" style={{ color: "var(--background-text,#212121)" }}>
                                    {parsed.definitionText}
                                </div>
                            </div>
                        </div>

                        <div className="grid h-full grid-cols-4 gap-[12px]">
                            {parsed.features.map((feature) => (
                                <div
                                    key={feature.label}
                                    className="flex h-full items-center justify-center gap-[10px] rounded-[30px] border px-[12px]"
                                    style={{
                                        backgroundColor: "#FFFFFF",
                                        borderColor: "var(--stroke,#EEEEEE)",
                                        boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                                    }}
                                >
                                    <FeatureIcon name={feature.icon} />
                                    <div
                                        className="text-center text-[13px] font-bold whitespace-nowrap"
                                        style={{ width: "74px", color: "var(--background-text,#212121)" }}
                                    >
                                        {feature.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mb-[18px] flex h-[214px] gap-[24px]">
                        <div className="grid w-[760px] flex-none grid-cols-3 gap-[16px]">
                            {parsed.categories.map((category) => (
                                <div
                                    key={category.title}
                                    className="relative flex flex-col items-center overflow-hidden rounded-[10px] border px-[16px] pb-[16px] pt-[18px] text-center"
                                    style={{
                                        backgroundColor: "#FFFFFF",
                                        borderColor: "var(--stroke,#EEEEEE)",
                                        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
                                    }}
                                >
                                    <div className="absolute left-0 right-0 top-0 h-[6px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                                    <div
                                        className="mb-[12px] flex h-[52px] w-[52px] items-center justify-center rounded-full"
                                        style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
                                    >
                                        <FinanceIcon name={category.icon} className="h-[24px] w-[24px]" color="currentColor" />
                                    </div>
                                    <div
                                        className="mb-[8px] text-[17px] font-extrabold leading-[1.2] whitespace-nowrap"
                                        style={{ width: "210px", color: "var(--background-text,#212121)" }}
                                    >
                                        {category.title}
                                    </div>
                                    <div className="text-[12px] leading-[1.45]" style={{ color: "var(--text-muted,#616161)" }}>
                                        {category.description}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div
                            className="flex flex-1 items-center justify-center rounded-[10px] border p-[12px]"
                            style={{
                                backgroundColor: "#FFFFFF",
                                borderColor: "var(--stroke,#EEEEEE)",
                                boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
                            }}
                        >
                            <div
                                data-pptx-export="screenshot"
                                className="flex h-[160px] w-[318px] items-center justify-center rounded-[14px]"
                                style={{ backgroundColor: "#FFFFFF" }}
                            >
                                <img src={donutChartDataUri} alt="" aria-hidden="true" className="h-[160px] w-[318px]" />
                            </div>
                        </div>
                    </div>

                    <div
                        className="flex flex-col overflow-hidden rounded-[10px] border"
                        style={{
                            backgroundColor: "#FFFFFF",
                            borderColor: "var(--stroke,#EEEEEE)",
                        }}
                    >
                        <div
                            className="grid h-[42px] items-center px-[20px] text-[12px] font-semibold"
                            style={{
                                gridTemplateColumns: tableGridTemplate,
                                backgroundColor: "#212121",
                                color: "#FFFFFF",
                            }}
                        >
                            <div className="px-[10px] whitespace-nowrap text-center">{parsed.columns.category}</div>
                            <div className="px-[10px] whitespace-nowrap text-center">{parsed.columns.issuer}</div>
                            <div className="px-[10px] whitespace-nowrap text-center">{parsed.columns.backing}</div>
                            <div className="px-[10px] whitespace-nowrap text-center">
                                {parsed.columns.volatility}
                            </div>
                            <div className="px-[10px] whitespace-nowrap text-center">{parsed.columns.regulation}</div>
                        </div>

                        <div className="flex flex-col px-[20px]">
                            {parsed.comparisonRows.map((row, index) => (
                                <div key={row.category} className="flex flex-col">
                                    <div
                                        className="grid h-[56px] items-center text-[13px]"
                                        style={{
                                            gridTemplateColumns: tableGridTemplate,
                                            color: "var(--background-text,#212121)",
                                        }}
                                    >
                                        <div
                                            className="px-[10px] text-center text-[13px] font-bold whitespace-nowrap"
                                            style={{ color: "var(--primary-color,#B71C1C)" }}
                                        >
                                            {row.category}
                                        </div>
                                        <div className="px-[10px] text-center">{row.issuer}</div>
                                        <div className="px-[10px] text-center">{row.backing}</div>
                                        <div className="flex justify-center px-[10px]">
                                            <VolatilityTag label={row.volatility} tone={row.volatilityTone} />
                                        </div>
                                        <div className="px-[10px] text-center">{row.regulation}</div>
                                    </div>
                                    {index < parsed.comparisonRows.length - 1 ? (
                                        <div className="h-px w-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="relative flex h-[40px] items-center justify-between px-[60px] text-[12px]" style={{ color: "#9E9E9E", backgroundColor: "var(--background-color,#FFFFFF)" }}>
                    <div className="absolute left-[60px] right-[60px] top-0 h-px" style={{ backgroundColor: "#F5F5F5" }} />
                    <div className="whitespace-nowrap" style={{ width: "260px" }}>
                        {parsed.footerText}
                    </div>
                    <div className="text-[14px] font-bold whitespace-nowrap" style={{ width: "24px", color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </div>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default DigitalCurrencyOverviewTaxonomy;
