import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const genreItemSchema = z.object({
  number: z.string().default("01"),
  title: z.string().default("热血 / 王道"),
  label: z.string().default("REPRESENTATIVE"),
  examples: z
    .array(z.string())
    .default(["One Piece", "Naruto", "Dragon Ball", "Demon Slayer"]),
  accent: z.enum(["cyan", "magenta"]).default("cyan"),
  icon: z
    .enum([
      "flame",
      "robot",
      "cup",
      "cap",
      "detective",
      "heart",
      "portal",
      "basketball",
      "brain",
      "scroll",
      "fantasy",
      "music",
    ])
    .default("flame"),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("GENRES & TYPES"),
  title: z.string().default("流派与类型"),
  subtitle: z.string().default("MAJOR ANIME GENRES BREAKDOWN"),
  viewLabel: z.string().default("GRID_VIEW"),
  items: z.array(genreItemSchema).length(12).default([
    {
      number: "01",
      title: "热血 / 王道",
      label: "REPRESENTATIVE",
      examples: ["One Piece", "Naruto", "Dragon Ball", "Demon Slayer"],
      accent: "cyan",
      icon: "flame",
    },
    {
      number: "02",
      title: "科幻 / 机甲",
      label: "REPRESENTATIVE",
      examples: ["Evangelion", "Gundam", "Ghost in the Shell"],
      accent: "magenta",
      icon: "robot",
    },
    {
      number: "03",
      title: "日常 / 治愈",
      label: "REPRESENTATIVE",
      examples: ["Natsume's Book of Friends", "K-On!", "Yuru Camp"],
      accent: "cyan",
      icon: "cup",
    },
    {
      number: "04",
      title: "校园 / 青春",
      label: "REPRESENTATIVE",
      examples: ["Toradora!", "Hyouka", "My Teen Romantic Comedy"],
      accent: "magenta",
      icon: "cap",
    },
    {
      number: "05",
      title: "悬疑 / 推理",
      label: "REPRESENTATIVE",
      examples: ["Detective Conan", "Death Note", "Monster"],
      accent: "magenta",
      icon: "detective",
    },
    {
      number: "06",
      title: "恋爱",
      label: "REPRESENTATIVE",
      examples: ["Your Name", "Kaguya-sama: Love is War"],
      accent: "cyan",
      icon: "heart",
    },
    {
      number: "07",
      title: "异世界",
      label: "REPRESENTATIVE",
      examples: ["Re:Zero", "Sword Art Online", "Overlord"],
      accent: "magenta",
      icon: "portal",
    },
    {
      number: "08",
      title: "运动",
      label: "REPRESENTATIVE",
      examples: ["Slam Dunk", "Haikyuu!!", "Blue Lock"],
      accent: "cyan",
      icon: "basketball",
    },
    {
      number: "09",
      title: "惊悚 / 心理",
      label: "REPRESENTATIVE",
      examples: ["Psycho-Pass", "Parasyte", "Future Diary"],
      accent: "cyan",
      icon: "brain",
    },
    {
      number: "10",
      title: "历史 / 时代",
      label: "REPRESENTATIVE",
      examples: ["Rurouni Kenshin", "Dororo", "Kingdom"],
      accent: "magenta",
      icon: "scroll",
    },
    {
      number: "11",
      title: "奇幻",
      label: "REPRESENTATIVE",
      examples: ["Frieren", "Fullmetal Alchemist", "Fairy Tail"],
      accent: "cyan",
      icon: "fantasy",
    },
    {
      number: "12",
      title: "音乐 / 偶像",
      label: "REPRESENTATIVE",
      examples: ["Love Live!", "Bocchi the Rock!", "Nana"],
      accent: "magenta",
      icon: "music",
    },
  ]),
});

export const layoutId = "genre-grid";
export const layoutName = "Genre Grid";
export const layoutDescription =
  "A twelve-card anime genre overview with neon accents, representative titles, and a compact editorial grid.";
export const layoutTags = ["content", "anime", "genres", "grid", "cards"];
export const layoutRole = "content";
export const contentElements = ["title", "card-grid", "icons", "genre-list"];
export const useCases = ["genre-overview", "taxonomy", "content-breakdown"];
export const suitableFor =
  "Suitable for category overviews, genre mapping, and compact editorial pages that need many short cards on a single slide.";
