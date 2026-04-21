import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const kpiItemSchema = z.object({
  accent: z.enum(["cyan", "magenta", "yellow"]).default("cyan"),
  icon: z.enum(["yen", "globe", "play"]).default("yen"),
  value: z.string().default("2.93"),
  unit: z.string().default("Trillion"),
  label: z.string().default("Market Size"),
  change: z.string().default("▲ 106%"),
});

const trendPointSchema = z.object({
  year: z.string().default("2014"),
  domestic: z.number().default(1.1),
  overseas: z.number().default(0.3),
});

const revenueItemSchema = z.object({
  label: z.string().default("Merchandise"),
  value: z.number().default(35),
  accent: z.enum(["cyan", "magenta", "yellow", "slate"]).default("cyan"),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("INDUSTRY DATA"),
  title: z.string().default("产业现状与数据"),
  subtitle: z.string().default("MARKET ANALYSIS: GROWTH & TRENDS"),
  systemLabel: z.string().default("SYSTEM_READY"),
  kpis: z.array(kpiItemSchema).length(3).default([
    {
      accent: "cyan",
      icon: "yen",
      value: "2.93",
      unit: "Trillion",
      label: "Market Size",
      change: "▲ 106%",
    },
    {
      accent: "magenta",
      icon: "globe",
      value: "1.46",
      unit: "Trillion",
      label: "Overseas Rev.",
      change: "▲ 49% Share",
    },
    {
      accent: "yellow",
      icon: "play",
      value: "165.2",
      unit: "Billion",
      label: "Streaming",
      change: "▲ 22.3% YoY",
    },
  ]),
  trendTitle: z.string().default("Industry Growth Trend (10 Years)"),
  domesticLabel: z.string().default("Domestic"),
  overseasLabel: z.string().default("Overseas"),
  trend: z.array(trendPointSchema).length(10).default([
    { year: "2014", domestic: 1.1, overseas: 0.3 },
    { year: "2015", domestic: 1.2, overseas: 0.5 },
    { year: "2016", domestic: 1.3, overseas: 0.7 },
    { year: "2017", domestic: 1.35, overseas: 0.9 },
    { year: "2018", domestic: 1.4, overseas: 1.0 },
    { year: "2019", domestic: 1.5, overseas: 1.2 },
    { year: "2020", domestic: 1.3, overseas: 1.1 },
    { year: "2021", domestic: 1.4, overseas: 1.3 },
    { year: "2022", domestic: 1.45, overseas: 1.4 },
    { year: "2023", domestic: 1.47, overseas: 1.46 },
  ]),
  revenueTitle: z.string().default("Revenue Structure"),
  revenueSummary: z.string().default("2023 / Revenue Mix"),
  revenueBreakdown: z.array(revenueItemSchema).length(4).default([
    { label: "Merchandise", value: 35, accent: "cyan" },
    { label: "Streaming", value: 25, accent: "magenta" },
    { label: "Overseas", value: 20, accent: "yellow" },
    { label: "Movie / TV", value: 20, accent: "slate" },
  ]),
});

export const layoutId = "industry-data-dashboard";
export const layoutName = "Industry Data Dashboard";
export const layoutDescription =
  "A neon anime market data slide with three KPI cards, a ten-year stacked bar chart, and a revenue-structure donut module.";
export const layoutTags = ["content", "anime", "industry", "dashboard", "chart"];
export const layoutRole = "content";
export const contentElements = ["title", "kpi-row", "bar-chart", "donut-chart", "legend"];
export const useCases = ["industry-analysis", "market-overview", "data-dashboard"];
export const suitableFor =
  "Suitable for market snapshots, growth trends, and slides that combine a few headline KPIs with one or two compact visualizations.";
