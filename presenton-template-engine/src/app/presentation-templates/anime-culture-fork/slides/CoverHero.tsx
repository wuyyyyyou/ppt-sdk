import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const imageSchema = z
  .object({
    __image_url__: z
      .string()
      .default(
        "https://page.talentsecsite.com/slides_images/15cbd0a2d8189d44b817d649be322a72.jpg",
      ),
    __image_prompt__: z
      .string()
      .default("Anime city collage with neon atmosphere"),
  })
  .default({
    __image_url__:
      "https://page.talentsecsite.com/slides_images/15cbd0a2d8189d44b817d649be322a72.jpg",
    __image_prompt__: "Anime city collage with neon atmosphere",
  });

export const Schema = z.object({
  englishTitle: z
    .string()
    .default("NIPPON ANIME CULTURE EXPLORATION"),
  titleLineOne: z.string().default("日本动漫"),
  titleLineTwo: z.string().default("文化探索"),
  subtitle: z.string().default("影像 · 类型 · 全球现象"),
  verticalLabel: z.string().default("アニメ文化"),
  presenter: z.string().default("Talentsec AI"),
  reportDate: z.string().default("2026.03.02"),
  themeText: z.string().default("Cyberpunk / Vivid"),
  heroImage: imageSchema,
});

export const layoutId = "cover-hero";
export const layoutName = "Cover Hero";
export const layoutDescription =
  "A neon anime cover slide with a two-line headline, dark hero image, and footer metadata.";
export const layoutTags = ["cover", "anime", "hero", "neon"];
export const layoutRole = "cover";
export const contentElements = ["headline", "hero-image", "meta"];
export const useCases = ["cover", "opening", "topic-introduction"];
export const suitableFor =
  "Suitable for opening culture, media, or entertainment decks that need a bold visual tone.";
export const avoidFor =
  "Avoid using this layout for dense analysis, long-form narrative, or data-heavy comparisons.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const LayeredHeadline = ({
  text,
  fill,
  outline,
  shadowOne,
  shadowTwo,
  size,
  strokeWidth = 0,
}: {
  text: string;
  fill: string;
  outline?: string;
  shadowOne: string;
  shadowTwo?: string;
  size: number;
  strokeWidth?: number;
}) => (
  <div className="relative" style={{ height: `${size + 28}px` }}>
    <div
      aria-hidden="true"
      className="absolute left-[10px] top-[10px] whitespace-nowrap font-black leading-none tracking-[-0.06em]"
      style={{
        fontSize: `${size}px`,
        color: shadowOne,
      }}
    >
      {text}
    </div>
    {shadowTwo ? (
      <div
        aria-hidden="true"
        className="absolute left-[-4px] top-[-4px] whitespace-nowrap font-black leading-none tracking-[-0.06em]"
        style={{
          fontSize: `${size}px`,
          color: shadowTwo,
        }}
      >
        {text}
      </div>
    ) : null}
    <div
      className="relative whitespace-nowrap font-black leading-none tracking-[-0.06em]"
      style={{
        fontSize: `${size}px`,
        color: fill,
        WebkitTextStroke:
          outline && strokeWidth > 0 ? `${strokeWidth}px ${outline}` : undefined,
      }}
    >
      {text}
    </div>
  </div>
);

const MetaBlock = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: string;
}) => (
  <div className="min-w-[150px]">
    <div
      className="text-[11px] font-bold uppercase tracking-[0.22em]"
      style={{ color: "#FF4FD8" }}
    >
      {label}
    </div>
    <div className="mt-[6px] flex items-center gap-[10px]">
      {icon ? (
        <div
          className="text-[22px] leading-none"
          style={{ color: "#00F6FF" }}
        >
          {icon}
        </div>
      ) : null}
      <div
        className="text-[19px] font-semibold whitespace-nowrap leading-none"
        style={{ color: "var(--background-text,#FFFFFF)" }}
      >
        {value}
      </div>
    </div>
  </div>
);

