import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const imageSchema = z.object({
  __image_url__: z.string().default(""),
  __image_prompt__: z.string().default(""),
});

const timelineItemSchema = z.object({
  year: z.string().default("1917"),
  title: z.string().default("萌芽期"),
  description: z
    .string()
    .default("实验短片探索动画形式，引入西方制作技术。"),
  keyword: z.string().default("Early Experiments"),
  image: imageSchema.default({
    __image_url__:
      "https://page.talentsecsite.com/slides_images/9194738cd33dcf5b7176854200c5bbc2.webp",
    __image_prompt__: "Early anime experiments",
  }),
});

export const Schema = z.object({
  title: z.string().default("日本动漫发展历史"),
  subtitle: z
    .string()
    .default("Evolution of Anime Industry (1917-202X)"),
  modeTag: z.string().default("TIMELINE_MINIMAL"),
  sourceText: z
    .string()
    .default("DATA SOURCE: JAPAN ANIMATION ASSOCIATION"),
  pageNumber: z.string().default("PAGE 03"),
  items: z.array(timelineItemSchema).length(5).default([
    {
      year: "1917",
      title: "萌芽期",
      description: "实验短片探索动画形式，引入西方制作技术。",
      keyword: "Early Experiments",
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/9194738cd33dcf5b7176854200c5bbc2.webp",
        __image_prompt__: "Early anime experiments",
      },
    },
    {
      year: "1946",
      title: "探索期",
      description: "东映动画成立，TV动画《铁臂阿童木》开创先河。",
      keyword: "Toei & Astro Boy",
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/7b06b2a48d097e9a10d88d030b4bada5.webp",
        __image_prompt__: "Astro Boy and postwar anime era",
      },
    },
    {
      year: "1974",
      title: "成熟期",
      description: "机甲热潮爆发，OVA市场兴起，吉卜力工作室成立。",
      keyword: "Mecha & Ghibli",
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/90cf0e26b1aecb45d71922d542c16127.webp",
        __image_prompt__: "Mecha boom and Ghibli era",
      },
    },
    {
      year: "1990",
      title: "细化期",
      description: "题材类型扩张，深夜档动画普及，制作数字化转型。",
      keyword: "Diversification",
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/0dfbb87c41561e07629b09e2c9d855c8.webp",
        __image_prompt__: "Diversified anime genres in the 1990s",
      },
    },
    {
      year: "2010",
      title: "全球化期",
      description: "流媒体平台推动全球传播，圈层壁垒被打破。",
      keyword: "Global Phenomenon",
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/705d96df04ca4aa6fee954af7996aabc.webp",
        __image_prompt__: "Global streaming era of anime",
      },
    },
  ]),
});

export const layoutId = "history-timeline";
export const layoutName = "History Timeline";
export const layoutDescription =
  "A five-card anime history timeline with period images, concise descriptions, and footer metadata.";
export const layoutTags = ["timeline", "history", "anime", "cards"];
export const layoutRole = "timeline";
export const contentElements = ["timeline", "cards", "images"];
export const useCases = ["timeline", "history-overview", "period-summary"];
export const suitableFor =
  "Suitable for historical evolution, milestone narratives, and phased development overviews.";
export const avoidFor =
  "Avoid using this layout for detailed statistics, long prose, or comparison matrices.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const HistoryTimeline = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#090B12">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,246,255,0.06) 0%, rgba(9,11,18,0) 24%)",
        }}
      />

      <div className="absolute left-[56px] right-[56px] top-[54px] z-10 flex items-end justify-between">
        <div>
          <div className="text-[42px] font-black tracking-[0.04em]">
            {parsed.title}
          </div>
          <div className="mt-[14px] h-[4px] w-[84px] bg-[#00F6FF]" />
          <div
            className="mt-[12px] text-[14px] font-bold tracking-[0.2em] uppercase"
            style={{ color: "rgba(255,255,255,0.58)" }}
          >
            {parsed.subtitle}
          </div>
        </div>

        <div
          className="rounded-full border px-[18px] py-[10px] text-[13px] font-bold tracking-[0.16em]"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "#9AA7C2",
            fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          }}
        >
          {parsed.modeTag}
        </div>
      </div>

      <div className="absolute left-[56px] right-[56px] top-[178px] bottom-[92px] z-10 grid grid-cols-5 gap-[16px]">
        {parsed.items.map((item) => (
          <div
            key={`${item.year}-${item.title}`}
            className="relative flex h-full flex-col rounded-[18px] border px-[18px] pb-[18px] pt-[18px]"
            style={{
              borderColor: "rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          >
            <div className="absolute left-[18px] top-[18px] h-[120px] w-[4px] bg-[#FF4FD8]" />

            <div
              className="pl-[14px] text-[34px] font-bold leading-none"
              style={{
                color: "#00F6FF",
                fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
              }}
            >
              {item.year}
            </div>

            <div className="mt-[18px] overflow-hidden rounded-[12px] bg-black">
              <img
                src={item.image.__image_url__}
                alt={item.image.__image_prompt__ || item.title}
                className="h-[122px] w-full object-cover"
              />
            </div>

            <div className="mt-[18px] text-[24px] font-bold tracking-[0.04em]">
              {item.title}
            </div>

            <div
              className="mt-[10px] flex-1 text-[15px] leading-[1.58]"
              style={{ color: "#B4BDD0" }}
            >
              {item.description}
            </div>

            <div
              className="mt-[16px] inline-flex w-fit rounded-full border px-[12px] py-[6px] text-[11px] font-bold tracking-[0.16em] uppercase"
              style={{
                borderColor: "rgba(0,246,255,0.3)",
                backgroundColor: "rgba(0,246,255,0.08)",
                color: "#D8FDFF",
              }}
            >
              {item.keyword}
            </div>
          </div>
        ))}
      </div>

      <div
        className="absolute bottom-[34px] left-[56px] right-[56px] z-10 flex items-center justify-between border-t pt-[12px] text-[12px] font-medium"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          color: "#6F7C94",
        }}
      >
        <div>{parsed.sourceText}</div>
        <div className="font-bold tracking-[0.16em]">{parsed.pageNumber}</div>
      </div>
    </AnimeCanvas>
  );
};

export default HistoryTimeline;
