import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const kpiItemSchema = z.object({
  accent: z.enum(["cyan", "magenta", "yellow", "green"]).default("cyan"),
  icon: z.enum(["market", "reach", "audience", "growth"]).default("market"),
  value: z.string().default("$28.6B"),
  label: z.string().default("全球市场规模"),
  subLabel: z.string().default("Global Market Size"),
});

const radarMetricSchema = z.object({
  label: z.string().default("社群活跃"),
  englishLabel: z.string().default("Community"),
  value: z.number().min(0).max(100).default(95),
});

const regionItemSchema = z.object({
  name: z.string().default("North America"),
  icon: z.enum(["flag", "landmark", "torii", "globe"]).default("flag"),
  value: z.number().min(0).max(100).default(35),
  accent: z.enum(["cyan", "magenta", "yellow", "slate"]).default("cyan"),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("GLOBAL IMPACT"),
  title: z.string().default("全球影响力与传播"),
  subtitle: z.string().default("DATA VISUALIZATION & INSIGHTS"),
  systemLabel: z.string().default("SYSTEM_ANALYSIS"),
  radarTitle: z.string().default("影响力维度分析"),
  kpis: z.array(kpiItemSchema).length(4).default([
    {
      accent: "magenta",
      icon: "market",
      value: "$28.6B",
      label: "全球市场规模",
      subLabel: "Global Market Size",
    },
    {
      accent: "cyan",
      icon: "reach",
      value: "180+",
      label: "国家/地区覆盖",
      subLabel: "Countries Reached",
    },
    {
      accent: "yellow",
      icon: "audience",
      value: "50%+",
      label: "Gen Z 受众占比",
      subLabel: "Audience Share",
    },
    {
      accent: "green",
      icon: "growth",
      value: "106%",
      label: "十年增长率",
      subLabel: "10-Year Growth",
    },
  ]),
  radarMetrics: z.array(radarMetricSchema).length(6).default([
    { label: "社群活跃", englishLabel: "Community", value: 95 },
    { label: "内容产出", englishLabel: "Content", value: 85 },
    { label: "商业价值", englishLabel: "Commerce", value: 90 },
    { label: "文化渗透", englishLabel: "Culture", value: 80 },
    { label: "技术创新", englishLabel: "Tech", value: 75 },
    { label: "跨界合作", englishLabel: "Collab", value: 88 },
  ]),
  regions: z.array(regionItemSchema).length(4).default([
    { name: "North America", icon: "flag", value: 35, accent: "cyan" },
    { name: "Europe", icon: "landmark", value: 25, accent: "magenta" },
    { name: "Asia-Pacific", icon: "torii", value: 30, accent: "yellow" },
    { name: "Others", icon: "globe", value: 10, accent: "slate" },
  ]),
});

export const layoutId = "global-impact-dashboard";
export const layoutName = "Global Impact Dashboard";
export const layoutDescription =
  "A neon analytics slide with four global reach KPIs, a radar-style impact graphic, and regional distribution cards.";
export const layoutTags = ["content", "anime", "global", "dashboard", "kpi"];
export const layoutRole = "content";
export const contentElements = ["title", "kpi-stack", "radar-chart", "progress-cards"];
export const useCases = ["global-impact", "market-overview", "cultural-analysis"];
export const suitableFor =
  "Suitable for global reach, influence breakdown, and market-distribution slides that combine headline metrics with one compact chart.";