const CoverHero = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas>
      <img
        src={parsed.heroImage.__image_url__}
        alt={parsed.heroImage.__image_prompt__ || "Anime cover background"}
        className="absolute right-0 top-0 h-full w-full object-cover object-center"
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(3,3,10,0.98) 0%, rgba(3,3,10,0.96) 40%, rgba(3,3,10,0.82) 62%, rgba(3,3,10,0.58) 76%, rgba(3,3,10,0.3) 100%)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,246,255,0.08) 0%, rgba(255,0,255,0.06) 34%, rgba(7,7,17,0) 60%)",
        }}
      />

      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0, rgba(255,255,255,0) 3px, rgba(0,0,0,0.24) 3px, rgba(0,0,0,0.24) 4px)",
        }}
      />

      <div className="absolute left-[18px] top-[6px] z-20">
        <div className="h-[6px] w-[64px]" style={{ backgroundColor: "#00F6FF" }} />
        <div className="h-[52px] w-[6px]" style={{ backgroundColor: "#00F6FF" }} />
      </div>
      <div className="absolute bottom-[12px] right-[24px] z-20">
        <div className="absolute bottom-0 right-0 h-[58px] w-[6px]" style={{ backgroundColor: "#FF00FF" }} />
        <div className="absolute bottom-0 right-0 h-[6px] w-[58px]" style={{ backgroundColor: "#FF00FF" }} />
      </div>

      <svg
        aria-hidden="true"
        viewBox="0 0 740 430"
        className="absolute right-0 top-0 h-[430px] w-[740px]"
      >
        <polygon
          points="134,0 740,0 740,430 0,258"
          fill="rgba(0,246,255,0.08)"
          stroke="rgba(0,246,255,0.55)"
          strokeWidth="3"
        />
      </svg>

      <div className="absolute left-[114px] top-[134px] z-10 w-[760px]">
        <div className="flex items-center gap-[18px]">
          <div
            className="text-[14px] font-medium tracking-[0.44em] whitespace-nowrap"
            style={{
              color: "rgba(255,255,255,0.76)",
              fontFamily:
                'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
            }}
          >
            {parsed.englishTitle}
          </div>
          <div
            className="h-[2px] flex-1"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,0,255,0.9) 0%, rgba(255,0,255,0.28) 100%)",
            }}
          />
        </div>

        <div className="mt-[46px]">
          <LayeredHeadline
            text={parsed.titleLineOne}
            fill="#FFFFFF"
            shadowOne="#FF00FF"
            shadowTwo="#00F6FF"
            size={132}
          />
          <div className="mt-[-8px]">
            <LayeredHeadline
              text={parsed.titleLineTwo}
              fill="#179FA8"
              outline="#FFFFFF"
              shadowOne="#13C7D2"
              shadowTwo="rgba(255,255,255,0.18)"
              size={128}
              strokeWidth={2}
            />
          </div>
        </div>

        <div className="mt-[-6px]">
          <div className="relative h-[84px] w-[435px]">
            <div className="absolute left-[22px] top-[-8px] h-[8px] w-[36px] bg-[#00F6FF]" />
            <div className="absolute left-[74px] top-[-8px] h-[8px] w-[36px] bg-[#00F6FF]" />
            <div
              className="absolute left-[12px] top-[12px] h-full w-full"
              style={{ backgroundColor: "#FF00FF" }}
            />
            <div
              className="absolute inset-0 border bg-[#02030A]"
              style={{
                borderColor: "#00F6FF",
              }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-[28px] font-black tracking-[0.08em]"
              style={{ color: "#00F6FF" }}
            >
              {parsed.subtitle}
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute right-[92px] top-[70px] z-10 text-[28px] font-black tracking-[0.24em]"
        style={{
          color: "rgba(200,255,255,0.42)",
          writingMode: "vertical-rl",
          textOrientation: "upright",
          WebkitTextStroke: "1px rgba(196,255,255,0.72)",
          textShadow: "0 0 12px rgba(0,246,255,0.5)",
        }}
      >
        {parsed.verticalLabel}
      </div>

      <div
        className="absolute bottom-[0] left-0 right-0 z-10 h-[112px]"
        style={{
          borderTop: "3px solid #FF00FF",
          background:
            "linear-gradient(180deg, rgba(2,3,10,0) 0%, rgba(2,3,10,0.24) 24%, rgba(2,3,10,0.92) 100%)",
        }}
      >
        <div className="flex h-full items-start gap-[88px] px-[114px] pt-[42px]">
          <MetaBlock label="Presenter" value={parsed.presenter} />
          <MetaBlock label="Date" value={parsed.reportDate} />
          <MetaBlock label="Theme" value={parsed.themeText} icon="⚡" />
        </div>
      </div>

      <div className="absolute bottom-[34px] right-[166px] z-10 flex gap-[6px]">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`dot-${index}`}
            className="h-[4px] w-[12px]"
            style={{
              backgroundColor:
                index % 3 === 1 ? "rgba(255,255,255,0.48)" : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>
    </AnimeCanvas>
  );
};

export default CoverHero;
