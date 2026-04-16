import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const imageSchema = z
  .object({
    __image_url__: z
      .string()
      .default(
        "https://page.talentsecsite.com/slides_images/aa6eb6e4c262fafb89cc65360e86a6bc.webp",
      ),
    __image_prompt__: z.string().default("Anime pilgrimage destination"),
  })
  .default({
    __image_url__:
      "https://page.talentsecsite.com/slides_images/aa6eb6e4c262fafb89cc65360e86a6bc.webp",
    __image_prompt__: "Anime pilgrimage destination",
  });

const locationSchema = z.object({
  accent: z.enum(["cyan", "yellow"]).default("cyan"),
  badgeText: z.string().default("OTALAND"),
  badgeIcon: z.enum(["gamepad", "leaf"]).default("gamepad"),
  title: z.string().default("AKIHABARA"),
  nativeTitle: z.string().default("秋葉原"),
  coordinates: z.string().default("35.6984° N, 139.7731° E"),
  keywords: z.array(z.string()).default([
    "Electric Town",
    "Maid Cafes",
    "Figures & Hobby",
  ]),
  description: z
    .string()
    .default(
      '二次元文化的"麦加"。汇聚了 Animate、Mandarake 等顶级 ACG 商店、动漫广告墙与女仆咖啡厅体验。',
    ),
  tipLabel: z.string().default("TRAVEL TIP"),
  tipIcon: z.enum(["info", "ticket"]).default("info"),
  tipText: z
    .string()
    .default("周日中央通会变为步行者天国，是拍照与体验街头 Cosplay 文化的最佳时机。"),
  image: imageSchema,
});

export const Schema = z.object({
  backgroundTitle: z.string().default("PILGRIMAGE"),
  title: z.string().default("圣地巡礼"),
  subtitle: z.string().default("REAL LIFE ANIME LOCATIONS"),
  statLabel: z.string().default("LOCATIONS_DETECTED"),
  statValue: z.string().default("2"),
  centerLabel: z.string().default("LOCATION DATA"),
  locations: z.array(locationSchema).length(2).default([
    {
      accent: "cyan",
      badgeText: "OTALAND",
      badgeIcon: "gamepad",
      title: "AKIHABARA",
      nativeTitle: "秋葉原",
      coordinates: "35.6984° N, 139.7731° E",
      keywords: ["Electric Town", "Maid Cafes", "Figures & Hobby"],
      description:
        '二次元文化的"麦加"。汇聚了 Animate、Mandarake 等顶级 ACG 商店、动漫广告墙与女仆咖啡厅体验。',
      tipLabel: "TRAVEL TIP",
      tipIcon: "info",
      tipText:
        "周日中央通会变为步行者天国，是拍照与体验街头 Cosplay 文化的最佳时机。",
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/aa6eb6e4c262fafb89cc65360e86a6bc.webp",
        __image_prompt__: "Akihabara electric town street view",
      },
    },
    {
      accent: "yellow",
      badgeText: "FANTASY",
      badgeIcon: "leaf",
      title: "GHIBLI",
      nativeTitle: "ジブリ",
      coordinates: "35.6961° N, 139.5704° E",
      keywords: ["Mitaka Museum", "Ghibli Park", "Immersion"],
      description:
        "宫崎骏的童话世界现实版。从三鹰之森吉卜力美术馆的迷宫建筑，到爱知吉卜力公园的真实场景复原。",
      tipLabel: "MISSION ALERT",
      tipIcon: "ticket",
      tipText:
        "门票采用实名预约制，通常需提前 1 至 2 个月抢票。馆内禁止摄影，适合沉浸式参观。",
      image: {
        __image_url__: "https://www.talentsec.ai/image_placeholder.png",
        __image_prompt__: "Ghibli museum or Ghibli park scenery",
      },
    },
  ]),
});

export const layoutId = "pilgrimage-destinations";
export const layoutName = "Pilgrimage Destinations";
export const layoutDescription =
  "A split-screen anime pilgrimage slide with two location panels, travel notes, and image-led destination storytelling.";