export const avoidFor =
  "Avoid using this layout for long descriptions, quantitative charts, or slides that need large photography.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const IconFrame = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <div className="absolute right-[14px] top-[12px] h-[44px] w-[44px] opacity-[0.28]">
    {children}
  </div>
);

const GenreIcon = ({
  name,
  color,
}: {
  name: z.infer<typeof genreItemSchema>["icon"];
  color: string;
}) => {
  const innerColor = "#0A0A0F";

  switch (name) {
    case "flame":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <path
              d="M35 3c3 11 12 13 17 25 5 12-1 28-20 31C15 61 5 47 8 31c2-10 10-15 16-22 1 10 4 14 11 19-2-8-1-16 0-25Z"
              fill={color}
            />
            <path
              d="M31 24c4 8 14 10 14 21 0 9-6 14-14 14-8 0-14-5-14-13 0-8 6-11 10-17 1 5 1 8 4 12 1-4 1-9 0-17Z"
              fill={innerColor}
            />
          </svg>
        </IconFrame>
      );
    case "robot":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <rect x="11" y="18" width="42" height="32" rx="9" fill={color} />
            <rect x="8" y="25" width="8" height="20" rx="4" fill={color} />
            <rect x="48" y="25" width="8" height="20" rx="4" fill={color} />
            <rect x="28" y="3" width="8" height="18" rx="4" fill={color} />
            <circle cx="23" cy="31" r="3.2" fill={innerColor} />
            <circle cx="41" cy="31" r="3.2" fill={innerColor} />
            <rect x="22" y="40" width="20" height="4" rx="2" fill={innerColor} />
            <rect x="18" y="50" width="4" height="8" rx="2" fill={color} />
            <rect x="42" y="50" width="4" height="8" rx="2" fill={color} />
          </svg>
        </IconFrame>
      );
    case "cup":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <rect x="9" y="17" width="34" height="27" rx="5" fill={color} />
            <path
              d="M43 22h8c5 0 9 4 9 9s-4 9-9 9h-8v-6h7c2 0 4-2 4-4s-2-4-4-4h-7v-4Z"
              fill={color}
            />
            <rect x="3" y="49" width="50" height="7" rx="3.5" fill={color} />
          </svg>
        </IconFrame>
      );
    case "cap":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <path d="M4 24 32 13l28 11-28 11L4 24Z" fill={color} />
            <path d="M14 31v11c0 6 11 10 18 10s18-4 18-10V31l-18 7-18-7Z" fill={color} />
            <path
              d="M57 25v15"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="56.5" cy="45.5" r="4.5" fill={color} />
          </svg>
        </IconFrame>
      );
    case "detective":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <path d="M32 10c9 0 16 7 16 16H16c0-9 7-16 16-16Z" fill={color} />
            <path d="M20 23h24l-4 8H24l-4-8Z" fill={innerColor} />
            <path d="M11 53c3-11 10-18 21-18s18 7 21 18H11Z" fill={color} />
            <path d="M24 35h16l-2 18H26l-2-18Z" fill={innerColor} />
            <path
              d="m26 53 6-11 6 11"
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconFrame>
      );
    case "heart":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <path d="M32 56 10 34c-8-8-7-20 1-27 8-7 18-4 24 4 6-8 16-11 24-4 8 7 9 19 1 27L32 56Z" fill={color} />
          </svg>
        </IconFrame>
      );
    case "portal":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <path d="M22 8h20l5 8H17l5-8Z" fill={color} />
            <rect x="26" y="18" width="12" height="30" rx="3" fill={color} />
            <rect x="17" y="20" width="6" height="11" rx="2" fill={color} />
            <rect x="17" y="36" width="6" height="11" rx="2" fill={color} />
            <rect x="41" y="20" width="6" height="11" rx="2" fill={color} />
            <rect x="41" y="36" width="6" height="11" rx="2" fill={color} />
            <path d="M10 28c0-7 4-13 10-17v7c-2 2-3 6-3 10s1 8 3 10v7c-6-4-10-10-10-17Z" fill={color} />
            <path d="M54 28c0-7-4-13-10-17v7c2 2 3 6 3 10s-1 8-3 10v7c6-4 10-10 10-17Z" fill={color} />
          </svg>
        </IconFrame>
      );
    case "basketball":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <circle cx="32" cy="32" r="24" fill={color} />
            <path d="M32 8c0 17 0 31-24 48" fill="none" stroke={innerColor} strokeWidth="4" />
            <path d="M56 32H8" fill="none" stroke={innerColor} strokeWidth="4" />
            <path d="M32 56c0-17 0-31 24-48" fill="none" stroke={innerColor} strokeWidth="4" />
            <path d="M16 15c7 3 12 9 16 17" fill="none" stroke={innerColor} strokeWidth="4" />
            <path d="M48 49c-7-3-12-9-16-17" fill="none" stroke={innerColor} strokeWidth="4" />
          </svg>
        </IconFrame>
      );
    case "brain":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <path d="M24 10c-8 0-14 6-14 14 0 3 1 6 3 8-2 2-3 5-3 8 0 7 6 13 13 13h9V10h-8Z" fill={color} />
            <path d="M40 10c8 0 14 6 14 14 0 3-1 6-3 8 2 2 3 5 3 8 0 7-6 13-13 13h-9V10h8Z" fill={color} />
            <path d="M24 15v34M40 15v34M32 10v44" fill="none" stroke={innerColor} strokeWidth="4" />
          </svg>
        </IconFrame>
      );
    case "scroll":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <path d="M18 10h26a8 8 0 0 1 8 8v28H22a8 8 0 0 0-8 8h-1c-4 0-7-3-7-7s3-7 7-7h5V10Z" fill={color} />
            <path d="M20 46h32v6a8 8 0 0 1-8 8H18c-2 0-4-2-4-4 0-6 4-10 6-10Z" fill={color} />
          </svg>
        </IconFrame>
      );
    case "fantasy":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <path d="M12 49h28c3-6 3-13 0-21 4 2 8 2 12 0-3-3-5-7-6-11 6 1 10 0 14-5-2 8-7 15-15 19 6 2 10 6 12 13H12v5Z" fill={color} />
            <path d="M20 26 34 12l8 8-14 14H20V26Z" fill={color} />
          </svg>
        </IconFrame>
      );
    case "music":
      return (
        <IconFrame>
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <path d="M39 10v28.5A10.5 10.5 0 1 1 33 29V15l23-6v24.5A10.5 10.5 0 1 1 50 24V10l-11 3Z" fill={color} />
          </svg>
        </IconFrame>
      );
  }
};

