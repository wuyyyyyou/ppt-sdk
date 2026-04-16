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

const creatorSchema = z.object({
  accent: z.enum(["yellow", "cyan", "magenta"]).default("cyan"),
  name: z.string().default("HAYAO MIYAZAKI"),
  nativeName: z.string().default("宮崎 駿"),
  honorTitle: z.string().default("POETIC NARRATIVE"),
  worksLabel: z.string().default("MASTERPIECES"),
  works: z.array(z.string()).min(2).max(4).default([
    "《千与千寻》",
    "《天空之城》",
    "《龙猫》",
  ]),
  description: z
    .string()
    .default(
      "吉卜力工作室的灵魂人物，以精湛的手绘艺术、反战与环保主题，将日本动画提升至世界艺术殿堂。",
    ),
  image: imageSchema(
    "https://www.talentsec.ai/image_placeholder.png",
    "Anime creator portrait placeholder",
  ),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("LEGENDS"),
  title: z.string().default("动漫大师致敬"),
  subtitle: z.string().default("TRIBUTE TO THE CREATORS"),
  archiveLabel: z.string().default("MASTERS_ARCHIVE"),
  creators: z.array(creatorSchema).length(3).default([
    {
      accent: "yellow",
      name: "OSAMU TEZUKA",
      nativeName: "手塚 治虫",
      honorTitle: "GOD OF MANGA",
      worksLabel: "MASTERPIECES",
      works: ["《铁臂阿童木》", "《火鸟》", "《怪医黑杰克》"],
      description:
        "确立了日本现代 TV 动画的基础模式，其作品蕴含深刻的人文主义关怀，是日本动漫产业的奠基人。",
      image: {
        __image_url__: "https://www.talentsec.ai/image_placeholder.png",
        __image_prompt__: "Osamu Tezuka portrait placeholder",
      },
    },
    {
      accent: "cyan",
      name: "HAYAO MIYAZAKI",
      nativeName: "宮崎 駿",
      honorTitle: "POETIC NARRATIVE",
      worksLabel: "MASTERPIECES",
      works: ["《千与千寻》", "《天空之城》", "《龙猫》"],
      description:
        "吉卜力工作室的灵魂人物，以精湛的手绘艺术、反战与环保主题，将日本动画提升至世界艺术殿堂。",
      image: {
        __image_url__: "https://www.talentsec.ai/image_placeholder.png",
        __image_prompt__: "Hayao Miyazaki portrait placeholder",
      },
    },
    {
      accent: "magenta",
      name: "SATOSHI KON",
      nativeName: "今 敏",
      honorTitle: "VISUAL MAGICIAN",
      worksLabel: "MASTERPIECES",
      works: ["《未麻的部屋》", "《红辣椒》", "《千年女优》"],
      description:
        "探索心理现实与梦境的边界，以精准的蒙太奇剪辑重新定义了动画影像的叙事可能性。",
      image: {
        __image_url__: "https://www.talentsec.ai/image_placeholder.png",
        __image_prompt__: "Satoshi Kon portrait placeholder",
      },
    },
  ]),
});

export const layoutId = "masters-tribute";
export const layoutName = "Masters Tribute";
export const layoutDescription =
  "A three-card tribute slide for influential anime creators, using portrait panels, masterpiece tags, and neon editorial accents.";
export const layoutTags = ["anime", "creators", "tribute", "profile-cards", "editorial"];
export const layoutRole = "content";
export const contentElements = ["headline", "profile-cards", "portraits", "tag-list"];
export const useCases = ["creator-overview", "tribute-slide", "people-highlights"];
export const suitableFor =
  "Suitable for profiling notable creators, directors, or artists with short descriptors, representative works, and concise commentary.";
export const avoidFor =
  "Avoid using this layout for dense timelines, numeric dashboards, or long-form biographies.";