export const avoidFor =
  "Avoid using this layout for long-form narrative, image-led storytelling, or dense tabular comparison.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const accentPalette = {
  cyan: {
    line: "#00F6FF",
    border: "#22374A",
    panel: "#0E1623",
    iconPanel: "#111A28",
    dimText: "#8EA7B2",
  },
  magenta: {
    line: "#FF4FD8",
    border: "#3A2946",
    panel: "#15111D",
    iconPanel: "#1A1322",
    dimText: "#AA9AB8",
  },
  yellow: {
    line: "#FFD24A",
    border: "#433A20",
    panel: "#1A160E",
    iconPanel: "#1F190D",
    dimText: "#BCA770",
  },
  green: {
    line: "#4ADE80",
    border: "#234231",
    panel: "#101A14",
    iconPanel: "#122118",
    dimText: "#89A694",
  },
  slate: {
    line: "#93A3BD",
    border: "#324055",
    panel: "#111723",
    iconPanel: "#161D28",
    dimText: "#96A2B5",
  },
} as const;

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);
const radarCenterX = 184;
const radarCenterY = 150;
const radarRadius = 108;
const radarLevels = [0.16, 0.32, 0.48, 0.64, 0.8, 1];
const radarAccentOrder = [
  "cyan",
  "magenta",
  "yellow",
  "green",
  "slate",
  "cyan",
] as const;

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

const SystemIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <circle cx="7" cy="7" r="2.2" fill="none" stroke="#00F6FF" strokeWidth="2" />
    <circle cx="17" cy="7" r="2.2" fill="none" stroke="#00F6FF" strokeWidth="2" />
    <circle cx="12" cy="17" r="2.2" fill="none" stroke="#00F6FF" strokeWidth="2" />
    <path
      d="M8.9 8.4 10.9 15M15.1 8.4 13.1 15M9.2 7h5.6"
      fill="none"
      stroke="#00F6FF"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const RadarIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <path d="M12 4.5 18.2 8v8L12 19.5 5.8 16V8L12 4.5Z" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
    <path d="M12 8.5 15.5 10.5v4L12 16.5l-3.5-2v-4L12 8.5Z" fill="none" stroke="#00F6FF" strokeWidth="1.8" />
  </svg>
);

const MarketIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
    <path d="M7 23.5h18" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    <path
      d="m9 20 4-4 3 2.5 6-7.5"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M19.5 11h3.5v3.5" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const ReachIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
    <circle cx="16" cy="16" r="9.5" fill="none" stroke={color} strokeWidth="2.2" />
    <path
      d="M6.5 16h19M16 6.5c2.8 2.8 4.8 5.8 4.8 9.5S18.8 22.7 16 25.5c-2.8-2.8-4.8-5.8-4.8-9.5S13.2 9.3 16 6.5Z"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
  </svg>
);

const AudienceIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
    <circle cx="16" cy="11" r="4" fill={color} />
    <circle cx="8" cy="14" r="3.2" fill={color} opacity="0.72" />
    <circle cx="24" cy="14" r="3.2" fill={color} opacity="0.72" />
    <path d="M7 25c0-3.3 3.3-5.8 9-5.8S25 21.7 25 25" fill={color} />
    <path d="M3.8 24c.2-2.3 2-4.1 5-4.8M23.2 19.2c3 .7 4.8 2.5 5 4.8" fill={color} opacity="0.72" />
  </svg>
);

const GrowthIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
    <path
      d="M10.5 22.5 7.5 13.5l4.8 1.2 4.2-6.2c1.3-1.9 4.3-1.7 5.2.4l.9 2.2 2.9.7-4.5 12a3 3 0 0 1-2.8 1.9h-4.6a3.2 3.2 0 0 1-3.1-2.2Z"
      fill={color}
    />
    <path d="M16.2 9.5 14 15l4.2 1.5" fill="none" stroke="#0A0A0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RegionFlagIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path d="M6 4v16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M8 5.5c2 .7 3.6.7 5.4 0 1.8-.7 3.4-.7 5.6.2v8.1c-2.2-.9-3.8-.9-5.6-.2-1.8.7-3.4.7-5.4 0Z" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const LandmarkIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path d="M4 19.5h16M6 17V11M10 17V11M14 17V11M18 17V11M12 5.5 5 9h14l-7-3.5Z" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ToriiIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path d="M4.5 8.5h15M6 6h12M8 8.5l-1 10M16 8.5l1 10M10 13h4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GlobeIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke={color} strokeWidth="2" />
    <path d="M3.8 12h16.4M12 3.5c2.1 2.3 3.5 5 3.5 8.5S14.1 18.2 12 20.5c-2.1-2.3-3.5-5-3.5-8.5S9.9 5.8 12 3.5Z" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
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
    case "market":
      return <MarketIcon color={color} />;
    case "reach":
      return <ReachIcon color={color} />;
    case "audience":
      return <AudienceIcon color={color} />;
    case "growth":
      return <GrowthIcon color={color} />;
  }
};