const CornerBracket = ({
  position,
}: {
  position: "top-right" | "bottom-left";
}) => {
  if (position === "top-right") {
    return (
      <div className="absolute right-[10px] top-[8px]">
        <div className="absolute right-0 top-0 h-[3px] w-[12px] bg-white/38" />
        <div className="absolute right-0 top-0 h-[12px] w-[3px] bg-white/38" />
      </div>
    );
  }

  return (
    <div className="absolute bottom-[10px] left-[10px]">
      <div className="absolute bottom-0 left-0 h-[3px] w-[12px] bg-white/38" />
      <div className="absolute bottom-0 left-0 h-[12px] w-[3px] bg-white/38" />
    </div>
  );
};

const ViewGlyph = () => (
  <div className="relative h-[22px] w-[22px]">
    <div className="absolute left-0 top-0 h-[9px] w-[9px] rounded-[2px] border-[3px] border-white" />
    <div className="absolute right-0 top-0 h-[9px] w-[9px] rounded-[2px] border-[3px] border-white" />
    <div className="absolute bottom-0 left-0 h-[9px] w-[9px] rounded-[2px] border-[3px] border-white" />
    <div className="absolute bottom-0 right-0 h-[9px] w-[9px] rounded-[2px] border-[3px] border-white" />
  </div>
);