export const density = "medium";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const accentPalette = {
  yellow: {
    line: "#FFD24A",
    title: "#FFD24A",
    namePanelBackground: "rgba(23,20,13,0.86)",
    contentPanelBackground: "rgba(15,14,18,0.88)",
    panelBackground: "#111117",
    chipBackground: "#211A0F",
    chipBorder: "#5B4921",
    chipText: "#FFE39B",
    corner: "#FFD24A",
  },
  cyan: {
    line: "#00F6FF",
    title: "#00F6FF",
    namePanelBackground: "rgba(12,22,32,0.84)",
    contentPanelBackground: "rgba(15,17,24,0.86)",
    panelBackground: "#111117",
    chipBackground: "#0E1E24",
    chipBorder: "#244955",
    chipText: "#A7FBFF",
    corner: "#00F6FF",
  },
  magenta: {
    line: "#FF4FD8",
    title: "#FF4FD8",
    namePanelBackground: "rgba(24,17,29,0.86)",
    contentPanelBackground: "rgba(18,16,24,0.88)",
    panelBackground: "#111117",
    chipBackground: "#231221",
    chipBorder: "#5A2A54",
    chipText: "#FFD3F8",
    corner: "#FF4FD8",
  },
} as const;

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <path
      d="M4 18h16l-1.2-8.6-4.6 3.8L12 6 9.8 13.2 5.2 9.4 4 18Z"
      fill="none"
      stroke="#00F6FF"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M7 20h10" stroke="#00F6FF" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CornerMark = ({
  position,
  color,
}: {
  position: "top-right" | "bottom-left";
  color: string;
}) => {
  if (position === "top-right") {
    return (
      <div className="absolute right-[10px] top-[4px] z-30">
        <div className="absolute right-0 top-0 h-[3px] w-[20px]" style={{ backgroundColor: color }} />
        <div className="absolute right-0 top-0 h-[20px] w-[3px]" style={{ backgroundColor: color }} />
      </div>
    );
  }

  return (
    <div className="absolute bottom-[12px] left-[12px] z-20">
      <div className="absolute bottom-0 left-0 h-[3px] w-[20px]" style={{ backgroundColor: color }} />
      <div className="absolute bottom-0 left-0 h-[20px] w-[3px]" style={{ backgroundColor: color }} />
    </div>
  );
};