const RegionIcon = ({
  icon,
  color,
}: {
  icon: z.infer<typeof regionItemSchema>["icon"];
  color: string;
}) => {
  switch (icon) {
    case "flag":
      return <RegionFlagIcon color={color} />;
    case "landmark":
      return <LandmarkIcon color={color} />;
    case "torii":
      return <ToriiIcon color={color} />;
    case "globe":
      return <GlobeIcon color={color} />;
  }
};

const KpiCard = ({ item }: { item: z.infer<typeof kpiItemSchema> }) => {
  const accent = accentPalette[item.accent];

  return (
    <div
      className="relative flex h-[114px] items-center overflow-hidden rounded-[12px] border pl-[18px] pr-[20px]"
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
        className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[14px]"
        style={{
          backgroundColor: accent.iconPanel,
          boxShadow: `0 0 22px ${accent.line}18`,
        }}
      >
        <MetricIcon icon={item.icon} color={accent.line} />
      </div>

      <div className="ml-[18px] min-w-0 flex-1">
        <div
          className="whitespace-nowrap text-[44px] font-bold leading-none"
          style={{
            color: "#FFFFFF",
            fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          }}
        >
          {item.value}
        </div>
        <div className="mt-[10px] grid gap-[5px]">
          <div className="whitespace-nowrap text-[18px] font-semibold leading-none text-white">
            {item.label}
          </div>
          <div
            className="whitespace-nowrap text-[13px] font-medium leading-none"
            style={{ color: accent.dimText }}
          >
            {item.subLabel}
          </div>
        </div>
      </div>
    </div>
  );
};

const RegionCard = ({ item }: { item: z.infer<typeof regionItemSchema> }) => {
  const accent = accentPalette[item.accent];

  return (
    <div
      className="rounded-[12px] border px-[18px] py-[18px]"
      style={{
        borderColor: accent.border,
        backgroundColor: accent.panel,
      }}
    >
      <div className="flex items-end justify-between gap-[12px]">
        <div className="flex min-w-0 items-center gap-[10px]">
          <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
            <RegionIcon icon={item.icon} color={accent.line} />
          </div>
          <div
            className="whitespace-nowrap text-[16px] font-bold leading-none"
            style={{
              color: "#FFFFFF",
              fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
            }}
          >
            {item.name}
          </div>
        </div>
        <div
          className="whitespace-nowrap text-[30px] font-bold leading-none"
          style={{
            color: accent.line,
            fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          }}
        >
          {item.value}%
        </div>
      </div>

      <div className="mt-[18px] h-[8px] overflow-hidden rounded-full bg-[#2A2F3D]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(item.value, 6)}%`,
            backgroundColor: accent.line,
          }}
        />
      </div>
    </div>
  );
};

const getRadarPoint = (index: number, count: number, distance: number) => {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;

  return {
    x: radarCenterX + Math.cos(angle) * distance,
    y: radarCenterY + Math.sin(angle) * distance,
  };
};

const getPolygonPoints = (count: number, distance: number) =>
  Array.from({ length: count }, (_, index) => getRadarPoint(index, count, distance))
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

const getValuePolygon = (metrics: Array<z.infer<typeof radarMetricSchema>>) =>
  metrics
    .map((item, index) =>
      getRadarPoint(index, metrics.length, (item.value / 100) * radarRadius),
    )
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

