import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const riskSeriesSchema = z.object({
    label: z.string().min(4).max(20),
    color: z.string().min(4).max(20),
    fillColor: z.string().min(4).max(32),
    dashed: z.boolean().default(false),
    values: z.array(z.number().min(0).max(100)).min(7).max(7),
});

const legendItemSchema = z.object({
    color: z.string().min(4).max(20),
    label: z.string().min(6).max(28),
});

const pillarItemSchema = z.object({
    lead: z.string().min(2).max(18),
    body: z.string().min(8).max(56),
});

const pillarCardSchema = z.object({
    icon: z.enum(["binoculars", "balance-scale", "robot", "file-signature"]),
    title: z.string().min(4).max(24),
    items: z.array(pillarItemSchema).min(3).max(3),
});

export const Schema = z.object({
    title: z.string().min(4).max(24).default("风险管理与合规"),
    metaLabel: z.string().min(6).max(40).default("RISK MANAGEMENT & COMPLIANCE"),
    riskMapTitle: z.string().min(6).max(24).default("全面风险全景图谱"),
    riskMapSubtitle: z.string().min(6).max(20).default("2026 风险热度分布"),
    radarLabels: z.array(z.string().min(2).max(10)).min(7).max(7).default([
        "信用风险",
        "市场风险",
        "流动性风险",
        "操作风险",
        "网络安全",
        "模型风险",
        "合规风险",
    ]),
    radarSeries: z.array(riskSeriesSchema).min(2).max(2).default([
        {
            label: "2026 风险关注度",
            color: "#B71C1C",
            fillColor: "rgba(183, 28, 28, 0.14)",
            values: [80, 75, 65, 70, 95, 90, 85],
        },
        {
            label: "2023 基准",
            color: "#9E9E9E",
            fillColor: "rgba(158, 158, 158, 0.08)",
            dashed: true,
            values: [85, 70, 75, 60, 65, 50, 70],
        },
    ]),
    riskLegend: z.array(legendItemSchema).min(2).max(2).default([
        { color: "#B71C1C", label: "高风险关注领域 (Cyber / AI)" },
        { color: "#E57373", label: "传统核心风险 (Credit / Market)" },
    ]),
    insightLabel: z.string().min(4).max(12).default("关键洞察"),
    insightBody: z
        .string()
        .min(16)
        .max(120)
        .default("随着数字化深入，网络安全与模型风险显著上升，已成为与传统信用风险并列的一级管控重点。"),
    pillarsTitle: z.string().min(6).max(24).default("风险治理四大支柱"),
    pillars: z.array(pillarCardSchema).min(4).max(4).default([
        {
            icon: "binoculars",
            title: "前瞻性管理",
            items: [
                { lead: "压力测试", body: "建立宏观下行与极端波动场景库，系统检验资产组合韧性。" },
                { lead: "早期预警", body: "利用高频数据构建违约与市场异动指标，前移风险识别窗口。" },
                { lead: "拨备策略", body: "基于 ECL 模型动态调整拨备覆盖率，平衡风险暴露与盈利质量。" },
            ],
        },
        {
            icon: "balance-scale",
            title: "资产负债管理 (ALM)",
            items: [
                { lead: "流动性管控", body: "强化 LCR / NSFR 监控，优化资产负债期限与结构匹配。" },
                { lead: "利率风险", body: "应对利率市场化波动，结合久期管理与对冲工具稳定净息差。" },
                { lead: "资本规划", body: "确保核心一级资本充足率满足巴塞尔协议 III 最终版要求。" },
            ],
        },
        {
            icon: "robot",
            title: "AI 与模型治理",
            items: [
                { lead: "模型可解释性", body: "确保信贷与风控模型具备可解释性，支持审计复核与监管披露。" },
                { lead: "数据质量", body: "治理训练数据偏差，降低算法歧视与伦理风险，夯实模型输入基础。" },
                { lead: "全生命周期", body: "建立开发、验证、部署、监控到退役的闭环治理体系。" },
            ],
        },
        {
            icon: "file-signature",
            title: "合规与反洗钱",
            items: [
                { lead: "智能合规", body: "利用 NLP 自动解读监管要求，并将规则嵌入制度与系统流程。" },
                { lead: "反洗钱 (AML)", body: "升级交易监测能力，重点关注虚拟资产与跨境资金流动。" },
                { lead: "数据合规", body: "严格遵守数据安全法与 GDPR，落实跨境数据流动评估机制。" },
            ],
        },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("08"),
});

export const layoutId = "risk-management-compliance";
export const layoutName = "Risk Management Compliance";
export const layoutDescription = "A risk management slide with a static radar chart, risk insight panel, and four governance pillar cards.";

const svgDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

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
    series: Array<z.infer<typeof riskSeriesSchema>>;
}) => {
    const width = 360;
    const height = 268;
    const centerX = 180;
    const centerY = 136;
    const radius = 96;
    const ringLevels = [0.2, 0.4, 0.6, 0.8, 1];
    const baseAngle = -Math.PI / 2;
    const angleStep = (Math.PI * 2) / labels.length;

    const axes = labels.map((label, index) => {
        const angle = baseAngle + angleStep * index;
        const axisPoint = polarPoint(centerX, centerY, radius, angle);
        const labelPoint = polarPoint(centerX, centerY, radius + 28, angle);

        return {
            label,
            angle,
            axisPoint,
            labelPoint,
        };
    });

    const rings = ringLevels
        .map((level) => {
            const polygon = axes
                .map(({ angle }) => {
                    const point = polarPoint(centerX, centerY, radius * level, angle);
                    return `${point.x},${point.y}`;
                })
                .join(" ");

            return `<polygon points="${polygon}" fill="none" stroke="#EEEEEE" stroke-width="1"/>`;
        })
        .join("");

    const axisLines = axes
        .map(
            ({ axisPoint }) =>
                `<line x1="${centerX}" y1="${centerY}" x2="${axisPoint.x}" y2="${axisPoint.y}" stroke="#E8E8E8" stroke-width="1"/>`,
        )
        .join("");

    const axisLabels = axes
        .map(({ label, labelPoint }) => {
            const anchor = labelAnchor(labelPoint.x, centerX);
            return `<text x="${labelPoint.x}" y="${labelPoint.y + 4}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="#424242" font-family="Roboto, Noto Sans SC, sans-serif">${label}</text>`;
        })
        .join("");

    const tickLabels = ringLevels
        .map((level) => {
            const tickY = centerY - radius * level;
            return `<text x="${centerX + 8}" y="${tickY + 4}" font-size="9" fill="#B0B0B0" font-family="Roboto, Noto Sans SC, sans-serif">${Math.round(level * 100)}</text>`;
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
                    return `<circle cx="${point.x}" cy="${point.y}" r="3.6" fill="#FFFFFF" stroke="${entry.color}" stroke-width="2"/>`;
                })
                .join("");

            return `
                <polygon points="${points}" fill="${entry.fillColor}" stroke="${entry.color}" stroke-width="${entry.dashed ? 1.6 : 2.4}" ${entry.dashed ? 'stroke-dasharray="5 4"' : ""}/>
                ${nodes}
            `;
        })
        .join("");

    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <rect width="${width}" height="${height}" rx="16" fill="#FAFAFA"/>
            ${rings}
            ${axisLines}
            ${polygons}
            ${axisLabels}
            ${tickLabels}
        </svg>
    `;
};

const SectionHeading = ({
    title,
    subtitle,
}: {
    title: string;
    subtitle?: string;
}) => (
    <div className="mb-[14px] flex items-end justify-between gap-[12px]">
        <div className="flex items-center gap-[10px]">
            <div className="h-[22px] w-[4px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
            <h2 className="text-[18px] font-bold leading-none" style={{ color: "var(--background-text,#212121)" }}>
                {title}
            </h2>
        </div>
        {subtitle ? (
            <div className="whitespace-nowrap text-[12px] leading-none" style={{ color: "#9E9E9E" }}>
                {subtitle}
            </div>
        ) : null}
    </div>
);

const BlockDivider = ({
    color,
    segments = 16,
    height = 2,
    gap = 4,
}: {
    color: string;
    segments?: number;
    height?: number;
    gap?: number;
}) => (
    <div className="flex w-full" style={{ gap: `${gap}px` }}>
        {Array.from({ length: segments }).map((_, index) => (
            <div
                key={index}
                className="flex-1 rounded-full"
                style={{
                    height: `${height}px`,
                    backgroundColor: color,
                }}
            />
        ))}
    </div>
);

const SeriesLegend = ({ item }: { item: z.infer<typeof riskSeriesSchema> }) => (
    <div className="flex items-center gap-[8px]">
        <div className="relative h-[10px] w-[26px] flex-none">
            {item.dashed ? (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                    <BlockDivider color={item.color} segments={3} height={2} gap={3} />
                </div>
            ) : (
                <div
                    className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2"
                    style={{ backgroundColor: item.color }}
                />
            )}
            <div
                className="absolute left-1/2 top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: "#FFFFFF", border: `2px solid ${item.color}` }}
            />
        </div>
        <span className="text-[11px]" style={{ color: "var(--text-muted,#616161)" }}>
            {item.label}
        </span>
    </div>
);

const PillarIcon = ({ name }: { name: z.infer<typeof pillarCardSchema>["icon"] }) => {
    const className = "h-[20px] w-[20px]";
    const style = { color: "var(--primary-color,#B71C1C)" };

    switch (name) {
        case "binoculars":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M7.2 8.2 5.8 12.3M16.8 8.2l1.4 4.1M9.2 6.2h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="7.2" cy="15.2" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="16.8" cy="15.2" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M10.4 15.2h3.2M8.8 8.2h2.2v4.1M13 8.2h2.2v4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "balance-scale":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M12 5v14M8 7h8M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8 7 5.5 11h5ZM16 7l-2.5 4h5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M5.7 11.2c.4 1.5 1.3 2.3 2.3 2.3s1.9-.8 2.3-2.3M13.7 11.2c.4 1.5 1.3 2.3 2.3 2.3s1.9-.8 2.3-2.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "robot":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <rect x="6" y="8" width="12" height="9" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 4.5v2.5M9.5 12h.01M14.5 12h.01M9 15.2h6M4.8 10.5v4M19.2 10.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "file-signature":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M8 4.8h6.5L18 8.4v10a1.6 1.6 0 0 1-1.6 1.6H8A2 2 0 0 1 6 18V6.8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M14.5 4.8v3.8H18M9 12.2h6M9 15.4h3.6M12.6 18c.9-1 1.7-1.4 2.6-1.4.7 0 1.4.2 2 .6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        default:
            return null;
    }
};

const RiskManagementCompliance = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});
    const radarChartDataUri = svgDataUri(createRadarChartSvg({ labels: parsed.radarLabels, series: parsed.radarSeries }));

    return (
        <RedFinanceCanvas>
            <div className="relative z-10 h-full">
                <div className="absolute left-[60px] right-[60px] top-[30px] flex items-end justify-between pb-[10px]">
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[36px] w-[6px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1 className="text-[36px] font-black tracking-[-0.02em]" style={{ color: "var(--background-text,#212121)" }}>
                            {parsed.title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-[10px] whitespace-nowrap text-[14px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                        <FinanceIcon name="shield-alt" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="absolute left-[60px] right-[60px] top-[101px] h-[3px]" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                <div className="absolute left-[60px] right-[60px] top-[122px] flex h-[558px] gap-[28px]">
                    <div
                        className="flex h-full w-[390px] flex-none flex-col rounded-[10px] border px-[16px] py-[16px]"
                        style={{
                            backgroundColor: "#FAFAFA",
                            borderColor: "var(--stroke,#EEEEEE)",
                            boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
                        }}
                    >
                        <div
                            data-pptx-export="screenshot"
                            className="mb-[12px] flex h-[372px] flex-col rounded-[8px] px-[14px] py-[14px]"
                            style={{ backgroundColor: "#FAFAFA" }}
                        >
                            <SectionHeading title={parsed.riskMapTitle} subtitle={parsed.riskMapSubtitle} />

                            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-[6px]" style={{ backgroundColor: "#FAFAFA" }}>
                                <img src={radarChartDataUri} alt="" className="h-[268px] w-[340px] object-contain" />
                            </div>

                            <div className="mt-[12px] flex items-center justify-center gap-[24px]">
                                {parsed.radarSeries.map((item) => (
                                    <SeriesLegend key={item.label} item={item} />
                                ))}
                            </div>
                        </div>

                        <div className="mb-[12px] flex flex-wrap items-center justify-center gap-x-[28px] gap-y-[8px] px-[8px] text-center">
                            {parsed.riskLegend.map((item) => (
                                <div key={item.label} className="flex items-center gap-[8px]">
                                    <div className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: item.color }} />
                                    <div className="text-[11px] leading-[1.3]" style={{ color: "var(--text-muted,#616161)" }}>
                                        {item.label}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div
                            className="rounded-[8px] border px-[14px] py-[12px]"
                            style={{ backgroundColor: "#FFFFFF", borderColor: "var(--stroke,#EEEEEE)" }}
                        >
                            <div className="mb-[6px] text-[13px] font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                                {parsed.insightLabel}
                            </div>
                            <div className="text-[12px] leading-[1.55]" style={{ color: "var(--text-muted,#616161)" }}>
                                {parsed.insightBody}
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                        <SectionHeading title={parsed.pillarsTitle} />

                        <div className="grid h-[522px] grid-cols-2 gap-[18px]">
                            {parsed.pillars.map((pillar) => (
                                <div
                                    key={pillar.title}
                                    className="relative flex h-[252px] flex-col overflow-hidden rounded-[8px] border px-[18px] pb-[14px] pt-[16px]"
                                    style={{
                                        backgroundColor: "var(--background-color,#FFFFFF)",
                                        borderColor: "var(--stroke,#EEEEEE)",
                                        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
                                    }}
                                >
                                    <div className="absolute left-0 top-0 h-[4px] w-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />

                                    <div className="mb-[10px] flex items-center gap-[12px]">
                                        <div
                                            className="flex h-[36px] w-[36px] flex-none items-center justify-center rounded-[10px]"
                                            style={{ backgroundColor: "#FFEBEE" }}
                                        >
                                            <PillarIcon name={pillar.icon} />
                                        </div>
                                        <h3 className="text-[15px] font-bold leading-[1.25]" style={{ color: "var(--background-text,#212121)" }}>
                                            {pillar.title}
                                        </h3>
                                    </div>

                                    <div className="mb-[10px]">
                                        <BlockDivider color="#E6E6E6" segments={16} height={2} gap={4} />
                                    </div>

                                    <div className="flex flex-1 flex-col gap-[8px]">
                                        {pillar.items.map((item) => (
                                            <div key={`${pillar.title}-${item.lead}`} className="flex items-start gap-[8px]">
                                                <div
                                                    className="mt-[6px] h-[6px] w-[6px] flex-none rounded-full"
                                                    style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-[1px] text-[12px] font-bold leading-[1.25]" style={{ color: "var(--background-text,#212121)" }}>
                                                        {item.lead}
                                                    </div>
                                                    <div className="text-[11px] leading-[1.35]" style={{ color: "var(--text-muted,#616161)" }}>
                                                        {item.body}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div
                    className="absolute bottom-0 left-0 right-0 flex h-[40px] items-center justify-between px-[60px] text-[12px]"
                    style={{ color: "#9E9E9E", backgroundColor: "var(--background-color,#FFFFFF)" }}
                >
                    <div className="absolute left-[60px] right-[60px] top-0 h-[2px]" style={{ backgroundColor: "#F5F5F5" }} />
                    <p>{parsed.footerText}</p>
                    <p className="font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </p>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default RiskManagementCompliance;
