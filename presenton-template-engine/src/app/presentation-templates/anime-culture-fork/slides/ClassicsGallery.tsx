import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const imageSchema = (url: string, prompt: string) =>
  z
    .object({
      __image_url__: z.string().default(url),
      __image_prompt__: z.string().default(prompt),
    })
    .default({
      __image_url__: url,
      __image_prompt__: prompt,
    });

const tagSchema = z.object({
  text: z.string().default("ACTION"),
  tone: z
    .enum(["default", "hot", "fantasy", "dark", "mecha", "muted"])
    .default("default"),
});

const galleryItemSchema = z.object({
  index: z.string().default("01"),
  yearLabel: z.string().default("1986 - PRESENT"),
  title: z.string().default("七龙珠"),
  accent: z.enum(["cyan", "magenta"]).default("cyan"),
  variant: z.enum(["tall", "wide", "standard"]).default("standard"),
  tags: z.array(tagSchema).min(1).max(2).default([
    { text: "ACTION", tone: "hot" },
    { text: "LEGEND", tone: "default" },
  ]),
  image: imageSchema(
    "https://page.talentsecsite.com/slides_images/b5677d706b9cbb4039d55b0e9ceb9f9c.webp",
    "Dragon Ball key visual",
  ),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("CLASSICS"),
  title: z.string().default("经典作品速览"),
  subtitle: z
    .string()
    .default("MASTERPIECES THAT DEFINED GENERATIONS"),
  viewLabel: z.string().default("GALLERY_MODE"),
  items: z.array(galleryItemSchema).length(6).default([
    {
      index: "01",
      yearLabel: "1986 - PRESENT",
      title: "七龙珠",
      accent: "cyan",
      variant: "tall",
      tags: [
        { text: "ACTION", tone: "hot" },
        { text: "LEGEND", tone: "default" },
      ],
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/b5677d706b9cbb4039d55b0e9ceb9f9c.webp",
        __image_prompt__: "Dragon Ball key visual",
      },
    },
    {
      index: "02",
      yearLabel: "2001",
      title: "千与千寻",
      accent: "magenta",
      variant: "wide",
      tags: [
        { text: "FANTASY", tone: "fantasy" },
        { text: "OSCAR WINNER", tone: "default" },
      ],
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/90cf0e26b1aecb45d71922d542c16127.webp",
        __image_prompt__: "Spirited Away key visual",
      },
    },
    {
      index: "03",
      yearLabel: "1995",
      title: "新世纪福音战士",
      accent: "cyan",
      variant: "standard",
      tags: [
        { text: "MECHA", tone: "mecha" },
        { text: "PSYCHO", tone: "default" },
      ],
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/0dfbb87c41561e07629b09e2c9d855c8.webp",
        __image_prompt__: "Neon Genesis Evangelion key visual",
      },
    },
    {
      index: "04",
      yearLabel: "2019",
      title: "鬼灭之刃",
      accent: "magenta",
      variant: "standard",
      tags: [
        { text: "PHENOMENON", tone: "hot" },
        { text: "HISTORICAL", tone: "default" },
      ],
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/c503a16e544aa2d29bf4a2a62d574af0.webp",
        __image_prompt__: "Demon Slayer key visual",
      },
    },
    {
      index: "05",
      yearLabel: "2013",
      title: "进击的巨人",
      accent: "cyan",
      variant: "standard",
      tags: [
        { text: "DARK FANTASY", tone: "dark" },
        { text: "EPIC", tone: "default" },
      ],
      image: {
        __image_url__: "https://www.talentsec.ai/image_placeholder.png",
        __image_prompt__: "Attack on Titan placeholder visual",
      },
    },
    {
      index: "06",
      yearLabel: "1996 - PRESENT",
      title: "名侦探柯南",
      accent: "magenta",
      variant: "standard",
      tags: [
        { text: "MYSTERY", tone: "muted" },
        { text: "LONG-RUNNING", tone: "default" },
      ],
      image: {
        __image_url__: "https://www.talentsec.ai/image_placeholder.png",
        __image_prompt__: "Detective Conan placeholder visual",
      },
    },
  ]),
});