const RadarMetricRow = ({
  item,
  index,
}: {
  item: z.infer<typeof radarMetricSchema>;
  index: number;
}) => {
  const accentKey = radarAccentOrder[index % radarAccentOrder.length];
  const accent = accentPalette[accentKey];

  return (
    <div
      className="flex h-full min-h-0 flex-col justify-center rounded-[10px] border px-[10px] py-[8px]"
      style={{
        borderColor: accent.border,
        backgroundColor: accent.panel,
      }}
    >
      <div className="flex items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <div className="flex items-center gap-[8px]">
            <div
              className="mt-[1px] h-[7px] w-[7px] shrink-0 rounded-[2px]"
              style={{ backgroundColor: accent.line }}
            />
            <div className="whitespace-nowrap text-[13px] font-bold leading-none text-white">
              {item.label}
            </div>
          </div>
          <div
            className="mt-[5px] pl-[15px] whitespace-nowrap text-[10px] font-semibold leading-none"
            style={{
              color: accent.dimText,
              fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
            }}
          >
            {item.englishLabel}
          </div>
        </div>
        <div
          className="whitespace-nowrap text-[22px] font-bold leading-none"
          style={{
            color: accent.line,
            fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          }}
        >
          {item.value}
        </div>
      </div>
    </div>
  );
};

