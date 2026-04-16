import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const merchItemSchema = z.object({
  number: z.string().default("01"),
  title: z.string().default("手办模型"),
  subtitle: z.string().default("FIGURES & MODELS"),
  accent: z.enum(["cyan", "magenta"]).default("cyan"),
  icon: z
    .enum(["cube", "shirt", "gift", "gamepad", "mug", "handshake", "ticket", "gem"])
    .default("cube"),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("MERCH & ECONOMY"),
  title: z.string().default("动漫周边经济"),
  subtitle: z.string().default("ANIME MERCHANDISE & SPIN-OFF MARKET"),
  moduleLabel: z.string().default("MARKET"),
  moduleValue: z.string().default("SEGMENTS"),
  footerTag: z.string().default("ANIME FILE / 19"),
  footerNote: z.string().default("IP EXTENSION / OFFLINE + ONLINE REVENUE"),
  items: z.array(merchItemSchema).length(8).default([
    {
      number: "01",
      title: "手办模型",
      subtitle: "FIGURES & MODELS",
      accent: "cyan",
      icon: "cube",
    },
    {
      number: "02",
      title: "服装周边",
      subtitle: "APPAREL & FASHION",
      accent: "magenta",
      icon: "shirt",
    },
    {
      number: "03",
      title: "扭蛋商品",
      subtitle: "GACHAPON GOODS",
      accent: "cyan",
      icon: "gift",
    },
    {
      number: "04",
      title: "游戏改编",
      subtitle: "MOBILE & CONSOLE",
      accent: "magenta",
      icon: "gamepad",
    },
    {
      number: "05",
      title: "主题咖啡店",
      subtitle: "THEME CAFES",
      accent: "cyan",
      icon: "mug",
    },
    {
      number: "06",
      title: "品牌联名",
      subtitle: "BRAND COLLABORATIONS",
      accent: "magenta",
      icon: "handshake",
    },
    {
      number: "07",
      title: "展会活动",
      subtitle: "EXPOS & EVENTS",
      accent: "cyan",
      icon: "ticket",
    },
    {
      number: "08",
      title: "限定收藏品",
      subtitle: "LIMITED EDITIONS",
      accent: "magenta",
      icon: "gem",
    },
  ]),
});

export const layoutId = "merch-economy-grid";
export const layoutName = "Merch Economy Grid";
export const layoutDescription =
  "A final anime merchandise slide with eight neon segment cards, editorial framing, and a compact market label panel.";
export const layoutTags = ["anime", "merchandise", "economy", "grid", "closing"];
export const layoutRole = "conclusion";
export const contentElements = ["headline", "segment-grid", "market-panel", "footer-meta"];
export const useCases = ["merchandise-overview", "ip-commercialization", "closing-topic-highlight"];
export const suitableFor =
  "Suitable for a final thematic page that summarizes merchandise segments, spin-off monetization channels, and compact category taxonomies.";
export const avoidFor =
  "Avoid using this layout for dense narrative copy, chart-heavy analysis, or slides that need long editable paragraphs.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);

const accentPalette = {
  cyan: {
    line: "#00F6FF",
    border: "#23384C",
    panel: "#0F1624",
    iconPanel: "#121D2D",
    iconBorder: "#274357",
    title: "#F6FFFF",
    subtitle: "#86A5B8",
    number: "#182233",
  },
  magenta: {
    line: "#FF4FD8",
    border: "#40274B",
    panel: "#16111D",
    iconPanel: "#201628",
    iconBorder: "#563162",
    title: "#FFF4FD",
    subtitle: "#B194C0",
    number: "#281B30",
  },
} as const;

const OffsetTitle = ({ text }: { text: string }) => (
  <div className="relative" style={{ height: "64px" }}>
    <div
      aria-hidden="true"
      className="absolute left-[6px] top-[6px] whitespace-nowrap text-[52px] font-black leading-none tracking-[0.02em]"
      style={{ color: "#00F6FF" }}
    >
      {text}
    </div>
    <div className="relative whitespace-nowrap text-[52px] font-black leading-none tracking-[0.02em] text-white">
      {text}
    </div>
  </div>
);

const MarketBoxIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path
      d="M6 8.5 12 5l6 3.5-6 3.5-6-3.5ZM6 8.5V15l6 3.5 6-3.5V8.5M12 12v6.5"
      fill="none"
      stroke="#00F6FF"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SegmentIcon = ({
  icon,
  color,
}: {
  icon: z.infer<typeof merchItemSchema>["icon"];
  color: string;
}) => {
  switch (icon) {
    case "cube":
      return (
        <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
          <path
            d="m16 4 9 5.2v13.6L16 28l-9-5.2V9.2L16 4Zm0 0v10.7m9-5.5-9 5.5-9-5.5"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "shirt":
      return (
        <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
          <path
            d="m11 6 5 3 5-3 5 5-3 4v11H9V15l-3-4 5-5Z"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "gift":
      return (
        <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
          <rect x="6" y="13" width="20" height="13" rx="2" fill="none" stroke={color} strokeWidth="2" />
          <path
            d="M16 13v13M6 18h20M8 13h16V9.8c0-1.5-1.3-2.8-2.8-2.8-2 0-3.2 1.1-5.2 4-2-2.9-3.2-4-5.2-4C9.3 7 8 8.3 8 9.8V13Z"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "gamepad":
      return (
        <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
          <path
            d="M10.5 12h11c3.1 0 5.5 2.5 5.5 5.6 0 4.2-2.7 8.4-5.3 8.4-1.6 0-2.4-1.2-3.5-2.2-.7-.6-1.3-.8-2.2-.8s-1.5.2-2.2.8c-1.1 1-1.9 2.2-3.5 2.2-2.6 0-5.3-4.2-5.3-8.4 0-3.1 2.4-5.6 5.5-5.6Z"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M11.3 16.8h4.4M13.5 14.6V19" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="21.2" cy="16.2" r="1.2" fill={color} />
          <circle cx="23.8" cy="18.7" r="1.2" fill={color} />
        </svg>
      );
    case "mug":
      return (
        <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
          <path
            d="M8 12h12v10.5A2.5 2.5 0 0 1 17.5 25h-7A2.5 2.5 0 0 1 8 22.5V12Zm12 2h3.5a2.5 2.5 0 0 1 0 5H20"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M11 8c0-1 1-1.8 1-2.8S11 3.6 11 2.8M16 8c0-1 1-1.8 1-2.8S16 3.6 16 2.8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "handshake":
      return (
        <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
          <path
            d="M6 12h5l3 3 3-3h9v4l-5.1 5.1a2.1 2.1 0 0 1-3 0L15 18.4l-2.9 2.8a2.1 2.1 0 0 1-3 0L6 18.2V12Z"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="m10.2 10.8-2.1 2.1M23.8 10.8l-2.1 2.1" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "ticket":
      return (
        <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
          <path
            d="M7 10h18v4a2.6 2.6 0 0 0 0 4v4H7v-4a2.6 2.6 0 0 0 0-4v-4Z"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M16 10v12" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="2.5 2.5" />
        </svg>
      );
    case "gem":
      return (
        <svg viewBox="0 0 32 32" className="h-[28px] w-[28px]" aria-hidden="true">
          <path
            d="M10 8h12l5 6-11 11L5 14l5-6Zm0 0 6 17m6-17-6 17m-6-17 6 6 6-6"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};

const CardCorner = ({
  position,
  color,
}: {
  position: "top-right" | "bottom-left";
  color: string;
}) => {
  const isTopRight = position === "top-right";

  return (
    <div
      className={`absolute ${isTopRight ? "right-[10px] top-[10px]" : "bottom-[10px] left-[10px]"} h-[14px] w-[14px]`}
    >
      <div
        className={`absolute ${isTopRight ? "right-0 top-0" : "bottom-0 left-0"} h-[2px] w-[14px]`}
        style={{ backgroundColor: color }}
      />
      <div
        className={`absolute ${isTopRight ? "right-0 top-0" : "bottom-0 left-0"} h-[14px] w-[2px]`}
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

const SegmentCard = ({
  item,
}: {
  item: z.infer<typeof merchItemSchema>;
} & React.Attributes) => {
  const accent = accentPalette[item.accent];

  return (
    <div
      className="relative flex h-full items-center overflow-hidden rounded-[14px] border"
      style={{
        borderColor: accent.border,
        backgroundColor: accent.panel,
      }}
    >
      <div className="absolute left-0 top-0 h-full w-[4px]" style={{ backgroundColor: accent.line }} />
      <CardCorner position="top-right" color={accent.line} />
      <CardCorner position="bottom-left" color={accent.line} />

      <div className="flex h-full w-full items-center px-[24px]">
        <div
          className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[14px] border"
          style={{
            borderColor: accent.iconBorder,
            backgroundColor: accent.iconPanel,
          }}
        >
          <SegmentIcon icon={item.icon} color={accent.line} />
        </div>

        <div className="ml-[20px] flex min-w-0 flex-1 flex-col justify-center">
          <div
            className="whitespace-nowrap text-[24px] font-bold leading-none"
            style={{ color: accent.title }}
          >
            {item.title}
          </div>
          <div
            className="mt-[10px] whitespace-nowrap text-[11px] font-semibold tracking-[0.22em]"
            style={{ color: accent.subtitle }}
          >
            {item.subtitle}
          </div>
        </div>

        <div
          className="ml-[18px] whitespace-nowrap text-[44px] font-black leading-none"
          style={{ color: accent.number }}
        >
          {item.number}
        </div>
      </div>
    </div>
  );
};

const MerchEconomyGrid = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#090A12">
      <div className="absolute inset-0 bg-[#090A12]" />
      <div className="absolute left-0 top-0 h-full w-[740px] bg-[#070911]" />
      <div className="absolute right-0 top-0 h-full w-[540px] bg-[#0F111A]" />

      {gridRows.map((top) => (
        <div
          key={`grid-row-${top}`}
          className="absolute left-0 h-px w-full"
          style={{ top, backgroundColor: "#171C28" }}
        />
      ))}
      {gridColumns.map((left) => (
        <div
          key={`grid-column-${left}`}
          className="absolute top-0 h-full w-px"
          style={{ left, backgroundColor: "#171C28" }}
        />
      ))}

      <div className="absolute left-[56px] top-[46px] whitespace-nowrap text-[66px] font-black tracking-[0.08em]" style={{ color: "#151A25" }}>
        {parsed.backgroundTitle}
      </div>

      <div className="absolute left-[56px] top-[72px]">
        <OffsetTitle text={parsed.title} />
        <div className="mt-[12px] h-[4px] w-[94px] bg-[#FF4FD8]" />
        <div className="mt-[12px] whitespace-nowrap text-[12px] font-semibold tracking-[0.24em] text-[#9BA4B3]">
          {parsed.subtitle}
        </div>
      </div>

      <div
        className="absolute right-[56px] top-[82px] flex items-center gap-[12px] rounded-[14px] border px-[16px] py-[12px]"
        style={{
          borderColor: "#22374A",
          backgroundColor: "#0E1623",
        }}
      >
        <div className="flex h-[18px] w-[18px] items-center justify-center">
          <MarketBoxIcon />
        </div>
        <div className="flex flex-col">
          <div className="whitespace-nowrap text-[10px] font-semibold tracking-[0.24em] text-[#7E92A7]">
            {parsed.moduleLabel}
          </div>
          <div className="whitespace-nowrap text-[15px] font-bold tracking-[0.08em] text-[#DDFEFF]">
            {parsed.moduleValue}
          </div>
        </div>
      </div>

      <div className="absolute left-[56px] top-[194px] grid h-[452px] w-[1168px] grid-cols-2 grid-rows-4 gap-[16px]">
        {parsed.items.map((item) => (
          <SegmentCard key={`${item.number}-${item.title}-${item.subtitle}`} item={item} />
        ))}
      </div>

      <div className="absolute left-[56px] bottom-[38px] h-px w-[1168px] bg-[#232A38]" />
      <div className="absolute left-[56px] bottom-[18px] whitespace-nowrap text-[12px] font-semibold tracking-[0.22em] text-[#7E8897]">
        {parsed.footerTag}
      </div>
      <div className="absolute right-[56px] bottom-[18px] whitespace-nowrap text-[12px] font-semibold tracking-[0.18em] text-[#7E8897]">
        {parsed.footerNote}
      </div>
    </AnimeCanvas>
  );
};

export default MerchEconomyGrid;