export const avoidFor =
  "Avoid using this layout for long narrative copy, dense tables, or pages that require many editable paragraphs.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const accentPalette = {
  cyan: {
    line: "#00F6FF",
    border: "#22374A",
    panel: "#0E1623",
    iconPanel: "#111A28",
    text: "#D9FDFF",
    dimText: "#8EA7B2",
  },
  magenta: {
    line: "#FF4FD8",
    border: "#3A2946",
    panel: "#15111D",
    iconPanel: "#1A1322",
    text: "#FFE0FA",
    dimText: "#A895B6",
  },
  yellow: {
    line: "#FFD24A",
    border: "#433A20",
    panel: "#1A160E",
    iconPanel: "#1F190D",
    text: "#FFF0BF",
    dimText: "#B2A37A",
  },
  slate: {
    line: "#93A3BD",
    border: "#324055",
    panel: "#121723",
    iconPanel: "#161C28",
    text: "#E8EEF7",
    dimText: "#92A0B3",
  },
} as const;

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);
const chartLevels = [0, 0.5, 1, 1.5, 2, 2.5, 3];
const donutCircumference = 2 * Math.PI * 90;

const TechCorner = ({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) => {
  const base = "absolute h-[14px] w-[14px]";

  switch (position) {
    case "top-left":
      return (
        <div className={`${base} left-[10px] top-[10px]`}>
          <div className="absolute left-0 top-0 h-[3px] w-[20px] bg-[#848B9A]" />
          <div className="absolute left-0 top-0 h-[20px] w-[3px] bg-[#848B9A]" />
        </div>
      );
    case "top-right":
      return (
        <div className={`${base} right-[10px] top-[10px]`}>
          <div className="absolute right-0 top-0 h-[3px] w-[20px] bg-[#848B9A]" />
          <div className="absolute right-0 top-0 h-[20px] w-[3px] bg-[#848B9A]" />
        </div>
      );
    case "bottom-left":
      return (
        <div className={`${base} bottom-[10px] left-[10px]`}>
          <div className="absolute bottom-0 left-0 h-[3px] w-[20px] bg-[#848B9A]" />
          <div className="absolute bottom-0 left-0 h-[20px] w-[3px] bg-[#848B9A]" />
        </div>
      );
    case "bottom-right":
      return (
        <div className={`${base} bottom-[10px] right-[10px]`}>
          <div className="absolute bottom-0 right-0 h-[3px] w-[20px] bg-[#848B9A]" />
          <div className="absolute bottom-0 right-0 h-[20px] w-[3px] bg-[#848B9A]" />
        </div>
      );
  }
};

const TerminalIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="#00F6FF" strokeWidth="2" />
    <path d="m8 10 2.8 2.4L8 14.8" fill="none" stroke="#00F6FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.8 15h3.7" stroke="#00F6FF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const BarChartIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <path d="M5 18.5h14" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <rect x="6.2" y="11" width="2.8" height="6" rx="1.1" fill="#FFFFFF" />
    <rect x="10.6" y="8.3" width="2.8" height="8.7" rx="1.1" fill="#FFFFFF" />
    <rect x="15" y="5.5" width="2.8" height="11.5" rx="1.1" fill="#FFFFFF" />
  </svg>
);

const PieChartIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <path d="M12 4.5A7.5 7.5 0 1 1 4.5 12" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 4.5v7.5h7.5A7.5 7.5 0 0 0 12 4.5Z" fill="#FFFFFF" />
  </svg>
);

const YenIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
    <path
      d="M10 7 16 15l6-8M11 15h10M11 19h10M16 15v10"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GlobeIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
    <circle cx="16" cy="16" r="10" fill="none" stroke={color} strokeWidth="2.2" />
    <path d="M6 16h20M16 6c3 3 5 6 5 10s-2 7-5 10c-3-3-5-6-5-10s2-7 5-10Z" fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
  </svg>
);

const PlayIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
    <rect x="7" y="6.5" width="18" height="19" rx="5" fill="none" stroke={color} strokeWidth="2.2" />
    <path d="m14 12 7 4-7 4v-8Z" fill={color} />
  </svg>
);

const MetricIcon = ({
  icon,
  color,
}: {
  icon: z.infer<typeof kpiItemSchema>["icon"];
  color: string;
}) => {
  switch (icon) {
    case "yen":
      return <YenIcon color={color} />;
    case "globe":
      return <GlobeIcon color={color} />;
    case "play":
      return <PlayIcon color={color} />;
  }
};