const GlobalImpactDashboard = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const valuePolygon = getValuePolygon(parsed.radarMetrics);
  const averageScore = Math.round(
    parsed.radarMetrics.reduce((sum, item) => sum + item.value, 0) /
      parsed.radarMetrics.length,
  );

  return (
    <AnimeCanvas background="#0A0A0F">
      <div className="absolute inset-0 overflow-hidden">
        {gridRows.map((top) => (
          <div
            key={`global-row-${top}`}
            className="absolute left-0 h-px w-full"
            style={{ top, backgroundColor: "rgba(255,255,255,0.035)" }}
          />
        ))}
        {gridColumns.map((left) => (
          <div
            key={`global-col-${left}`}
            className="absolute top-0 h-full w-px"
            style={{ left, backgroundColor: "rgba(255,255,255,0.035)" }}
          />
        ))}
      </div>

      <div className="absolute left-[48px] top-[18px] h-[4px] w-[72px] bg-[#00F6FF]" />
      <div className="absolute left-[48px] top-[18px] h-[54px] w-[4px] bg-[#00F6FF]" />
      <div className="absolute bottom-[12px] right-[18px] h-[4px] w-[70px] bg-[#FF4FD8]" />
      <div className="absolute bottom-[12px] right-[18px] h-[34px] w-[4px] bg-[#FF4FD8]" />

      <div
        aria-hidden="true"
        className="absolute left-[314px] top-[4px] whitespace-nowrap text-[90px] font-bold leading-none"
        style={{
          color: "#141826",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {parsed.backgroundTitle}
      </div>

      <div className="absolute left-[52px] right-[48px] top-[22px] z-10 flex items-start justify-between">
        <div className="w-[860px]">
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
            <SystemIcon />
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

      <div className="absolute left-[52px] right-[48px] top-[136px] bottom-[34px] z-10 grid grid-cols-[438px_1fr] gap-[28px]">
        <div className="grid gap-[16px]">
          {parsed.kpis.map((item) => (
            <KpiCard key={`${item.label}-${item.value}`} item={item} />
          ))}
        </div>

        <div className="grid grid-rows-[332px_1fr] gap-[18px]">
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
                <RadarIcon />
              </div>
              <div
                className="whitespace-nowrap text-[15px] font-bold leading-none"
                style={{
                  color: "#FFFFFF",
                  fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                }}
              >
                {parsed.radarTitle}
              </div>
            </div>

            <div className="mt-[14px] h-px w-full bg-[#2B2F39]" />

            <div className="mt-[12px] grid grid-cols-[1.12fr_0.88fr] gap-[14px]">
              <div
                data-pptx-export="screenshot"
                className="relative h-[246px] overflow-hidden rounded-[12px] border"
                style={{
                  borderColor: "#1E2937",
                  backgroundColor: "#101118",
                }}
              >
                <svg viewBox="0 0 420 300" className="h-full w-full" aria-hidden="true">
                  <rect x="0" y="0" width="420" height="300" fill="#101118" />
                  <rect x="16" y="16" width="388" height="268" rx="18" fill="none" stroke="#1B2230" strokeWidth="2" />
                  <polygon
                    points={getPolygonPoints(parsed.radarMetrics.length, radarRadius + 12)}
                    fill="#0F172455"
                    stroke="none"
                  />

                  {radarLevels.map((level) => (
                    <polygon
                      key={`radar-level-${level}`}
                      points={getPolygonPoints(parsed.radarMetrics.length, radarRadius * level)}
                      fill="none"
                      stroke="#2B3140"
                      strokeWidth="1.4"
                    />
                  ))}

                  {parsed.radarMetrics.map((item, index) => {
                    const axisPoint = getRadarPoint(
                      index,
                      parsed.radarMetrics.length,
                      radarRadius + 8,
                    );

                    return (
                      <line
                        key={`axis-${item.label}`}
                        x1={radarCenterX}
                        y1={radarCenterY}
                        x2={axisPoint.x}
                        y2={axisPoint.y}
                        stroke="#2B3140"
                        strokeWidth="1.4"
                      />
                    );
                  })}

                  <polygon
                    points={valuePolygon}
                    fill="#1FC7D166"
                    stroke="#00F6FF"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />

                  {parsed.radarMetrics.map((item, index) => {
                    const point = getRadarPoint(
                      index,
                      parsed.radarMetrics.length,
                      (item.value / 100) * radarRadius,
                    );
                    const ringPoint = getRadarPoint(
                      index,
                      parsed.radarMetrics.length,
                      radarRadius + 18,
                    );

                    return (
                      <React.Fragment key={`metric-${item.label}-${item.englishLabel}`}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="6.5"
                          fill="#FFFFFF"
                          stroke="#FF4FD8"
                          strokeWidth="3"
                        />
                        <circle
                          cx={ringPoint.x}
                          cy={ringPoint.y}
                          r="2.2"
                          fill="#00F6FF"
                        />
                      </React.Fragment>
                    );
                  })}

                  <circle cx={radarCenterX} cy={radarCenterY} r="10" fill="#141C2A" stroke="#00F6FF" strokeWidth="2" />
                  <circle cx={radarCenterX} cy={radarCenterY} r="3" fill="#00F6FF" />
                </svg>
              </div>

              <div className="grid h-[246px] grid-rows-[72px_1fr] gap-[8px]">
                <div
                  className="rounded-[10px] border px-[14px] py-[10px]"
                  style={{
                    borderColor: "#233040",
                    backgroundColor: "#121A25",
                  }}
                >
                  <div
                    className="whitespace-nowrap text-[11px] font-bold tracking-[0.16em]"
                    style={{
                      color: "#7E8DA6",
                      fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                    }}
                  >
                    IMPACT SCORE / 100
                  </div>
                  <div className="mt-[8px] flex items-center justify-between gap-[12px]">
                    <div className="whitespace-nowrap text-[15px] font-semibold leading-none text-white">
                      六维传播势能
                    </div>
                    <div
                      className="whitespace-nowrap text-[30px] font-bold leading-none"
                      style={{
                        color: "#00F6FF",
                        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                      }}
                    >
                      {averageScore}
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 grid-cols-2 gap-[8px]">
                  {parsed.radarMetrics.map((item, index) => (
                    <RadarMetricRow
                      key={`${item.label}-${item.englishLabel}-${item.value}`}
                      item={item}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[16px]">
            {parsed.regions.map((item) => (
              <RegionCard key={`${item.name}-${item.value}`} item={item} />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[26px] left-[48px] h-px w-[220px] bg-[#1B2433]" />
      <div className="absolute bottom-[26px] right-[48px] h-px w-[120px] bg-[#1B2433]" />
    </AnimeCanvas>
  );
};

export default GlobalImpactDashboard;