const TitleBlock = ({
  backgroundTitle,
  title,
  subtitle,
}: {
  backgroundTitle: string;
  title: string;
  subtitle: string;
}) => (
  <div className="relative z-10">
    <div
      aria-hidden="true"
      className="absolute left-0 top-[-22px] whitespace-nowrap text-[72px] font-bold leading-none tracking-[0.03em]"
      style={{
        color: "#252A37",
        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
      }}
    >
      {backgroundTitle}
    </div>
    <div className="relative pt-[30px]">
      <div
        aria-hidden="true"
        className="absolute left-[5px] top-[34px] whitespace-nowrap text-[40px] font-black tracking-[0.03em]"
        style={{ color: "#00F6FF" }}
      >
        {title}
      </div>
      <div className="relative whitespace-nowrap text-[40px] font-black tracking-[0.03em] text-white">
        {title}
      </div>
      <div className="mt-[10px] h-[4px] w-[92px] bg-[#FF4FD8]" />
      <div
        className="mt-[12px] whitespace-nowrap text-[13px] font-bold tracking-[0.26em]"
        style={{
          color: "#8B96A9",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        {subtitle}
      </div>
    </div>
  </div>
);

const ArchiveBadge = ({ label }: { label: string }) => (
  <div
    className="inline-flex h-[38px] items-center gap-[10px] rounded-[6px] border px-[14px]"
    style={{
      borderColor: "#22384A",
      backgroundColor: "#0B1218",
      color: "#00F6FF",
    }}
  >
    <div className="flex h-[18px] w-[18px] items-center justify-center">
      <CrownIcon />
    </div>
    <div
      className="whitespace-nowrap text-[13px] font-bold tracking-[0.16em]"
      style={{
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      }}
    >
      {label}
    </div>
  </div>
);

const MastersTribute = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

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

      <div className="absolute left-0 right-0 top-[370px] h-px bg-white/10" />

      <div className="absolute left-[56px] right-[56px] top-[24px] z-10 flex items-start justify-between">
        <TitleBlock
          backgroundTitle={parsed.backgroundTitle}
          title={parsed.title}
          subtitle={parsed.subtitle}
        />
      </div>

      <div className="absolute right-[56px] top-[134px] z-20">
        <ArchiveBadge label={parsed.archiveLabel} />
      </div>

      <div className="absolute left-[56px] right-[56px] top-[182px] bottom-[54px] z-10 grid grid-cols-3 gap-[22px]">
        {parsed.creators.map((creator) => {
          const accent = accentPalette[creator.accent];

          return (
            <div
              key={`${creator.name}-${creator.nativeName}`}
              className="relative flex h-full flex-col overflow-hidden rounded-[18px] border"
              style={{
                borderColor: "#2A3040",
                backgroundColor: accent.panelBackground,
              }}
            >
              <div
                className="absolute left-0 right-0 top-0 z-30 h-[4px]"
                style={{ backgroundColor: accent.line }}
              />
              <img
                src={creator.image.__image_url__}
                alt={creator.image.__image_prompt__ || creator.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="absolute inset-x-0 top-[0px] h-[208px]"
                style={{ backgroundColor: "rgba(5,7,12,0.08)" }}
              />
              <div
                className="absolute inset-x-0 top-[208px] h-[104px]"
                style={{ backgroundColor: accent.namePanelBackground }}
              />
              <div
                className="absolute inset-x-0 bottom-0 top-[312px]"
                style={{ backgroundColor: accent.contentPanelBackground }}
              />
              <CornerMark position="top-right" color={accent.corner} />
              <CornerMark position="bottom-left" color={accent.corner} />

              <div className="relative z-10 flex h-full flex-col">
                <div className="h-[208px]" />

                <div className="flex h-[104px] px-[18px]">
                  <div className="mt-[34px]">
                    <div
                      className="whitespace-nowrap text-[30px] font-bold leading-[0.96]"
                      style={{
                        color: accent.title,
                        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                      }}
                    >
                      {creator.name}
                    </div>
                    <div
                      className="mt-[12px] text-[14px] font-medium leading-none tracking-[0.12em]"
                      style={{ color: "#D7DEE9" }}
                    >
                      {creator.nativeName}
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-[#2A3040]" />

                <div className="flex flex-1 flex-col px-[18px] pb-[18px] pt-[18px]">
                  <div
                    className="inline-flex h-[30px] w-fit items-center rounded-[4px] border px-[10px] text-[11px] font-bold tracking-[0.18em]"
                    style={{
                      borderColor: accent.chipBorder,
                      backgroundColor: accent.chipBackground,
                      color: accent.chipText,
                    }}
                  >
                    {creator.honorTitle}
                  </div>

                  <div className="mt-[18px]">
                    <div
                      className="text-[11px] font-bold tracking-[0.22em]"
                      style={{
                        color: "#7E899F",
                        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                      }}
                    >
                      {creator.worksLabel}
                    </div>
                    <div className="mt-[10px] flex flex-wrap gap-[8px]">
                      {creator.works.map((work) => (
                        <div
                          key={`${creator.name}-${work}`}
                          className="rounded-[999px] border px-[10px] py-[5px] text-[12px] font-medium"
                          style={{
                            borderColor: "#333A4A",
                            backgroundColor: "#181C25",
                            color: "#E8EDF5",
                          }}
                        >
                          {work}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto">
                    <div className="mb-[16px] h-px w-full bg-[#2A3040]" />
                    <div className="text-[15px] leading-[1.7]" style={{ color: "#B2BACB" }}>
                      {creator.description}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AnimeCanvas>
  );
};

export default MastersTribute;