const KpiCard = ({
  item,
}: {
  item: z.infer<typeof kpiItemSchema>;
} & React.Attributes) => {
  const accent = accentPalette[item.accent];

  return (
    <div
      className="relative flex h-[96px] items-center overflow-hidden rounded-[10px] border px-[18px]"
      style={{
        borderColor: accent.border,
        backgroundColor: accent.panel,
      }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[4px]"
        style={{ backgroundColor: accent.line }}
      />
      <div
        className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: accent.iconPanel,
          boxShadow: `0 0 24px ${accent.line}22`,
        }}
      >
        <MetricIcon icon={item.icon} color={accent.line} />
      </div>

      <div className="ml-[22px] min-w-0 flex-1">
        <div className="relative h-[46px]">
          <div
            className="absolute bottom-0 left-0 whitespace-nowrap text-[42px] font-bold leading-none"
            style={{
              color: "#FFFFFF",
              fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
            }}
          >
            {item.value}
          </div>
          <div className="absolute bottom-[5px] left-[150px] whitespace-nowrap text-[18px] font-semibold leading-none text-[#AFAFAF]">
            {item.unit}
          </div>
        </div>

        <div className="mt-[10px] flex items-center justify-between gap-[10px]">
          <div
            className="whitespace-nowrap text-[16px] font-medium tracking-[0.08em]"
            style={{
              color: "#B7B7BC",
              fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
            }}
          >
            {item.label}
          </div>
          <div
            className="inline-flex h-[32px] items-center justify-center rounded-[4px] px-[12px] whitespace-nowrap text-[16px] font-black leading-none"
            style={{
              backgroundColor: "#12301C",
              color: "#74E59A",
              fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
            }}
          >
            {item.change}
          </div>
        </div>
      </div>
    </div>
  );
};

