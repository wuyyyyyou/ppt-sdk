import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const trendCardSchema = z.object({
    icon: z.enum(["robot", "coins", "network", "leaf", "globe"]),
    title: z.string().min(2).max(20),
    description: z.string().min(12).max(64),
});

const lineSeriesSchema = z.object({
    label: z.string().min(2).max(12),
    color: z.string().min(4).max(16),
    values: z.array(z.number().min(0).max(100)).min(4).max(4),
});

const barSeriesSchema = z.object({
    label: z.string().min(2).max(12),
    color: z.string().min(4).max(16),
    values: z.array(z.number().min(0).max(60)).min(3).max(3),
});

export const Schema = z.object({
    title: z.string().min(4).max(24).default("市场趋势（2026）"),
    metaLabel: z.string().min(4).max(40).default("MARKET TRENDS"),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("04"),
    trends: z.array(trendCardSchema).min(5).max(5).default([
        { icon: "robot", title: "AI规模化落地", description: "客服/风控/运营自动化加速，生成式AI重塑前中后台流程。" },
        { icon: "coins", title: "财富管理崛起", description: "从“吃息差”转向“赚中收”，投顾与托管业务深度协同。" },
        { icon: "network", title: "开放金融生态", description: "API协作与跨界联合，构建平台化金融服务能力。" },
        { icon: "leaf", title: "绿色与ESG", description: "绿色信贷体系完善，碳金融产品创新与披露常态化。" },
        { icon: "globe", title: "跨境业务深化", description: "资本市场互联互通，跨境支付与结算便利化提升。" },
    ]),
    aiChartTitle: z.string().min(8).max(40).default("金融机构AI技术应用渗透率预测"),
    aiChartTag: z.string().min(4).max(16).default("2024-2027E"),
    aiChartLabels: z.array(z.string().min(4).max(8)).min(4).max(4).default(["2024", "2025", "2026E", "2027E"]),
    aiChartSeries: z.array(lineSeriesSchema).min(3).max(3).default([
        { label: "智能客服", color: "#B71C1C", values: [45, 58, 72, 85] },
        { label: "智能风控", color: "#EF5350", values: [60, 68, 78, 88] },
        { label: "智能投研", color: "#FF8A80", values: [30, 42, 55, 68] },
    ]),
    incomeChartTitle: z.string().min(8).max(32).default("银行业收入结构变化趋势"),
    incomeChartTag: z.string().min(4).max(20).default("非息收入占比 (%)"),
    incomeChartLabels: z.array(z.string().min(2).max(8)).min(3).max(3).default(["大型银行", "股份制银行", "城商行"]),
    incomeChartSeries: z.array(barSeriesSchema).min(2).max(2).default([
        { label: "2024", color: "#FFCDD2", values: [28, 32, 18] },
        { label: "2026E", color: "#B71C1C", values: [35, 40, 24] },
    ]),
});

export const layoutId = "market-trends-2026";
export const layoutName = "Market Trends 2026";
export const layoutDescription = "A finance trend slide with five market drivers and two forecast charts for AI adoption and income structure.";

const svgDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const createLineChartSvg = ({
    labels,
    series,
}: {
    labels: string[];
    series: Array<z.infer<typeof lineSeriesSchema>>;
}) => {
    const width = 520;
    const height = 226;
    const plotLeft = 48;
    const plotRight = 18;
    const plotTop = 20;
    const plotBottom = 40;
    const plotWidth = width - plotLeft - plotRight;
    const plotHeight = height - plotTop - plotBottom;
    const yTicks = [0, 20, 40, 60, 80, 100];
    const xStep = plotWidth / Math.max(1, labels.length - 1);

    const grid = yTicks
        .map((tick) => {
            const y = plotTop + plotHeight - (tick / 100) * plotHeight;
            return `
                <line x1="${plotLeft}" y1="${y}" x2="${width - plotRight}" y2="${y}" stroke="#EEEEEE" stroke-width="1"/>
                <text x="${plotLeft - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9E9E9E" font-family="Roboto, Noto Sans SC, sans-serif">${tick}%</text>
            `;
        })
        .join("");

    const xLabels = labels
        .map((label, index) => {
            const x = plotLeft + xStep * index;
            return `<text x="${x}" y="${height - 20}" text-anchor="middle" font-size="11" fill="#616161" font-family="Roboto, Noto Sans SC, sans-serif">${label}</text>`;
        })
        .join("");

    const lines = series
        .map((entry) => {
            const points = entry.values
                .map((value, index) => {
                    const x = plotLeft + xStep * index;
                    const y = plotTop + plotHeight - (clamp(value, 0, 100) / 100) * plotHeight;
                    return { x, y };
                });

            const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
            const circles = points
                .map(
                    (point) => `
                        <circle cx="${point.x}" cy="${point.y}" r="4" fill="#FFFFFF" stroke="${entry.color}" stroke-width="2"/>
                    `,
                )
                .join("");

            return `
                <polyline points="${polyline}" fill="none" stroke="${entry.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                ${circles}
            `;
        })
        .join("");

    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <rect width="${width}" height="${height}" fill="#FAFAFA"/>
            ${grid}
            <line x1="${plotLeft}" y1="${plotTop + plotHeight}" x2="${width - plotRight}" y2="${plotTop + plotHeight}" stroke="#DADADA" stroke-width="1"/>
            ${lines}
            ${xLabels}
        </svg>
    `;
};

const createGroupedBarChartSvg = ({
    labels,
    series,
}: {
    labels: string[];
    series: Array<z.infer<typeof barSeriesSchema>>;
}) => {
    const width = 520;
    const height = 198;
    const plotLeft = 46;
    const plotRight = 16;
    const plotTop = 20;
    const plotBottom = 16;
    const plotWidth = width - plotLeft - plotRight;
    const plotHeight = height - plotTop - plotBottom;
    const yTicks = [0, 10, 20, 30, 40, 50];
    const groupWidth = plotWidth / labels.length;
    const barWidth = 28;
    const barGap = 8;

    const grid = yTicks
        .map((tick) => {
            const y = plotTop + plotHeight - (tick / 50) * plotHeight;
            return `
                <line x1="${plotLeft}" y1="${y}" x2="${width - plotRight}" y2="${y}" stroke="#EEEEEE" stroke-width="1"/>
                <text x="${plotLeft - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9E9E9E" font-family="Roboto, Noto Sans SC, sans-serif">${tick}%</text>
            `;
        })
        .join("");

    const bars = labels
        .map((_, groupIndex) => {
            const groupCenter = plotLeft + groupWidth * groupIndex + groupWidth / 2;
            const totalBarWidth = series.length * barWidth + (series.length - 1) * barGap;
            const groupLeft = groupCenter - totalBarWidth / 2;

            const barRects = series
                .map((entry, seriesIndex) => {
                    const value = clamp(entry.values[groupIndex] ?? 0, 0, 50);
                    const barHeight = (value / 50) * plotHeight;
                    const x = groupLeft + seriesIndex * (barWidth + barGap);
                    const y = plotTop + plotHeight - barHeight;
                    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" ry="4" fill="${entry.color}" />`;
                })
                .join("");

            return `${barRects}`;
        })
        .join("");

    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <rect width="${width}" height="${height}" fill="#FAFAFA"/>
            ${grid}
            <line x1="${plotLeft}" y1="${plotTop + plotHeight}" x2="${width - plotRight}" y2="${plotTop + plotHeight}" stroke="#DADADA" stroke-width="1"/>
            ${bars}
        </svg>
    `;
};

const TrendIcon = ({ name }: { name: z.infer<typeof trendCardSchema>["icon"] }) => {
    const className = "h-6 w-6";
    const style = { color: "var(--primary-color,#B71C1C)" };

    switch (name) {
        case "robot":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <rect x="6" y="8" width="12" height="9" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 4.5v2.5M9.5 12h.01M14.5 12h.01M9 15.2h6M4.8 10.5v4M19.2 10.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "coins":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <ellipse cx="12" cy="7" rx="5.5" ry="2.8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M6.5 7v4.4C6.5 13 9 14.2 12 14.2s5.5-1.2 5.5-2.8V7M8 13.4v3.1c0 1.2 1.8 2.2 4 2.2s4-1 4-2.2v-3.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "network":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="6" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="18" cy="7" r="2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="18" cy="17" r="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 11.2 16 7.8M8 12.8 16 16.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "leaf":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M18 5c-5.8.5-9.8 4.2-10.5 9.5 3.6.3 6.2-.7 8.1-2.7C17.7 9.8 18.2 7.5 18 5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M8 18c1.1-2.8 3.4-4.9 6.8-6.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "globe":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M4.5 12h15M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const MarketTrends2026 = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});
    const aiChartDataUri = svgDataUri(createLineChartSvg({ labels: parsed.aiChartLabels, series: parsed.aiChartSeries }));
    const incomeChartDataUri = svgDataUri(createGroupedBarChartSvg({ labels: parsed.incomeChartLabels, series: parsed.incomeChartSeries }));

    return (
        <RedFinanceCanvas>
            <div className="relative z-10 flex h-full flex-col">
                <div className="mx-[60px] flex items-end justify-between pb-[10px] pt-[30px]">
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[36px] w-[6px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1 className="text-[36px] font-black tracking-[-0.02em]" style={{ color: "var(--background-text,#212121)" }}>
                            {parsed.title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-[10px] text-[14px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                        <FinanceIcon name="chart-line" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="mx-[60px] mb-[20px] h-[2px]" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                <div className="flex flex-1 flex-col gap-[20px] px-[60px] pb-[20px]">
                    <div className="grid grid-cols-5 gap-[15px]">
                        {parsed.trends.map((trend, index) => (
                            <div
                                key={`${trend.title}-${index}`}
                                className="relative flex h-full flex-col items-center overflow-hidden rounded-[4px] border px-[12px] pb-[15px] pt-[19px] text-center"
                                style={{
                                    borderColor: "var(--stroke,#EEEEEE)",
                                    backgroundColor: "var(--background-color,#FFFFFF)",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                                }}
                            >
                                <div className="absolute left-0 top-0 h-[4px] w-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                                <div
                                    className="mb-[10px] flex h-[48px] w-[48px] items-center justify-center rounded-full"
                                    style={{ backgroundColor: "#FFEBEE" }}
                                >
                                    <TrendIcon name={trend.icon} />
                                </div>
                                <p className="mb-[6px] text-[14px] font-bold leading-[1.3]" style={{ color: "var(--background-text,#212121)" }}>
                                    {trend.title}
                                </p>
                                <p className="text-[12px] leading-[1.4]" style={{ color: "var(--text-muted,#616161)" }}>
                                    {trend.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-1 gap-[30px]">
                        <div
                            data-pptx-export="screenshot"
                            className="flex flex-1 flex-col rounded-[8px] border p-[20px]"
                            style={{
                                backgroundColor: "#FAFAFA",
                                borderColor: "var(--stroke,#EEEEEE)",
                            }}
                        >
                            <div className="mb-[15px] flex items-center justify-between gap-[16px]">
                                <div className="flex min-w-0 items-center gap-[10px]">
                                    <div className="h-[18px] w-[3px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                                    <h3 className="text-[16px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
                                        {parsed.aiChartTitle}
                                    </h3>
                                </div>
                                <div
                                    className="flex-none rounded-[4px] border px-[8px] py-[2px] text-[12px]"
                                    style={{ borderColor: "var(--stroke,#EEEEEE)", color: "var(--text-muted,#616161)", backgroundColor: "#FFFFFF" }}
                                >
                                    {parsed.aiChartTag}
                                </div>
                            </div>

                            <div className="flex flex-1 flex-col overflow-hidden">
                                <div className="flex flex-1 items-center justify-center overflow-hidden">
                                    <img src={aiChartDataUri} alt="" aria-hidden="true" className="h-full w-full object-contain" />
                                </div>
                                <div className="mt-[8px] flex items-center justify-center gap-[28px] text-[12px]" style={{ color: "var(--text-muted,#616161)" }}>
                                    {parsed.aiChartSeries.map((entry) => (
                                        <div key={entry.label} className="flex items-center gap-[8px]">
                                            <div className="relative h-[10px] w-[28px]">
                                                <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                <div className="absolute left-1/2 top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px] bg-white" style={{ borderColor: entry.color }} />
                                            </div>
                                            <span>{entry.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div
                            data-pptx-export="screenshot"
                            className="flex flex-1 flex-col rounded-[8px] border p-[20px]"
                            style={{
                                backgroundColor: "#FAFAFA",
                                borderColor: "var(--stroke,#EEEEEE)",
                            }}
                        >
                            <div className="mb-[15px] flex items-center justify-between gap-[16px]">
                                <div className="flex min-w-0 items-center gap-[10px]">
                                    <div className="h-[18px] w-[3px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                                    <h3 className="text-[16px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
                                        {parsed.incomeChartTitle}
                                    </h3>
                                </div>
                                <div
                                    className="flex-none rounded-[4px] border px-[8px] py-[2px] text-[12px]"
                                    style={{ borderColor: "var(--stroke,#EEEEEE)", color: "var(--text-muted,#616161)", backgroundColor: "#FFFFFF" }}
                                >
                                    {parsed.incomeChartTag}
                                </div>
                            </div>

                            <div className="flex flex-1 flex-col overflow-hidden">
                                <div className="flex flex-1 items-center justify-center overflow-hidden">
                                    <img src={incomeChartDataUri} alt="" aria-hidden="true" className="h-full w-full object-contain" />
                                </div>
                                <div className="mt-[6px] grid grid-cols-3 text-center text-[11px]" style={{ color: "var(--text-muted,#616161)" }}>
                                    {parsed.incomeChartLabels.map((label) => (
                                        <div key={label}>{label}</div>
                                    ))}
                                </div>
                                <div className="mt-[10px] flex items-center justify-center gap-[32px] text-[12px]" style={{ color: "var(--text-muted,#616161)" }}>
                                    {parsed.incomeChartSeries.map((entry) => (
                                        <div key={entry.label} className="flex items-center gap-[8px]">
                                            <div className="h-[14px] w-[14px] rounded-[2px]" style={{ backgroundColor: entry.color }} />
                                            <span>{entry.label}</span>
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

export default MarketTrends2026;
