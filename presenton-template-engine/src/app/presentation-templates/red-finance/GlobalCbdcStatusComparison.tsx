import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";

const stageSchema = z.enum(["research", "pilot", "launched"]);
const countryMarkerSchema = z.enum(["star", "flag", "euro", "circle", "chakra", "leaf", "check", "wave"]);
const interoperabilitySchema = z.enum(["check", "progress", "none", "link"]);

const countrySchema = z.object({
    name: z.string().min(2).max(12),
    code: z.string().min(2).max(4),
    marker: countryMarkerSchema,
    stage: stageSchema,
    progress: z.number().min(0).max(100),
    status: z.string().min(2).max(18),
});

const comparisonRowSchema = z.object({
    market: z.string().min(4).max(24),
    phase: z.string().min(2).max(16),
    stage: stageSchema,
    design: z.string().min(6).max(40),
    interoperability: z.string().min(4).max(40),
    interoperabilityStatus: interoperabilitySchema,
});

type StageKey = z.infer<typeof stageSchema>;
type CountryMarkerKey = z.infer<typeof countryMarkerSchema>;
type InteroperabilityKey = z.infer<typeof interoperabilitySchema>;

export const Schema = z.object({
    title: z.string().min(6).max(28).default("全球CBDC发展现状对比"),
    metaLabel: z.string().min(6).max(32).default("GLOBAL CBDC STATUS"),
    stageLabels: z
        .object({
            research: z.string().min(4).max(24).default("研究阶段 (Research)"),
            pilot: z.string().min(4).max(24).default("试点阶段 (Pilot)"),
            launched: z.string().min(4).max(24).default("正式推出 (Launched)"),
        })
        .default({
            research: "研究阶段 (Research)",
            pilot: "试点阶段 (Pilot)",
            launched: "正式推出 (Launched)",
        }),
    countries: z.array(countrySchema).min(4).max(8).default([
        {
            name: "中国",
            code: "CN",
            marker: "star",
            stage: "pilot",
            progress: 90,
            status: "大规模试点",
        },
        {
            name: "美国",
            code: "US",
            marker: "flag",
            stage: "research",
            progress: 30,
            status: "批发型研究",
        },
        {
            name: "欧盟",
            code: "EU",
            marker: "euro",
            stage: "pilot",
            progress: 50,
            status: "准备阶段",
        },
        {
            name: "日本",
            code: "JP",
            marker: "circle",
            stage: "pilot",
            progress: 40,
            status: "概念验证",
        },
        {
            name: "印度",
            code: "IN",
            marker: "chakra",
            stage: "pilot",
            progress: 60,
            status: "零售试点",
        },
        {
            name: "巴西",
            code: "BR",
            marker: "leaf",
            stage: "pilot",
            progress: 70,
            status: "Drex试点",
        },
        {
            name: "尼日利亚",
            code: "NG",
            marker: "check",
            stage: "launched",
            progress: 100,
            status: "eNaira推出",
        },
        {
            name: "巴哈马",
            code: "BS",
            marker: "wave",
            stage: "launched",
            progress: 100,
            status: "Sand Dollar",
        },
    ]),
    columns: z
        .object({
            market: z.string().min(2).max(12).default("国家/地区"),
            phase: z.string().min(2).max(12).default("当前阶段"),
            design: z.string().min(2).max(16).default("核心设计特点"),
            interoperability: z.string().min(2).max(16).default("互操作性进展"),
        })
        .default({
            market: "国家/地区",
            phase: "当前阶段",
            design: "核心设计特点",
            interoperability: "互操作性进展",
        }),
    comparisonRows: z.array(comparisonRowSchema).min(3).max(5).default([
        {
            market: "中国 (e-CNY)",
            phase: "大规模试点",
            stage: "pilot",
            design: "双层运营，支持双离线支付",
            interoperability: "mBridge项目核心成员",
            interoperabilityStatus: "check",
        },
        {
            market: "欧盟 (Digital Euro)",
            phase: "准备阶段",
            stage: "pilot",
            design: "强调隐私保护，中介分发模式",
            interoperability: "欧元区内互通规划",
            interoperabilityStatus: "progress",
        },
        {
            market: "美国 (Digital Dollar)",
            phase: "研究阶段",
            stage: "research",
            design: "批发型优先，注重隐私合规",
            interoperability: "暂无具体跨境计划",
            interoperabilityStatus: "none",
        },
        {
            market: "巴哈马 (Sand Dollar)",
            phase: "正式推出",
            stage: "launched",
            design: "零售型，旨在提升普惠金融",
            interoperability: "与万事达卡合作发卡",
            interoperabilityStatus: "link",
        },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(1).max(4).default("17"),
});

export const layoutId = "global-cbdc-status-comparison";
export const layoutName = "Global CBDC Status Comparison";
export const layoutDescription =
    "A global CBDC comparison slide with editable launch-stage legend pills, eight progress cards, and a text-first comparison matrix.";

const comparisonGridTemplate = "196px 168px 304px minmax(0, 1fr)";

const stagePalette: Record<
    StageKey,
    {
        badgeBackground: string;
        badgeText: string;
        dot: string;
        progress: string;
        rowBackground: string;
        rowText: string;
    }
> = {
    research: {
        badgeBackground: "#EEEEEE",
        badgeText: "#616161",
        dot: "#9E9E9E",
        progress: "#9E9E9E",
        rowBackground: "#F5F5F5",
        rowText: "#616161",
    },
    pilot: {
        badgeBackground: "#FFEBEE",
        badgeText: "#B71C1C",
        dot: "#EF5350",
        progress: "#D32F2F",
        rowBackground: "#FFF4F3",
        rowText: "#B71C1C",
    },
    launched: {
        badgeBackground: "#B71C1C",
        badgeText: "#FFFFFF",
        dot: "#FFFFFF",
        progress: "#B71C1C",
        rowBackground: "#FDECEC",
        rowText: "#8E0000",
    },
};

const GlobeIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.8 12h14.4M12 4a12.2 12.2 0 0 1 0 16M12 4a12.2 12.2 0 0 0 0 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const CountryMarker = ({ marker }: { marker: CountryMarkerKey }) => {
    switch (marker) {
        case "star":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="currentColor">
                    <path d="m12 3.8 2.1 4.35 4.8.7-3.45 3.36.82 4.79L12 14.85l-4.27 2.15.82-4.79L5.1 8.85l4.8-.7L12 3.8Z" />
                </svg>
            );
        case "flag":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
                    <path d="M6 20V4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M6.2 5.5c2-1.2 3.95-.8 5.8.05 1.8.8 3.45 1.15 5.8-.05v7.2c-2.05 1.2-3.95.8-5.8-.05-1.85-.85-3.8-1.25-5.8-.05Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
            );
        case "euro":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
                    <path d="M16.6 7.4A5 5 0 0 0 9 10.2m7.6 6.4A5 5 0 0 1 9 13.8M7 10.2h8.2M7 13.8h8.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "circle":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="currentColor">
                    <circle cx="12" cy="12" r="6.5" />
                </svg>
            );
        case "chakra":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
                    <circle cx="12" cy="12" r="5.8" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
                    <path d="M12 6.2v11.6M6.2 12h11.6M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
            );
        case "leaf":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
                    <path d="M18.5 5.5c-6 .1-10.5 3.65-11 10.2 2.55 1.3 6.35.65 8.8-1.8 2.45-2.45 3.1-6.25 2.2-8.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M8.6 15.2c2.15-1.4 4.1-3.35 5.8-5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
            );
        case "check":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
                    <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
                    <path d="m8.7 12.1 2.1 2.1 4.5-4.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "wave":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
                    <path d="M4.5 14c1.25 0 1.9-.8 2.55-1.6.65-.8 1.3-1.6 2.55-1.6s1.9.8 2.55 1.6c.65.8 1.3 1.6 2.55 1.6s1.9-.8 2.55-1.6c.65-.8 1.3-1.6 2.55-1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const InteroperabilityIcon = ({ status }: { status: InteroperabilityKey }) => {
    switch (status) {
        case "check":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="none">
                    <path d="m5 12.4 4.1 4.1L19 7.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "progress":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="none">
                    <path d="M12 4.6a7.4 7.4 0 1 1-7.4 7.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M12 7.2V12l3.1 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            );
        case "none":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="none">
                    <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            );
        case "link":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="none">
                    <path d="M9.6 14.4 7.3 16.7a3 3 0 0 1-4.2-4.2l2.3-2.3a3 3 0 0 1 4.2 0M14.4 9.6l2.3-2.3a3 3 0 0 1 4.2 4.2l-2.3 2.3a3 3 0 0 1-4.2 0M8.8 15.2l6.4-6.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        default:
            return null;
    }
};