export const layoutId = "classics-gallery";
export const layoutName = "Classics Gallery";
export const layoutDescription =
  "A six-card anime masterpieces gallery with a tall lead image, a wide feature card, and neon editorial accents.";
export const layoutTags = ["content", "anime", "gallery", "classics", "editorial"];
export const layoutRole = "content";
export const contentElements = ["title", "image-gallery", "tags", "card-grid"];
export const useCases = ["classics-overview", "case-gallery", "franchise-highlights"];
export const suitableFor =
  "Suitable for showcasing representative works, franchise highlights, and editorial galleries with short labels.";
export const avoidFor =
  "Avoid using this layout for long descriptions, dense metrics, or tabular comparisons.";
export const density = "medium";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const accentStyles = {
  cyan: {
    line: "#00F6FF",
    glow: "0 0 24px rgba(0,246,255,0.22)",
  },
  magenta: {
    line: "#FF4FD8",
    glow: "0 0 24px rgba(255,79,216,0.24)",
  },
} as const;

const tagStyles = {
  default: {
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#F5F7FB",
    borderColor: "rgba(255,255,255,0.18)",
  },
  hot: {
    backgroundColor: "#FF4E63",
    color: "#FFFFFF",
    borderColor: "#FF4E63",
  },
  fantasy: {
    backgroundColor: "#5A7BFF",
    color: "#FFFFFF",
    borderColor: "#5A7BFF",
  },
  dark: {
    backgroundColor: "#2D3340",
    color: "#E7EDF6",
    borderColor: "#566171",
  },
  mecha: {
    backgroundColor: "#4F56F2",
    color: "#FFFFFF",
    borderColor: "#4F56F2",
  },
  muted: {
    backgroundColor: "#B5BDC8",
    color: "#243041",
    borderColor: "#B5BDC8",
  },
} as const;

const FilmIcon = () => (
  <svg viewBox="0 0 32 32" className="h-[18px] w-[18px]" aria-hidden="true">
    <rect
      x="4.75"
      y="6.75"
      width="22.5"
      height="18.5"
      rx="2.4"
      fill="none"
      stroke="#FF4FD8"
      strokeWidth="2.5"
    />
    <rect x="9.5" y="11.5" width="13" height="9" rx="1.2" fill="none" stroke="#FF4FD8" strokeWidth="2" />
    <rect x="6.7" y="9.2" width="2.2" height="2.2" rx="0.45" fill="#FF4FD8" />
    <rect x="6.7" y="20.6" width="2.2" height="2.2" rx="0.45" fill="#FF4FD8" />
    <rect x="23.1" y="9.2" width="2.2" height="2.2" rx="0.45" fill="#FF4FD8" />
    <rect x="23.1" y="20.6" width="2.2" height="2.2" rx="0.45" fill="#FF4FD8" />
  </svg>
);

const ModeBadge = ({ label }: { label: string }) => (
  <div className="relative h-[28px] w-[212px] overflow-hidden">
    <div
      className="absolute inset-0 z-10 flex items-center gap-[14px] px-[16px]"
      style={{
        color: "#FF4FD8"
      }}
    >
      <div className="flex h-[18px] w-[18px] items-center justify-center">
        <FilmIcon />
      </div>
      <div
        className="text-[16px] leading-none tracking-[0.06em]"
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        {label}
      </div>
    </div>
  </div>
);

const TitleBlock = ({
  title,
  backgroundTitle,
  subtitle,
}: {
  title: string;
  backgroundTitle: string;
  subtitle: string;
}) => (
  <div className="relative z-10">
    <div
      aria-hidden="true"
      className="absolute left-0 top-[-38px] text-[84px] font-bold leading-none tracking-[0.04em]"
      style={{
        color: "#2A2F3E",
        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
      }}
    >
      {backgroundTitle}
    </div>
    <div className="relative pt-[18px]">
      <div
        aria-hidden="true"
        className="absolute left-[4px] top-[22px] text-[42px] font-black tracking-[0.03em]"
        style={{ color: "#FF4FD8" }}
      >
        {title}
      </div>
      <div className="relative text-[42px] font-black tracking-[0.03em] text-white">
        {title}
      </div>
      <div className="mt-[10px] h-[4px] w-[88px] bg-[#00F6FF]" />
      <div
        className="mt-[14px] text-[13px] font-bold tracking-[0.26em] uppercase"
        style={{ color: "#97A4B8" }}
      >
        {subtitle}
      </div>
    </div>
  </div>
);

