import type { ReactNode } from "react";
import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const architectureLayerSchema = z.object({
    icon: z.enum(["experience", "smart", "ledger", "security"]),
    title: z.string().min(4).max(28),
    description: z.string().min(6).max(40),
});

const radarSeriesSchema = z.object({
    label: z.string().min(4).max(24),
    shortLabel: z.string().min(1).max(4),
    color: z.string().min(4).max(20),
    fillColor: z.string().min(4).max(32),
    values: z.array(z.number().min(0).max(100)).min(6).max(6),
});

const metricCardSchema = z.object({
    icon: z.enum(["throughput", "resilience", "governance", "traceability", "privacy", "compliance"]),
    title: z.string().min(2).max(20),
    primaryValue: z.number().min(0).max(100),
    secondaryValue: z.number().min(0).max(100),
});

export const Schema = z.object({
    title: z.string().min(6).max(28).default("数字货币技术架构与安全"),
    metaLabel: z.string().min(6).max(40).default("TECH ARCHITECTURE & SECURITY"),
    stackTitle: z.string().min(4).max(28).default("核心技术栈"),
    stackMeta: z.string().min(4).max(24).default("Tech Stack"),
    layers: z.array(architectureLayerSchema).min(4).max(4).default([
        {
            icon: "experience",
            title: "体验层 (Experience)",
            description: "数字钱包 · 硬件终端 · API接口",
        },
        {
            icon: "smart",
            title: "智能层 (Smart)",
            description: "智能合约 · 隐私计算 · 监管探针",
        },
        {
            icon: "ledger",
            title: "账本层 (Ledger)",
            description: "分布式账本 · 共识机制 · 状态机",
        },
        {
            icon: "security",
            title: "密钥层 (Key Security)",
            description: "HSM机具 · 多重签名 · 门限签名",
        },
    ]),
    comparisonTitle: z.string().min(6).max(32).default("架构对比分析"),
    comparisonMeta: z.string().min(4).max(28).default("Architecture Comparison"),
    chartTitle: z.string().min(4).max(24).default("架构能力雷达"),
    radarLabels: z.array(z.string().min(2).max(12)).min(6).max(6).default(["吞吐量", "韧性", "治理", "合规", "隐私", "追溯"]),
    radarSeries: z.array(radarSeriesSchema).min(2).max(2).default([
        {
            label: "中心化 (CBDC)",
            shortLabel: "C",
            color: "#B71C1C",
            fillColor: "rgba(183, 28, 28, 0.18)",
            values: [95, 60, 90, 100, 80, 85],
        },
        {
            label: "去中心化 (Crypto)",
            shortLabel: "D",
            color: "#9E9E9E",
            fillColor: "rgba(158, 158, 158, 0.16)",
            values: [30, 95, 40, 20, 40, 70],
        },
    ]),
    metrics: z.array(metricCardSchema).min(6).max(6).default([
        {
            icon: "throughput",
            title: "吞吐量 (TPS)",
            primaryValue: 95,
            secondaryValue: 30,
        },
        {
            icon: "resilience",
            title: "系统韧性",
            primaryValue: 60,
            secondaryValue: 95,
        },
        {
            icon: "governance",
            title: "治理效率",
            primaryValue: 90,
            secondaryValue: 40,
        },
        {
            icon: "traceability",
            title: "可追溯性",
            primaryValue: 85,
            secondaryValue: 70,
        },
        {
            icon: "privacy",
            title: "隐私保护",
            primaryValue: 80,
            secondaryValue: 40,
        },
        {
            icon: "compliance",
            title: "监管合规",
            primaryValue: 100,
            secondaryValue: 20,
        },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(1).max(4).default("19"),
});

export const layoutId = "digital-currency-architecture-security";
export const layoutName = "Digital Currency Architecture Security";
export const layoutDescription =
    "A digital currency architecture slide with editable tech-stack cards, a screenshot-safe radar chart, and six comparison metric cards.";

const svgDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const escapeXml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");

const polarPoint = (centerX: number, centerY: number, radius: number, angle: number) => ({
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
});

const labelAnchor = (x: number, centerX: number) => {
    if (x > centerX + 12) {
        return "start";
    }
    if (x < centerX - 12) {
        return "end";
    }
    return "middle";
};

const createRadarChartSvg = ({
    labels,
    series,
}: {
    labels: string[];
    series: Array<z.infer<typeof radarSeriesSchema>>;
}) => {
    const width = 360;
    const height = 276;
    const centerX = 180;
    const centerY = 134;
    const radius = 94;
    const ringLevels = Array.from({ length: 5 }, (_, index) => (index + 1) / 5);
    const baseAngle = -Math.PI / 2;
    const angleStep = (Math.PI * 2) / labels.length;

    const axes = labels.map((label, index) => {
        const angle = baseAngle + angleStep * index;
        return {
            angle,
            label,
            axisPoint: polarPoint(centerX, centerY, radius, angle),
            labelPoint: polarPoint(centerX, centerY, radius + 28, angle),
        };
    });

    const rings = ringLevels
        .map((level) => {
            const points = axes
                .map(({ angle }) => {
                    const point = polarPoint(centerX, centerY, radius * level, angle);
                    return `${point.x},${point.y}`;
                })
                .join(" ");
            return `<polygon points="${points}" fill="none" stroke="#E7E7E7" stroke-width="1"/>`;
        })
        .join("");

    const axisLines = axes
        .map(
            ({ axisPoint }) =>
                `<line x1="${centerX}" y1="${centerY}" x2="${axisPoint.x}" y2="${axisPoint.y}" stroke="#E5E5E5" stroke-width="1"/>`,
        )
        .join("");

    const axisLabels = axes
        .map(({ label, labelPoint }) => {
            const anchor = labelAnchor(labelPoint.x, centerX);
            const y =
                labelPoint.y < centerY - radius * 0.7
                    ? labelPoint.y + 9
                    : labelPoint.y > centerY + radius * 0.7
                      ? labelPoint.y
                      : labelPoint.y + 4;
            return `<text x="${labelPoint.x}" y="${y}" text-anchor="${anchor}" font-size="11.5" font-weight="700" fill="#616161" font-family="Roboto, Noto Sans SC, sans-serif">${escapeXml(
                label,
            )}</text>`;
        })
        .join("");

    const tickLabels = ringLevels
        .map((level) => {
            const y = centerY - radius * level;
            return `<text x="${centerX + 8}" y="${y + 4}" font-size="9" fill="#B7B7B7" font-family="Roboto, Noto Sans SC, sans-serif">${Math.round(
                level * 100,
            )}</text>`;
        })
        .join("");

    const polygons = series
        .map((entry) => {
            const points = entry.values
                .map((value, index) => {
                    const ratio = Math.max(0, Math.min(100, value)) / 100;
                    return polarPoint(centerX, centerY, radius * ratio, axes[index].angle);
                })
                .map((point) => `${point.x},${point.y}`)
                .join(" ");

            const nodes = entry.values
                .map((value, index) => {
                    const ratio = Math.max(0, Math.min(100, value)) / 100;
                    const point = polarPoint(centerX, centerY, radius * ratio, axes[index].angle);
                    return `<circle cx="${point.x}" cy="${point.y}" r="3.3" fill="#FFFFFF" stroke="${entry.color}" stroke-width="2"/>`;
                })
                .join("");

            return `<polygon points="${points}" fill="${entry.fillColor}" stroke="${entry.color}" stroke-width="2.2"/>${nodes}`;
        })
        .join("");

    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#FAFAFA"/>
            ${rings}
            ${axisLines}
            ${polygons}
            ${axisLabels}
            ${tickLabels}
            <circle cx="${centerX}" cy="${centerY}" r="2.5" fill="#D8D8D8"/>
        </svg>
    `;
};

const SectionHeading = ({
    title,
    meta,
    icon,
}: {
    title: string;
    meta: string;
    icon: ReactNode;
}) => (
    <div className="mb-[16px] flex items-center gap-[8px]">
        <div style={{ color: "var(--primary-color,#B71C1C)" }}>{icon}</div>
        <div className="whitespace-nowrap text-[14px] font-bold uppercase tracking-[0.08em]" style={{ width: "118px", color: "var(--primary-color,#B71C1C)" }}>
            {title}
        </div>
        <div className="whitespace-nowrap text-[13px] font-semibold" style={{ width: "180px", color: "#8E8E8E" }}>
            {meta}
        </div>
    </div>
);

const TechLayerIcon = ({ name }: { name: z.infer<typeof architectureLayerSchema>["icon"] }) => {
    const className = "h-[22px] w-[22px]";
    const style = { color: "currentColor" };

    switch (name) {
        case "experience":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <rect x="7" y="3.8" width="10" height="16.4" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M10 6.8h4M9.4 16.2h5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="12" cy="16.2" r="1" fill="currentColor" stroke="none" />
                </svg>
            );
        case "smart":
            return <FinanceIcon name="microchip" className={className} color="currentColor" />;
        case "ledger":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <rect x="5" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8.2 9.2h7.6M8.2 12h7.6M8.2 14.8h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "security":
            return <FinanceIcon name="shield-alt" className={className} color="currentColor" />;
        default:
            return null;
    }
};

const MetricIcon = ({ name }: { name: z.infer<typeof metricCardSchema>["icon"] }) => {
    const className = "h-[16px] w-[16px]";
    const style = { color: "currentColor" };

    switch (name) {
        case "throughput":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M7 15.8a5 5 0 1 1 10 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="m12 13 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "resilience":
            return <FinanceIcon name="shield-alt" className={className} color="currentColor" />;
        case "governance":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M12 5v14M8 7h8M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8 7 5.5 11h5ZM16 7l-2.5 4h5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
            );
        case "traceability":
            return <FinanceIcon name="route" className={className} color="currentColor" />;
        case "privacy":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M12 4 18 6.4V11c0 4.1-2.25 7-6 9-3.75-2-6-4.9-6-9V6.4L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M10.2 12.4a1.8 1.8 0 1 1 3.6 0v2.6h-3.6Zm0 0v-1.1a1.8 1.8 0 0 1 3.6 0v1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "compliance":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M8 4.8h6.4L18 8.4v9.8a1.8 1.8 0 0 1-1.8 1.8H8a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M14.4 4.8v3.8H18M9 12.2h6M9 15.2h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        default:
            return null;
    }
};

const StackCard = ({ item }: { item: z.infer<typeof architectureLayerSchema> }) => (
    <div
        className="relative z-10 flex items-center overflow-hidden rounded-[10px] border px-[16px] py-[14px]"
        style={{
            backgroundColor: "#FFFFFF",
            borderColor: "var(--stroke,#EEEEEE)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
        }}
    >
        <div className="absolute left-0 top-0 h-full w-[5px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
        <div
            className="mr-[14px] flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[10px]"
            style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
        >
            <TechLayerIcon name={item.icon} />
        </div>
        <div className="min-w-0 flex-1">
            <div className="mb-[4px] whitespace-nowrap text-[16px] font-black leading-none" style={{ width: "220px", color: "var(--background-text,#212121)" }}>
                {item.title}
            </div>
            <div className="whitespace-nowrap text-[12px] font-medium leading-none" style={{ width: "232px", color: "var(--text-muted,#616161)" }}>
                {item.description}
            </div>
        </div>
    </div>
);

const SeriesLegend = ({ item }: { item: z.infer<typeof radarSeriesSchema> }) => (
    <div className="flex items-center gap-[6px]">
        <div className="h-[9px] w-[9px] rounded-full" style={{ backgroundColor: item.color }} />
        <div className="whitespace-nowrap text-[11px] font-semibold leading-none" style={{ width: "104px", color: "var(--text-muted,#616161)" }}>
            {item.label}
        </div>
    </div>
);

const MetricRow = ({
    label,
    color,
    value,
}: {
    label: string;
    color: string;
    value: number;
}) => (
    <div className="flex items-center gap-[8px]">
        <div className="whitespace-nowrap text-[10px] font-semibold leading-none" style={{ width: "14px", color: "var(--text-muted,#616161)" }}>
            {label}
        </div>
        <div className="h-[4px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "#F1F1F1" }}>
            <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
        </div>
        <div className="whitespace-nowrap text-[10px] font-semibold leading-none text-right" style={{ width: "32px", color: "#8A8A8A" }}>
            {value}%
        </div>
    </div>
);

const MetricCard = ({
    item,
    primary,
    secondary,
}: {
    item: z.infer<typeof metricCardSchema>;
    primary: z.infer<typeof radarSeriesSchema>;
    secondary: z.infer<typeof radarSeriesSchema>;
}) => (
    <div
        className="flex flex-col justify-center rounded-[8px] border px-[14px] py-[10px]"
        style={{
            backgroundColor: "#FFFFFF",
            borderColor: "var(--stroke,#EEEEEE)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
        }}
    >
        <div className="mb-[8px] flex items-center gap-[8px]" style={{ color: "var(--primary-color,#B71C1C)" }}>
            <MetricIcon name={item.icon} />
            <div className="whitespace-nowrap text-[13px] font-bold leading-none" style={{ width: "126px", color: "var(--background-text,#212121)" }}>
                {item.title}
            </div>
        </div>
        <div className="flex flex-col gap-[6px]">
            <MetricRow label={primary.shortLabel} color={primary.color} value={item.primaryValue} />
            <MetricRow label={secondary.shortLabel} color={secondary.color} value={item.secondaryValue} />
        </div>
    </div>
);

const DigitalCurrencyArchitectureSecurity = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});
    const [primarySeries, secondarySeries] = parsed.radarSeries;
    const radarChartDataUri = svgDataUri(createRadarChartSvg({ labels: parsed.radarLabels, series: parsed.radarSeries }));

    return (
        <RedFinanceCanvas>
            <div className="relative h-full">
                <div className="absolute left-[60px] right-[60px] top-[30px] flex items-end justify-between pb-[10px]">
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[36px] w-[6px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1
                            className="whitespace-nowrap text-[34px] font-black leading-none tracking-[-0.03em]"
                            style={{ width: "430px", color: "var(--background-text,#212121)" }}
                        >
                            {parsed.title}
                        </h1>
                    </div>
                    <div
                        className="flex w-[280px] items-center justify-end gap-[10px] whitespace-nowrap text-[14px] font-medium"
                        style={{ color: "var(--text-muted,#616161)" }}
                    >
                        <FinanceIcon name="shield-alt" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="absolute left-[60px] right-[60px] top-[101px] h-[2px] rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                <div className="absolute left-[60px] right-[60px] top-[122px] bottom-[52px] flex gap-[34px]">
                    <div className="relative flex w-[348px] flex-none flex-col">
                        <SectionHeading title={parsed.stackTitle} meta={parsed.stackMeta} icon={<FinanceIcon name="list" className="h-[16px] w-[16px]" color="currentColor" />} />
                        <div
                            className="absolute left-[22px] top-[54px] bottom-[26px] w-[2px] rounded-full"
                            style={{ backgroundColor: "#E0E0E0" }}
                        />
                        <div className="mt-[2px] flex flex-1 flex-col justify-center gap-[14px]">
                            {parsed.layers.map((item) => (
                                <StackCard key={item.title} item={item} />
                            ))}
                        </div>
                    </div>

                    <div
                        className="flex min-w-0 flex-1 flex-col rounded-[12px] px-[6px] py-[4px]"
                        style={{ backgroundColor: "#FFFFFF" }}
                    >
                        <SectionHeading
                            title={parsed.comparisonTitle}
                            meta={parsed.comparisonMeta}
                            icon={<FinanceIcon name="chart-line" className="h-[16px] w-[16px]" color="currentColor" />}
                        />

                        <div className="flex flex-1 gap-[26px]">
                            <div className="flex h-full w-[352px] flex-none flex-col">
                                <div className="mb-[10px] whitespace-nowrap text-[15px] font-bold leading-none" style={{ width: "150px", color: "var(--background-text,#212121)" }}>
                                    {parsed.chartTitle}
                                </div>
                                <div
                                    data-pptx-export="screenshot"
                                    className="flex min-h-0 flex-1 flex-col rounded-[12px] border px-[12px] py-[12px]"
                                    style={{ backgroundColor: "#FAFAFA", borderColor: "var(--stroke,#EEEEEE)" }}
                                >
                                    <div className="flex flex-1 items-center justify-center overflow-hidden rounded-[10px]" style={{ backgroundColor: "#FAFAFA" }}>
                                        <img src={radarChartDataUri} alt="" aria-hidden="true" className="h-[276px] w-[360px] object-contain" />
                                    </div>
                                    <div className="mt-[12px] flex items-center justify-center gap-[14px]">
                                        {parsed.radarSeries.map((item) => (
                                            <SeriesLegend key={item.label} item={item} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid flex-1 grid-cols-2 grid-rows-3 gap-[12px]">
                                {parsed.metrics.map((item) => (
                                    <MetricCard key={item.title} item={item} primary={primarySeries} secondary={secondarySeries} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-[40px] left-[60px] right-[60px] h-[1px]" style={{ backgroundColor: "#F5F5F5" }} />

                <div className="absolute bottom-0 left-0 right-0 flex h-[40px] items-center justify-between px-[60px] text-[12px]" style={{ color: "#9E9E9E", backgroundColor: "#FFFFFF" }}>
                    <div className="whitespace-nowrap font-medium tracking-[0.02em]" style={{ width: "280px" }}>
                        {parsed.footerText}
                    </div>
                    <div className="whitespace-nowrap text-[14px] font-black leading-none" style={{ width: "28px", color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </div>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default DigitalCurrencyArchitectureSecurity;
