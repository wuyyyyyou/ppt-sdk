import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const radarSeriesSchema = z.object({
    label: z.string().min(2).max(16),
    color: z.string().min(4).max(20),
    fillColor: z.string().min(4).max(32),
    values: z.array(z.number().min(0).max(100)).min(6).max(6),
});

const metricCardSchema = z.object({
    icon: z.enum(["bank", "market", "mobile", "household"]),
    title: z.string().min(4).max(24),
    cnValue: z.string().min(2).max(10),
    usValue: z.string().min(2).max(10),
    cnShare: z.number().min(0).max(100),
    usShare: z.number().min(0).max(100),
});

const comparisonCardSchema = z.object({
    icon: z.enum(["regulation", "distribution", "profit"]),
    title: z.string().min(6).max(32),
    cnTitle: z.string().min(4).max(24),
    cnDescription: z.string().min(12).max(72),
    usTitle: z.string().min(4).max(24),
    usDescription: z.string().min(12).max(72),
});

export const Schema = z.object({
    title: z.string().min(6).max(28).default("中美金融市场规模与结构对比"),
    metaLabel: z.string().min(6).max(40).default("CN-US MARKET COMPARISON"),
    radarTitle: z.string().min(4).max(20).default("结构成熟度对比"),
    radarLabels: z.array(z.string().min(2).max(12)).min(6).max(6).default([
        "银行资产深度",
        "资本市场深度",
        "数字化普及",
        "非息收入占比",
        "实时支付覆盖",
        "绿色金融政策",
    ]),
    radarSeries: z.array(radarSeriesSchema).min(2).max(2).default([
        {
            label: "中国 (CN)",
            color: "#B71C1C",
            fillColor: "rgba(183, 28, 28, 0.20)",
            values: [95, 60, 90, 50, 95, 85],
        },
        {
            label: "美国 (US)",
            color: "#1565C0",
            fillColor: "rgba(21, 101, 192, 0.18)",
            values: [65, 95, 75, 85, 60, 70],
        },
    ]),
    metrics: z.array(metricCardSchema).min(4).max(4).default([
        {
            icon: "bank",
            title: "银行资产 / GDP",
            cnValue: "310%",
            usValue: "105%",
            cnShare: 75,
            usShare: 25,
        },
        {
            icon: "market",
            title: "股市总市值 / GDP",
            cnValue: "65%",
            usValue: "180%",
            cnShare: 26,
            usShare: 74,
        },
        {
            icon: "mobile",
            title: "移动支付渗透率",
            cnValue: "92%",
            usValue: "48%",
            cnShare: 66,
            usShare: 34,
        },
        {
            icon: "household",
            title: "居民金融资产股票占比",
            cnValue: "18%",
            usValue: "45%",
            cnShare: 28,
            usShare: 72,
        },
    ]),
    comparisonCards: z.array(comparisonCardSchema).min(3).max(3).default([
        {
            icon: "regulation",
            title: "监管风格 (Regulation)",
            cnTitle: "审慎监管 + 发展导向",
            cnDescription: "强调宏观审慎与风险防范，政策窗口指导力度强，兼顾行业发展与稳定。",
            usTitle: "规则导向 + 市场化",
            usDescription: "以信息披露为核心，事后监管与执法力度大，强调市场自我调节机制。",
        },
        {
            icon: "distribution",
            title: "分销渠道 (Distribution)",
            cnTitle: "超级 App + 线下网点",
            cnDescription: "支付宝、微信等超级入口占据 C 端流量，银行网点向智能化、咨询型转型。",
            usTitle: "独立顾问 + 电子邮件",
            usDescription: "独立理财顾问体系成熟，邮件营销仍是主流，App 功能相对垂直。",
        },
        {
            icon: "profit",
            title: "利润结构 (Profit Mix)",
            cnTitle: "息差主导 -> 非息提升",
            cnDescription: "传统利差收入占比仍高，但正快速向财富管理等中收业务转型。",
            usTitle: "多元化非息收入",
            usDescription: "资管、投行、交易佣金等非息收入占比高，收入来源更加均衡。",
        },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("12"),
});

export const layoutId = "china-us-market-comparison";
export const layoutName = "China US Market Comparison";
export const layoutDescription =
    "A China-US market comparison slide with a screenshot-safe radar chart, four editable metric cards, and three structural comparison panels.";

const svgDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const escapeXml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");

const polarPoint = (centerX: number, centerY: number, radius: number, angle: number) => ({
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
});

const labelAnchor = (x: number, centerX: number) => {
    if (x > centerX + 14) {
        return "start";
    }
    if (x < centerX - 14) {
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
    const height = 248;
    const centerX = 180;
    const centerY = 120;
    const radius = 70;
    const ringLevels = Array.from({ length: 10 }, (_, index) => (index + 1) / 10);
    const baseAngle = -Math.PI / 2;
    const angleStep = (Math.PI * 2) / labels.length;

    const axes = labels.map((label, index) => {
        const angle = baseAngle + angleStep * index;
        return {
            angle,
            label,
            axisPoint: polarPoint(centerX, centerY, radius, angle),
            labelPoint: polarPoint(centerX, centerY, radius + 20, angle),
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

            return `<polygon points="${points}" fill="none" stroke="#E6E6E6" stroke-width="1"/>`;
        })
        .join("");

    const axisLines = axes
        .map(
            ({ axisPoint }) =>
                `<line x1="${centerX}" y1="${centerY}" x2="${axisPoint.x}" y2="${axisPoint.y}" stroke="#E3E3E3" stroke-width="1"/>`,
        )
        .join("");

    const axisLabels = axes
        .map(({ label, labelPoint }) => {
            const anchor = labelAnchor(labelPoint.x, centerX);
            const y =
                labelPoint.y > centerY + radius * 0.65
                    ? labelPoint.y
                    : labelPoint.y < centerY - radius * 0.65
                      ? labelPoint.y + 10
                      : labelPoint.y + 4;
            return `<text x="${labelPoint.x}" y="${y}" text-anchor="${anchor}" font-size="10.5" font-weight="700" fill="#616161" font-family="Roboto, Noto Sans SC, sans-serif">${escapeXml(
                label,
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
                    return `<circle cx="${point.x}" cy="${point.y}" r="3.4" fill="#FFFFFF" stroke="${entry.color}" stroke-width="2"/>`;
                })
                .join("");

            return `
                <polygon points="${points}" fill="${entry.fillColor}" stroke="${entry.color}" stroke-width="2.4"/>
                ${nodes}
            `;
        })
        .join("");

    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="#FFFFFF"/>
            ${rings}
            ${axisLines}
            ${polygons}
            ${axisLabels}
            <circle cx="${centerX}" cy="${centerY}" r="2.4" fill="#D8D8D8"/>
        </svg>
    `;
};

const MetricIcon = ({ name }: { name: z.infer<typeof metricCardSchema>["icon"] }) => {
    const className = "h-[17px] w-[17px]";
    const style = { color: "#9E9E9E" };

    switch (name) {
        case "bank":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M4 9.4 12 5l8 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.8 10.3v5.9M10.3 10.3v5.9M13.7 10.3v5.9M17.2 10.3v5.9M4.8 18.2h14.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        case "market":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M4.5 18h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="m6.2 14.8 3.5-3.2 2.6 2.1 5.5-6.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="m16.9 7.7 1.7-.1.1 1.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        case "mobile":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <rect x="7.2" y="4.2" width="9.6" height="15.6" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M10 7.1h4M11 16.8h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        case "household":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="9" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.7" />
                    <circle cx="16.4" cy="8.2" r="1.9" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M5.8 18c.8-2.5 2.6-3.9 4.7-3.9 2 0 3.7 1.4 4.5 3.9M14.1 17.8c.5-1.8 1.7-2.9 3.4-2.9 1.3 0 2.4.8 3 2.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const TopicIcon = ({ name }: { name: z.infer<typeof comparisonCardSchema>["icon"] }) => {
    const className = "h-[18px] w-[18px]";
    const style = { color: "#EF5350" };

    switch (name) {
        case "regulation":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M6.2 7.2h11.6M8.4 7.2V5.6M15.6 7.2V5.6M7.4 10.4 4.8 15h5.1l-2.5-4.6ZM16.6 10.4 14 15h5.2l-2.6-4.6Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 7.2v9.4M8.2 19h7.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        case "distribution":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="6.4" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.7" />
                    <circle cx="17.4" cy="7.2" r="2.2" stroke="currentColor" strokeWidth="1.7" />
                    <circle cx="17.4" cy="16.8" r="2.2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8.5 11.1 15.3 8M8.5 12.9l6.8 3.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        case "profit":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <ellipse cx="12" cy="7" rx="5.4" ry="2.6" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M6.6 7v4.3c0 1.5 2.4 2.6 5.4 2.6 3.1 0 5.4-1.1 5.4-2.6V7M8.3 13.3v3.1c0 1.1 1.7 2 3.7 2s3.7-.9 3.7-2v-3.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const CountryBadge = ({
    label,
    backgroundColor,
}: {
    label: string;
    backgroundColor: string;
}) => (
    <div
        className="mt-[3px] flex h-[16px] w-[24px] flex-none items-center justify-center rounded-[2px] text-[10px] font-bold leading-none text-white"
        style={{ backgroundColor }}
    >
        {label}
    </div>
);

const CompareRow = ({
    code,
    backgroundColor,
    title,
    description,
}: {
    code: string;
    backgroundColor: string;
    title: string;
    description: string;
}) => (
    <div className="flex items-start gap-[10px]">
        <CountryBadge label={code} backgroundColor={backgroundColor} />
        <div className="min-w-0 flex-1">
            <div className="mb-[2px] text-[13px] font-bold leading-[1.25]" style={{ color: "var(--background-text,#212121)" }}>
                {title}
            </div>
            <div className="text-[12px] leading-[1.42]" style={{ color: "var(--text-muted,#616161)" }}>
                {description}
            </div>
        </div>
    </div>
);

const ComparisonMetricCard = ({ metric }: { metric: z.infer<typeof metricCardSchema> }) => {
    const total = Math.max(1, metric.cnShare + metric.usShare);
    const cnWidth = `${(metric.cnShare / total) * 100}%`;
    const usWidth = `${(metric.usShare / total) * 100}%`;

    return (
        <div
            className="flex h-[126px] flex-col rounded-[8px] border px-[16px] py-[14px]"
            style={{
                backgroundColor: "#FAFAFA",
                borderColor: "var(--stroke,#EEEEEE)",
                boxShadow: "0 3px 6px rgba(0,0,0,0.02)",
            }}
        >
            <div className="mb-[10px] flex items-center justify-between gap-[10px]">
                <div className="text-[13px] font-bold leading-none" style={{ color: "var(--text-muted,#616161)" }}>
                    {metric.title}
                </div>
                <MetricIcon name={metric.icon} />
            </div>

            <div className="mb-[8px] flex items-end justify-between gap-[12px]">
                <div className="whitespace-nowrap text-[20px] font-black leading-none" style={{ color: "var(--primary-color,#B71C1C)" }}>
                    {metric.cnValue}
                </div>
                <div className="whitespace-nowrap text-[20px] font-black leading-none" style={{ color: "#1565C0" }}>
                    {metric.usValue}
                </div>
            </div>

            <div className="mb-[7px] flex items-center justify-between text-[11px] font-medium leading-none" style={{ color: "#8A8A8A" }}>
                <div className="flex items-center gap-[6px]">
                    <div className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                    <span>中国</span>
                </div>
                <div className="flex items-center gap-[6px]">
                    <div className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: "#1565C0" }} />
                    <span>美国</span>
                </div>
            </div>

            <div className="relative h-[6px] overflow-hidden rounded-full" style={{ backgroundColor: "#E0E0E0" }}>
                <div className="absolute inset-y-0 left-0" style={{ width: cnWidth, backgroundColor: "var(--primary-color,#B71C1C)" }} />
                <div className="absolute inset-y-0 right-0" style={{ width: usWidth, backgroundColor: "#1565C0" }} />
            </div>
        </div>
    );
};

const ChinaUsMarketComparison = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});
    const radarChartDataUri = svgDataUri(createRadarChartSvg({ labels: parsed.radarLabels, series: parsed.radarSeries }));

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
                    <div className="flex items-center gap-[10px] whitespace-nowrap text-[14px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                        <FinanceIcon name="chart-line" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="mx-[60px] mb-[18px] flex-none">
                    <div className="h-[2px] w-full rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />
                </div>

                <div className="flex flex-1 flex-col gap-[18px] px-[60px] pb-[20px]">
                    <div className="flex h-[286px] gap-[22px]">
                        <div
                            className="flex w-[432px] flex-none flex-col rounded-[10px] border px-[16px] py-[14px]"
                            style={{
                                backgroundColor: "#FFFFFF",
                                borderColor: "var(--stroke,#EEEEEE)",
                                boxShadow: "0 4px 8px rgba(0,0,0,0.02)",
                            }}
                        >
                            <div className="mb-[12px] flex items-center gap-[10px]">
                                <div className="h-[18px] w-[4px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                                <div className="text-[14px] font-bold leading-none" style={{ color: "var(--background-text,#212121)" }}>
                                    {parsed.radarTitle}
                                </div>
                            </div>

                            <div
                                data-pptx-export="screenshot"
                                className="flex flex-1 flex-col overflow-hidden rounded-[10px] border px-[12px] py-[10px]"
                                style={{ backgroundColor: "#FFFFFF", borderColor: "#F3F3F3" }}
                            >
                                <div className="flex flex-1 items-center justify-center overflow-hidden rounded-[6px]" style={{ backgroundColor: "#FFFFFF" }}>
                                    <img src={radarChartDataUri} alt="" aria-hidden="true" className="h-[220px] w-[336px] object-contain" />
                                </div>
                                <div className="mt-[10px] mb-[2px] flex items-center justify-center gap-[22px] text-[12px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                                    {parsed.radarSeries.map((item) => (
                                        <div key={item.label} className="flex items-center gap-[7px]">
                                            <div className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: item.color }} />
                                            <span>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid flex-1 grid-cols-2 gap-[18px]">
                            {parsed.metrics.map((metric) => (
                                <ComparisonMetricCard key={metric.title} metric={metric} />
                            ))}
                        </div>
                    </div>

                    <div className="grid h-[216px] grid-cols-3 gap-[18px]">
                        {parsed.comparisonCards.map((card) => (
                            <div
                                key={card.title}
                                className="flex h-full flex-col overflow-hidden rounded-[10px] border"
                                style={{
                                    backgroundColor: "#FFFFFF",
                                    borderColor: "var(--stroke,#EEEEEE)",
                                    boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
                                }}
                            >
                                <div className="flex h-[42px] flex-none items-center gap-[10px] px-[14px]" style={{ backgroundColor: "#212121" }}>
                                    <TopicIcon name={card.icon} />
                                    <div className="text-[14px] font-bold leading-none text-white">{card.title}</div>
                                </div>

                                <div className="flex flex-1 flex-col px-[15px] py-[14px]">
                                    <CompareRow
                                        code="CN"
                                        backgroundColor="var(--primary-color,#B71C1C)"
                                        title={card.cnTitle}
                                        description={card.cnDescription}
                                    />

                                    <div className="my-[12px] h-[1px] flex-none" style={{ backgroundColor: "#EEEEEE" }} />

                                    <CompareRow code="US" backgroundColor="#1565C0" title={card.usTitle} description={card.usDescription} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div
                    className="relative flex h-[40px] flex-none items-center justify-between px-[60px] text-[12px]"
                    style={{ color: "#9E9E9E", backgroundColor: "var(--background-color,#FFFFFF)" }}
                >
                    <div className="absolute left-[60px] right-[60px] top-0 h-[1px]" style={{ backgroundColor: "#F5F5F5" }} />
                    <p>{parsed.footerText}</p>
                    <p className="font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </p>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default ChinaUsMarketComparison;