const ClassicsGallery = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
  const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);

  return (
    <AnimeCanvas background="#0A0A0F">
      <div className="absolute inset-0">
        {gridRows.map((top) => (
          <div
            key={`grid-row-${top}`}
            className="absolute left-0 h-px w-full"
            style={{ top, backgroundColor: "rgba(255,255,255,0.035)" }}
          />
        ))}
        {gridColumns.map((left) => (
          <div
            key={`grid-column-${left}`}
            className="absolute top-0 h-full w-px"
            style={{ left, backgroundColor: "rgba(255,255,255,0.035)" }}
          />
        ))}
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,246,255,0.08) 0%, rgba(10,10,15,0) 26%), radial-gradient(circle at top right, rgba(255,79,216,0.12) 0%, rgba(10,10,15,0) 36%)",
        }}
      />

      <div className="absolute left-[352px] top-0 h-full w-px bg-white/14" />
      <div className="absolute left-0 top-[360px] h-px w-full bg-white/8" />

      <div className="absolute left-[52px] right-[52px] top-[38px] z-10 flex items-end justify-between">
        <TitleBlock
          title={parsed.title}
          backgroundTitle={parsed.backgroundTitle}
          subtitle={parsed.subtitle}
        />

        <ModeBadge label={parsed.viewLabel} />
      </div>

      <div className="absolute left-[52px] right-[52px] top-[170px] bottom-[38px] z-10 grid grid-cols-[280px_1fr_1fr_1fr] grid-rows-[1fr_1fr] gap-[16px]">
        {parsed.items.map((item) => {
          const accent = accentStyles[item.accent];
          const tagList = item.tags.slice(0, 2);
          const cardSpanClass =
            item.variant === "tall"
              ? "row-span-2"
              : item.variant === "wide"
                ? "col-span-2"
                : "";

          return (
            <div
              key={`${item.index}-${item.title}`}
              className={`relative overflow-hidden rounded-[10px] border ${cardSpanClass}`}
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                backgroundColor: "#14141C",
                boxShadow: accent.glow,
              }}
            >
              <img
                src={item.image.__image_url__}
                alt={item.image.__image_prompt__ || item.title}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ filter: "brightness(0.82) contrast(1.08)" }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.22) 48%, rgba(0,0,0,0.86) 100%)",
                }}
              />
              <div
                className="absolute right-[12px] top-[10px] text-[28px] font-bold leading-none"
                style={{
                  color: "rgba(255,255,255,0.84)",
                  fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                }}
              >
                {item.index}
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-[rgba(0,0,0,0.82)] px-[16px] pb-[14px] pt-[14px]">
                <div
                  className="absolute left-0 top-0 h-[3px] w-full"
                  style={{ backgroundColor: accent.line }}
                />
                <div
                  className="text-[13px] font-bold tracking-[0.12em]"
                  style={{
                    color: "#C7D0DD",
                    fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                  }}
                >
                  {item.yearLabel}
                </div>
                <div className="mt-[6px] text-[28px] font-black leading-[1.12] text-white">
                  {item.title}
                </div>
                <div className="mt-[12px] flex flex-wrap gap-[8px]">
                  {tagList.map((tag) => (
                    <div
                      key={`${item.index}-${tag.text}`}
                      className="rounded-[3px] border px-[8px] py-[4px] text-[10px] font-bold tracking-[0.16em]"
                      style={tagStyles[tag.tone]}
                    >
                      {tag.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AnimeCanvas>
  );
};

export default ClassicsGallery;