export const layoutTags = ["anime", "travel", "comparison", "image-led", "destinations"];
export const layoutRole = "content";
export const contentElements = [
  "title",
  "split-panels",
  "destination-image",
  "keyword-pills",
  "travel-tip",
];
export const useCases = ["destination-comparison", "culture-tour", "anime-pilgrimage"];
export const suitableFor =
  "Suitable for comparing two real-world anime destinations with short descriptions, image atmosphere, and travel guidance.";
export const avoidFor =
  "Avoid using this layout for dense statistics, long narrative paragraphs, or slides that need more than two primary destinations.";
export const density = "medium";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const accentPalette = {
  cyan: {
    line: "#00F6FF",
    panel: "#0E1622",
    border: "#223848",
    badgePanel: "#0F1B2B",
    chipPanel: "#0E1620",
    dimText: "#8EA7B2",
    tipPanel: "#101824",
  },
  yellow: {
    line: "#FFD24A",
    panel: "#18130C",
    border: "#43381E",
    badgePanel: "#1F180D",
    chipPanel: "#19140D",
    dimText: "#B7A06C",
    tipPanel: "#1B150D",
  },
} as const;

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);

const CornerFrame = ({
  position,
  color,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  color: string;
}) => {
  const base = "absolute h-[14px] w-[14px]";

  switch (position) {
    case "top-left":
      return (
        <div className={`${base} left-[14px] top-[14px]`}>
          <div className="absolute left-0 top-0 h-[4px] w-[24px]" style={{ backgroundColor: color }} />
          <div className="absolute left-0 top-0 h-[24px] w-[4px]" style={{ backgroundColor: color }} />
        </div>
      );
    case "top-right":
      return (
        <div className={`${base} right-[14px] top-[14px]`}>
          <div className="absolute right-0 top-0 h-[4px] w-[24px]" style={{ backgroundColor: color }} />
          <div className="absolute right-0 top-0 h-[24px] w-[4px]" style={{ backgroundColor: color }} />
        </div>
      );
    case "bottom-left":
      return (
        <div className={`${base} bottom-[14px] left-[14px]`}>
          <div className="absolute bottom-0 left-0 h-[4px] w-[24px]" style={{ backgroundColor: color }} />
          <div className="absolute bottom-0 left-0 h-[24px] w-[4px]" style={{ backgroundColor: color }} />
        </div>
      );
    case "bottom-right":
      return (
        <div className={`${base} bottom-[14px] right-[14px]`}>
          <div className="absolute bottom-0 right-0 h-[4px] w-[24px]" style={{ backgroundColor: color }} />
          <div className="absolute bottom-0 right-0 h-[24px] w-[4px]" style={{ backgroundColor: color }} />
        </div>
      );
  }
};

const MapPinIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <path
      d="M12 20c4.2-4.6 6.4-8 6.4-11.1A6.4 6.4 0 0 0 5.6 8.9C5.6 12 7.8 15.4 12 20Z"
      fill="none"
      stroke="#00F6FF"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="8.9" r="2.1" fill="none" stroke="#00F6FF" strokeWidth="1.8" />
  </svg>
);

const BadgeIcon = ({
  type,
  color,
}: {
  type: "gamepad" | "leaf";
  color: string;
}) => {
  if (type === "gamepad") {
    return (
      <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
        <path
          d="M7.2 8.6h9.6c2.2 0 3.8 1.7 3.8 3.8v1.3c0 1.5-1.2 2.7-2.7 2.7-.8 0-1.5-.3-2-.9l-1.1-1.2H9.2l-1.1 1.2c-.5.6-1.2.9-2 .9-1.5 0-2.7-1.2-2.7-2.7v-1.3c0-2.1 1.6-3.8 3.8-3.8Z"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M9 11.2v3M7.5 12.7h3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="15.5" cy="11.7" r="1" fill={color} />
        <circle cx="17.8" cy="13.9" r="1" fill={color} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
      <path
        d="M18.6 5.4c-4.2.4-8.1 2.4-10.7 5.7-2.1 2.6-3 5.5-3 7.5 2-.1 4.9-1 7.5-3 3.3-2.6 5.3-6.5 5.7-10.7Z"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8.5 15.5c1.9-.4 3.8-1.4 5.4-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
};

const CrosshairIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 48 48" className="h-[40px] w-[40px]" aria-hidden="true">
    <circle cx="24" cy="24" r="18.5" fill="none" stroke={color} strokeWidth="1.8" />
    <path d="M24 8v32M8 24h32" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="24" cy="24" r="4" fill="none" stroke={color} strokeWidth="1.8" />
  </svg>
);

const TipIcon = ({
  type,
  color,
}: {
  type: "info" | "ticket";
  color: string;
}) => {
  if (type === "ticket") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
        <path
          d="M5 8.2A2.2 2.2 0 0 0 7.2 6H18a1 1 0 0 1 1 1v3a1.9 1.9 0 0 0 0 4v3a1 1 0 0 1-1 1H7.2A2.2 2.2 0 0 0 5 15.8V8.2Z"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M12 8v8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2.4 2.4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke={color} strokeWidth="1.8" />
      <path d="M12 10.4v5.1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.4" r="1" fill={color} />
    </svg>
  );
};