const StageBadge = ({ label, stage }: { label: string; stage: StageKey }) => {
    const palette = stagePalette[stage];

    return (
        <div
            className="flex h-[34px] items-center gap-[8px] rounded-full px-[16px]"
            style={{ backgroundColor: palette.badgeBackground, color: palette.badgeText }}
        >
            <div className="h-[10px] w-[10px] rounded-full" style={{ backgroundColor: palette.dot }} />
            <div className="whitespace-nowrap text-[14px] font-bold leading-none">
                {label}
            </div>
        </div>
    );
};

const CountryProgressCard = ({ item }: { item: z.infer<typeof countrySchema> }) => {
    const palette = stagePalette[item.stage];
    const markerColor =
        item.marker === "star"
            ? "#C62828"
            : item.marker === "flag"
              ? "#757575"
              : item.marker === "euro"
                ? "#1E88E5"
                : item.marker === "circle"
                  ? "#EF9A9A"
                  : item.marker === "chakra"
                    ? "#FB8C00"
                    : item.marker === "leaf"
                      ? "#2E7D32"
                      : item.marker === "check"
                        ? "#1B5E20"
                        : "#4FC3F7";

    return (
        <div
            className="relative flex h-[96px] flex-col overflow-hidden rounded-[10px] border px-[14px] pb-[12px] pt-[14px]"
            style={{
                backgroundColor: "#FFFFFF",
                borderColor: "#E1E1E1",
                boxShadow: "0 6px 14px rgba(0,0,0,0.04)",
            }}
        >
            <div className="mb-[10px] flex items-center justify-between">
                <div
                    className="whitespace-nowrap text-[14px] font-bold leading-none"
                    style={{ width: "124px", color: "var(--background-text,#212121)" }}
                >
                    {`${item.name} (${item.code})`}
                </div>
                <div style={{ color: markerColor }}>
                    <CountryMarker marker={item.marker} />
                </div>
            </div>
            <div className="rounded-full" style={{ height: "6px", backgroundColor: "#E0E0E0" }}>
                <div
                    className="h-full rounded-full"
                    style={{
                        width: `${item.progress}%`,
                        backgroundColor: palette.progress,
                    }}
                />
            </div>
            <div
                className="mt-[10px] whitespace-nowrap text-right text-[11px] font-medium leading-none"
                style={{ color: "var(--text-muted,#616161)" }}
            >
                {item.status}
            </div>
        </div>
    );
};