const GenreCard = ({ item }: { item: z.infer<typeof genreItemSchema> }) => {
  const accentColor = item.accent === "cyan" ? "#00F6FF" : "#FF00FF";
  const titleShadow =
    item.accent === "cyan"
      ? "0 0 10px rgba(0,246,255,0.35)"
      : "0 0 10px rgba(255,0,255,0.35)";

  return (
    <div
      className="relative h-full overflow-hidden border"
      style={{
        borderColor: "rgba(255,255,255,0.1)",
        backgroundColor: "rgba(255,255,255,0.035)",
      }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[4px]"
        style={{ backgroundColor: accentColor }}
      />
      <CornerBracket position="top-right" />
      <CornerBracket position="bottom-left" />
      <GenreIcon name={item.icon} color={accentColor} />

      <div
        className="absolute bottom-[6px] right-[10px] text-[46px] font-bold leading-none"
        style={{
          color: "#2B2F3D",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {item.number}
      </div>

      <div className="relative z-10 flex h-full flex-col px-[24px] pb-[14px] pt-[22px]">
        <div
          className="max-w-[208px] text-[22px] font-black leading-[1.04] tracking-[0.01em]"
          style={{
            color: "#FFFFFF",
            textShadow: titleShadow,
          }}
        >
          {item.title}
        </div>

        <div className="mt-[12px]">
          <div
            className="text-[9px] font-bold tracking-[0.22em]"
            style={{ color: "#9DA5B2" }}
          >
            {item.label}
          </div>
          <div
            className="mt-[6px] max-w-[224px] text-[11px] font-semibold leading-[1.24]"
            style={{ color: "#D7D7DB" }}
          >
            {item.examples.join(", ")}
          </div>
        </div>
      </div>
    </div>
  );
};

const GenreGrid = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const gridColumns = Array.from({ length: 33 }, (_, index) => index * 60);
  const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);

  return (
    <AnimeCanvas background="#0A0A0F">
      <div className="absolute inset-0 overflow-hidden">
        {gridRows.map((top) => (
          <div
            key={`bg-row-${top}`}
            className="absolute left-0 h-px w-full"
            style={{ top, backgroundColor: "rgba(255,255,255,0.05)" }}
          />
        ))}
        {gridColumns.map((left) => (
          <div
            key={`bg-col-${left}`}
            className="absolute top-0 h-full w-px"
            style={{ left, backgroundColor: "rgba(255,255,255,0.05)" }}
          />
        ))}
      </div>

      <div
        className="absolute left-[40px] top-[10px] whitespace-nowrap text-[82px] font-bold uppercase leading-none tracking-[0.03em]"
        style={{
          color: "#222634",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {parsed.backgroundTitle}
      </div>

      <div className="absolute left-[34px] top-[22px] z-10">
        <div
          className="text-[52px] font-black leading-none tracking-[-0.04em]"
          style={{
            color: "#FFFFFF",
            textShadow: "4px 4px 0 #00F6FF",
          }}
        >
          {parsed.title}
        </div>
        <div
          className="mt-[16px] h-[6px] w-[102px]"
          style={{
            backgroundColor: "#FF00FF",
            boxShadow: "0 0 14px rgba(255,0,255,0.95)",
          }}
        />
        <div
          className="mt-[12px] text-[15px] font-bold tracking-[0.14em]"
          style={{
            color: "#A6ACB7",
            fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          }}
        >
          {parsed.subtitle}
        </div>
      </div>

      <div className="absolute left-[1048px] top-[94px] z-10" style={{ color: "#FFFFFF" }}>
        <ViewGlyph />
      </div>
      <div
        className="absolute left-[1138px] top-[96px] z-10 w-[102px] whitespace-nowrap text-left text-[18px] font-bold leading-none"
        style={{
          color: "#FFFFFF",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {parsed.viewLabel}
      </div>

      <div className="absolute left-[24px] right-[24px] top-[188px] bottom-[24px] z-10 grid grid-cols-4 gap-x-[18px] gap-y-[18px]">
        {parsed.items.map((item) => (
          <React.Fragment key={`${item.number}-${item.title}`}>
            <GenreCard item={item} />
          </React.Fragment>
        ))}
      </div>
    </AnimeCanvas>
  );
};

export default GenreGrid;