const RevenueLegendCard = ({
  item,
}: {
  item: z.infer<typeof revenueItemSchema>;
} & React.Attributes) => {
  const accent = accentPalette[item.accent];

  return (
    <div
      className="flex h-[64px] flex-col justify-center rounded-[8px] border px-[12px] py-[6px]"
      style={{
        borderColor: accent.border,
        backgroundColor: accent.panel,
      }}
    >
      <div className="flex items-center gap-[8px]">
        <div
          className="h-[8px] w-[8px] rounded-[2px]"
          style={{ backgroundColor: accent.line }}
        />
        <div className="whitespace-nowrap text-[11px] font-medium text-[#AAB3C2]">
          {item.label}
        </div>
      </div>
      <div
        className="mt-[6px] whitespace-nowrap text-[22px] font-bold leading-none"
        style={{
          color: accent.line,
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {item.value}%
      </div>
    </div>
  );
};

const IndustryDataDashboard = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const trend = parsed.trend.map((item) => ({
    ...item,
    total: item.domestic + item.overseas,
  }));
  const maxTotal = Math.max(3, ...trend.map((item) => item.total));
  let offset = 0;
  const donutSegments = parsed.revenueBreakdown.map((item) => {
    const segmentLength = (item.value / 100) * donutCircumference;
    const segment = {
      ...item,
      segmentLength,
      offset,
    };

    offset += segmentLength;
    return segment;
  });

  return (
    <AnimeCanvas background="#0A0A0F">
      <div className="absolute inset-0 overflow-hidden">
        {gridRows.map((top) => (
          <div
            key={`industry-row-${top}`}
            className="absolute left-0 h-px w-full"
            style={{ top, backgroundColor: "rgba(255,255,255,0.035)" }}
          />
        ))}
        {gridColumns.map((left) => (
          <div
            key={`industry-col-${left}`}
            className="absolute top-0 h-full w-px"
            style={{ left, backgroundColor: "rgba(255,255,255,0.035)" }}
          />
        ))}
      </div>

      <div className="absolute left-[48px] top-[18px] h-[4px] w-[72px] bg-[#00F6FF]" />
      <div className="absolute left-[48px] top-[18px] h-[54px] w-[4px] bg-[#00F6FF]" />
      <div className="absolute bottom-[26px] right-[48px] h-[4px] w-[96px] bg-[#FF4FD8]" />
      <div className="absolute bottom-[26px] right-[48px] h-[54px] w-[4px] bg-[#FF4FD8]" />

      <div
        aria-hidden="true"
        className="absolute left-[356px] top-[4px] whitespace-nowrap text-[88px] font-bold leading-none"
        style={{
          color: "#171B28",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {parsed.backgroundTitle}
      </div>

      <div className="absolute left-[52px] right-[48px] top-[22px] z-10 flex items-start justify-between">
        <div className="w-[760px]">
          <div className="relative pl-[12px] pt-[10px]">
            <div
              aria-hidden="true"
              className="absolute left-[16px] top-[14px] whitespace-nowrap text-[58px] font-black leading-none tracking-[-0.04em]"
              style={{ color: "#00F6FF" }}
            >
              {parsed.title}
            </div>
            <div className="relative whitespace-nowrap text-[58px] font-black leading-none tracking-[-0.04em] text-white">
              {parsed.title}
            </div>
          </div>
          <div
            className="mt-[8px] whitespace-nowrap text-[16px] font-bold tracking-[0.08em]"
            style={{
              color: "#00F6FF",
              fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
            }}
          >
            {parsed.subtitle}
          </div>
        </div>

        <div className="mt-[18px] inline-flex h-[28px] items-center gap-[10px] px-[2px]">
          <div className="flex h-[16px] w-[16px] items-center justify-center">
            <TerminalIcon />
          </div>
          <div
            className="whitespace-nowrap text-[18px] font-medium tracking-[0.04em]"
            style={{
              color: "#D7D7D9",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
          >
            {parsed.systemLabel}
          </div>
        </div>
      </div>

      <div className="absolute left-[52px] right-[48px] top-[140px] z-10 grid grid-cols-3 gap-[20px]">
        {parsed.kpis.map((item) => (
          <KpiCard key={`${item.label}-${item.value}`} item={item} />
        ))}
      </div>

      <div className="absolute left-[52px] right-[42px] top-[282px] bottom-[20px] z-10 grid grid-cols-[1.53fr_1fr] gap-[26px]">
        <div
          className="relative overflow-hidden rounded-[14px] border px-[20px] pb-[18px] pt-[18px]"
          style={{
            borderColor: "#2E3442",
            backgroundColor: "rgba(17,18,24,0.94)",
          }}
        >
          <TechCorner position="top-left" />
          <TechCorner position="top-right" />
          <TechCorner position="bottom-left" />
          <TechCorner position="bottom-right" />

          <div className="flex items-start justify-between gap-[16px] px-[4px]">
            <div className="flex shrink-0 items-center gap-[10px]">
              <div className="flex h-[16px] w-[16px] items-center justify-center">
                <BarChartIcon />
              </div>
              <div
                className="shrink-0 whitespace-nowrap text-[15px] font-bold leading-none"
                style={{
                  color: "#FFFFFF",
                  fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                }}
              >
                {parsed.trendTitle}
              </div>
            </div>

            <div className="mt-[4px] flex shrink-0 items-center gap-[24px]">
              <div className="flex items-center gap-[8px]">
                <div className="h-[12px] w-[12px] rounded-[3px] bg-[#18DCE2]" />
                <div className="whitespace-nowrap text-[12px] font-medium text-[#B7BBC6]">
                  {parsed.domesticLabel}
                </div>
              </div>
              <div className="flex items-center gap-[8px]">
                <div className="h-[12px] w-[12px] rounded-[3px] bg-[#F000E8]" />
                <div className="whitespace-nowrap text-[12px] font-medium text-[#B7BBC6]">
                  {parsed.overseasLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-[14px] h-px w-full bg-[#2B2F39]" />

          <div
            data-pptx-export="screenshot"
            className="relative mt-[12px] h-[320px] overflow-hidden rounded-[12px] border"
            style={{
              borderColor: "#1E2937",
              backgroundColor: "#101118",
            }}
          >
            <div className="absolute inset-[18px]">
              {chartLevels.map((level) => {
                const top = ((3 - level) / 3) * 286;
                return (
                  <React.Fragment key={`level-${level}`}>
                    <div
                      className="absolute left-[56px] right-[12px] h-px"
                      style={{ top, backgroundColor: "#2B2F39" }}
                    />
                    <div
                      className="absolute left-0 w-[40px] text-right text-[12px] font-medium leading-none"
                      style={{
                        top: top - 6,
                        color: "#9296A1",
                        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                      }}
                    >
                      {level}T
                    </div>
                  </React.Fragment>
                );
              })}

              <div className="absolute bottom-[30px] left-[58px] right-[14px] top-[14px] flex items-end justify-between gap-[4px]">
                {trend.map((point) => {
                  const domesticHeight = (point.domestic / maxTotal) * 100;
                  const overseasHeight = (point.overseas / maxTotal) * 100;

                  return (
                    <div
                      key={point.year}
                      className="relative flex h-full w-[48px] shrink-0 flex-col justify-end"
                    >
                      <div className="flex h-full items-end justify-center">
                        <div className="relative h-full w-[30px]">
                          <div
                            className="absolute bottom-0 left-0 w-full"
                            style={{
                              height: `${domesticHeight}%`,
                              backgroundColor: "#18DCE2",
                            }}
                          />
                          <div
                            className="absolute left-0 w-full"
                            style={{
                              bottom: `${domesticHeight}%`,
                              height: `${overseasHeight}%`,
                              backgroundColor: "#F000E8",
                            }}
                          />
                        </div>
                      </div>
                      <div
                        className="mt-[10px] text-center text-[12px] font-medium leading-none"
                        style={{
                          color: "#C8CCD3",
                          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                        }}
                      >
                        {point.year}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-[14px] border px-[20px] pb-[18px] pt-[18px]"
          style={{
            borderColor: "#2E3442",
            backgroundColor: "rgba(17,18,24,0.94)",
          }}
        >
          <TechCorner position="top-left" />
          <TechCorner position="top-right" />
          <TechCorner position="bottom-left" />
          <TechCorner position="bottom-right" />

          <div className="flex items-center gap-[10px] px-[4px]">
            <div className="flex h-[16px] w-[16px] items-center justify-center">
              <PieChartIcon />
            </div>
              <div
                className="whitespace-nowrap text-[15px] font-bold leading-none"
                style={{
                  color: "#FFFFFF",
                  fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                }}
            >
              {parsed.revenueTitle}
            </div>
          </div>

          <div className="mt-[14px] h-px w-full bg-[#2B2F39]" />

          <div className="mt-[8px] flex h-[194px] items-center justify-center">
            <div data-pptx-export="screenshot" className="relative h-[208px] w-[208px]">
              <svg
                viewBox="0 0 280 280"
                className="h-full w-full"
                aria-hidden="true"
              >
                <circle cx="140" cy="140" r="90" fill="none" stroke="#7E8DA6" strokeWidth="34" />
                <g transform="rotate(-90 140 140)">
                  {donutSegments.map((item) => (
                    <circle
                      key={`${item.label}-${item.value}`}
                      cx="140"
                      cy="140"
                      r="90"
                      fill="none"
                      stroke={accentPalette[item.accent].line}
                      strokeWidth="34"
                      strokeLinecap="butt"
                      strokeDasharray={`${item.segmentLength} ${donutCircumference - item.segmentLength}`}
                      strokeDashoffset={-item.offset}
                    />
                  ))}
                </g>
              </svg>
            </div>
          </div>

          <div className="mt-[14px] px-[4px] pb-[6px] grid grid-cols-2 gap-[8px]">
            {parsed.revenueBreakdown.map((item) => (
              <RevenueLegendCard key={`${item.label}-${item.value}`} item={item} />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[26px] left-[48px] h-px w-[220px] bg-[#1B2433]" />
      <div className="absolute bottom-[26px] right-[48px] h-px w-[120px] bg-[#1B2433]" />
    </AnimeCanvas>
  );
};

export default IndustryDataDashboard;