type KeywordPillProps = {
  text: string;
  color: string;
  backgroundColor: string;
  key?: React.Key;
};

const KeywordPill = ({
  text,
  color,
  backgroundColor,
}: KeywordPillProps) => (
  <div
    className="inline-flex h-[28px] items-center gap-[8px] rounded-full border px-[12px] whitespace-nowrap"
    style={{
      borderColor: color,
      backgroundColor,
    }}
  >
    <div className="h-[6px] w-[6px] rotate-45" style={{ backgroundColor: color }} />
    <div className="text-[11px] font-semibold tracking-[0.12em]" style={{ color }}>
      {text}
    </div>
  </div>
);

const LocationPanel = ({
  location,
}: {
  location: z.infer<typeof locationSchema>;
}) => {
  const palette = accentPalette[location.accent];
  const imageUrl = location.image.__image_url__;

  return (
    <div
      className="relative h-full overflow-hidden rounded-[24px] border"
      style={{
        backgroundColor: palette.panel,
        borderColor: palette.border,
      }}
    >
      <img
        src={imageUrl}
        alt={location.image.__image_prompt__ || location.title}
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(3,4,10,0.2) 0%, rgba(3,4,10,0.38) 24%, rgba(3,4,10,0.72) 56%, rgba(3,4,10,0.96) 100%)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            location.accent === "cyan"
              ? "linear-gradient(120deg, rgba(0,246,255,0.14) 0%, rgba(0,246,255,0) 48%)"
              : "linear-gradient(120deg, rgba(255,210,74,0.14) 0%, rgba(255,210,74,0) 48%)",
        }}
      />

      <CornerFrame position="top-left" color={palette.line} />
      <CornerFrame position="bottom-right" color={palette.line} />

      <div className="absolute left-[22px] right-[22px] top-[22px] flex items-start justify-between">
        <div
          className="inline-flex h-[34px] items-center gap-[8px] rounded-full border px-[12px] whitespace-nowrap"
          style={{
            borderColor: palette.line,
            backgroundColor: palette.badgePanel,
          }}
        >
          <BadgeIcon type={location.badgeIcon} color={palette.line} />
          <div
            className="text-[11px] font-bold tracking-[0.18em]"
            style={{
              color: palette.line,
              fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
            }}
          >
            {location.badgeText}
          </div>
        </div>

        <div className="flex items-center gap-[10px]">
          <div className="inline-flex h-[28px] items-center px-[4px] whitespace-nowrap">
            <div
              className="text-[11px] font-medium tracking-[0.16em]"
              style={{
                color: palette.dimText,
                fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
              }}
            >
              {location.coordinates}
            </div>
          </div>
          <div
            className="rounded-full border p-[6px]"
            style={{
              borderColor: palette.line,
              backgroundColor: palette.badgePanel,
            }}
          >
            <CrosshairIcon color={palette.line} />
          </div>
        </div>
      </div>

      <div className="absolute bottom-[24px] left-[24px] right-[24px]">
        <div
          className="text-[52px] font-bold leading-none tracking-[0.02em] whitespace-nowrap"
          style={{
            color: "#FFFFFF",
            fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          {location.title}
        </div>
        <div className="mt-[8px] text-[24px] font-bold leading-none whitespace-nowrap" style={{ color: palette.line }}>
          {location.nativeTitle}
        </div>

        <div className="mt-[18px] flex flex-wrap gap-[8px]">
          {location.keywords.map((keyword, index) => (
            <KeywordPill
              key={`${location.title}-${index}-${keyword}`}
              text={keyword}
              color={palette.line}
              backgroundColor={palette.chipPanel}
            />
          ))}
        </div>

        <div
          className="relative mt-[18px] rounded-[14px] border px-[18px] py-[16px]"
          style={{
            borderColor: palette.border,
            backgroundColor: "#0B1018",
          }}
        >
          <div
            className="absolute bottom-[14px] left-[0px] top-[14px] w-[4px] rounded-r-full"
            style={{ backgroundColor: palette.line }}
          />
          <div className="pl-[10px] text-[16px] leading-[1.55]" style={{ color: "#D9E3EE" }}>
            {location.description}
          </div>
        </div>

        <div
          className="mt-[16px] rounded-[14px] border px-[16px] py-[14px]"
          style={{
            borderColor: palette.border,
            backgroundColor: palette.tipPanel,
          }}
        >
          <div className="flex gap-[12px]">
            <div
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border"
              style={{
                borderColor: palette.line,
                backgroundColor: palette.badgePanel,
              }}
            >
              <TipIcon type={location.tipIcon} color={palette.line} />
            </div>
            <div className="min-w-0">
              <div
                className="text-[12px] font-bold tracking-[0.16em] whitespace-nowrap"
                style={{
                  color: palette.line,
                  fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
                }}
              >
                {location.tipLabel}
              </div>
              <div className="mt-[6px] text-[14px] leading-[1.5]" style={{ color: "#C9D5E2" }}>
                {location.tipText}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PilgrimageDestinations = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#090A11">
      <div className="absolute inset-0 overflow-hidden">
        {gridRows.map((top) => (
          <div
            key={`row-${top}`}
            className="absolute left-0 right-0 h-px"
            style={{ top, backgroundColor: "#131824" }}
          />
        ))}
        {gridColumns.map((left) => (
          <div
            key={`column-${left}`}
            className="absolute bottom-0 top-0 w-px"
            style={{ left, backgroundColor: "#131824" }}
          />
        ))}
      </div>

      <div
        className="absolute left-[-120px] top-[-120px] h-[320px] w-[320px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,246,255,0.16) 0%, rgba(0,246,255,0) 72%)",
        }}
      />
      <div
        className="absolute right-[-120px] top-[40px] h-[280px] w-[280px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,79,216,0.14) 0%, rgba(255,79,216,0) 74%)",
        }}
      />

      <div
        className="absolute left-[52px] top-[38px] text-[82px] font-bold leading-none"
        style={{
          color: "#171D29",
          fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
        }}
      >
        {parsed.backgroundTitle}
      </div>

      <div className="absolute left-[52px] top-[52px] z-10">
        <div className="flex items-center gap-[12px]">
          <div className="h-[4px] w-[58px] bg-[#FF4FD8]" />
          <div
            className="text-[14px] font-bold tracking-[0.26em] whitespace-nowrap"
            style={{
              color: "#8EA7B2",
              fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
            }}
          >
            {parsed.subtitle}
          </div>
        </div>
        <div className="mt-[18px] text-[40px] font-black leading-none text-white">
          {parsed.title}
        </div>
      </div>

      <div
        className="absolute right-[52px] top-[50px] z-10 rounded-[16px] border px-[18px] py-[14px]"
        style={{
          borderColor: "#223848",
          backgroundColor: "#0D121B",
        }}
      >
        <div className="flex items-center gap-[14px]">
          <MapPinIcon />
          <div className="text-[40px] font-black leading-none text-white whitespace-nowrap">
            {parsed.statValue}
          </div>
          <div>
            <div
              className="text-[11px] font-bold tracking-[0.18em] whitespace-nowrap"
              style={{
                color: "#8EA7B2",
                fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
              }}
            >
              {parsed.statLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute left-[52px] right-[52px] top-[162px] bottom-[34px] z-10">
        <div className="grid h-full grid-cols-2 gap-[24px]">
          <LocationPanel location={parsed.locations[0]} />
          <LocationPanel location={parsed.locations[1]} />
        </div>
      </div>

    </AnimeCanvas>
  );
};

export default PilgrimageDestinations;