const PhaseTag = ({ label, stage }: { label: string; stage: StageKey }) => {
    const palette = stagePalette[stage];

    return (
        <div
            className="inline-flex h-[24px] items-center gap-[7px] rounded-full px-[12px]"
            style={{ backgroundColor: palette.rowBackground, color: palette.rowText }}
        >
            <div className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: palette.progress }} />
            <div className="whitespace-nowrap text-[11px] font-bold leading-none">
                {label}
            </div>
        </div>
    );
};

const ComparisonMatrix = ({
    columns,
    rows,
}: {
    columns: z.infer<typeof Schema>["columns"];
    rows: Array<z.infer<typeof comparisonRowSchema>>;
}) => (
    <div
        className="rounded-[10px] p-px"
        style={{
            backgroundColor: "#E6E6E6",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        }}
    >
        <div className="overflow-hidden rounded-[9px]" style={{ backgroundColor: "#E6E6E6" }}>
            <div
                className="grid gap-px"
                style={{
                    gridTemplateColumns: comparisonGridTemplate,
                    backgroundColor: "#E6E6E6",
                }}
            >
                {[columns.market, columns.phase, columns.design, columns.interoperability].map((label) => (
                    <div
                        key={label}
                        className="flex min-h-[46px] items-center justify-center px-[16px] py-[12px] text-center"
                        style={{ backgroundColor: "#FAFAFA" }}
                    >
                        <div className="whitespace-nowrap text-[13px] font-bold leading-none" style={{ color: "#212121" }}>
                            {label}
                        </div>
                    </div>
                ))}
            </div>

            {rows.map((row) => {
                const iconColor =
                    row.interoperabilityStatus === "none"
                        ? "#B0B0B0"
                        : row.interoperabilityStatus === "progress"
                          ? "#C62828"
                          : "var(--primary-color,#B71C1C)";

                return (
                    <div
                        key={row.market}
                        className="mt-px grid gap-px"
                        style={{
                            gridTemplateColumns: comparisonGridTemplate,
                            backgroundColor: "#E6E6E6",
                        }}
                    >
                        <div className="flex min-h-[58px] items-center justify-center px-[16px] py-[12px] text-center" style={{ backgroundColor: "#FFFFFF" }}>
                            <div
                                className="text-center text-[13px] font-bold leading-[1.35]"
                                style={{ width: "160px", color: "var(--background-text,#212121)" }}
                            >
                                {row.market}
                            </div>
                        </div>

                        <div className="flex min-h-[58px] items-center justify-center px-[16px] py-[12px]" style={{ backgroundColor: "#FFFFFF" }}>
                            <PhaseTag label={row.phase} stage={row.stage} />
                        </div>

                        <div className="flex min-h-[58px] items-center justify-center px-[16px] py-[12px] text-center" style={{ backgroundColor: "#FFFFFF" }}>
                            <div className="text-center text-[12px] leading-[1.45]" style={{ color: "var(--background-text,#212121)" }}>
                                {row.design}
                            </div>
                        </div>

                        <div className="flex min-h-[58px] items-center justify-center px-[16px] py-[12px] text-center" style={{ backgroundColor: "#FFFFFF" }}>
                            <div className="flex max-w-full items-center justify-center gap-[8px] text-center">
                                <div className="mt-[2px] flex h-[14px] w-[14px] flex-none items-center justify-center" style={{ color: iconColor }}>
                                    <InteroperabilityIcon status={row.interoperabilityStatus} />
                                </div>
                                <div className="text-center text-[12px] leading-[1.45]" style={{ color: "var(--background-text,#212121)" }}>
                                    {row.interoperability}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const GlobalCbdcStatusComparison = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});

    return (
        <RedFinanceCanvas>
            <div className="relative z-10 flex h-full flex-col">
                <div className="mx-[60px] flex items-end justify-between pb-[10px] pt-[30px]">
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[36px] w-[6px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1
                            className="whitespace-nowrap text-[36px] font-black tracking-[-0.02em]"
                            style={{ width: "560px", color: "var(--background-text,#212121)" }}
                        >
                            {parsed.title}
                        </h1>
                    </div>
                    <div
                        className="flex items-center gap-[10px] whitespace-nowrap text-[14px] font-medium"
                        style={{ width: "248px", color: "var(--text-muted,#616161)" }}
                    >
                        <div style={{ color: "var(--primary-color,#B71C1C)" }}>
                            <GlobeIcon />
                        </div>
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="mx-[60px] mb-[14px] flex-none">
                    <div className="h-[2px] w-full rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />
                </div>

                <div className="flex flex-1 flex-col px-[60px] pb-[20px]">
                    <div className="mb-[16px] flex items-center justify-center gap-[96px]">
                        <StageBadge label={parsed.stageLabels.research} stage="research" />
                        <StageBadge label={parsed.stageLabels.pilot} stage="pilot" />
                        <StageBadge label={parsed.stageLabels.launched} stage="launched" />
                    </div>

                    <div className="mb-[16px] grid grid-cols-4 gap-[14px]">
                        {parsed.countries.map((item) => (
                            <CountryProgressCard key={`${item.name}-${item.code}`} item={item} />
                        ))}
                    </div>

                    <div className="flex-1">
                        <ComparisonMatrix columns={parsed.columns} rows={parsed.comparisonRows} />
                    </div>
                </div>

                <div className="mt-auto h-[50px] flex-none" style={{ backgroundColor: "#FFFFFF" }}>
                    <div className="mx-[60px] h-[1px]" style={{ backgroundColor: "#F0F0F0" }} />
                    <div className="flex h-[49px] items-center justify-between px-[60px]">
                        <div
                            className="whitespace-nowrap text-[12px] font-medium tracking-[0.08em]"
                            style={{ width: "400px", color: "#9E9E9E" }}
                        >
                            {parsed.footerText}
                        </div>
                        <div
                            className="whitespace-nowrap text-[14px] font-black leading-none"
                            style={{ width: "28px", color: "var(--primary-color,#B71C1C)" }}
                        >
                            {parsed.pageNumber}
                        </div>
                    </div>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default GlobalCbdcStatusComparison;
