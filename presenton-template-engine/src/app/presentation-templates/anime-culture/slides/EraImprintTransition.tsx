import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const imageSchema = z
  .object({
    __image_url__: z
      .string()
      .default(
        "https://page.talentsecsite.com/slides_images/2a6908428bae2f9367589fa1bae39129.webp",
      ),
    __image_prompt__: z.string().default("Cyberpunk anime background"),
  })
  .default({
    __image_url__:
      "https://page.talentsecsite.com/slides_images/2a6908428bae2f9367589fa1bae39129.webp",
    __image_prompt__: "Cyberpunk anime background",
  });

const stripItemSchema = z.object({
  accent: z.enum(["cyan", "magenta", "yellow"]).default("cyan"),
  title: z.string().default("IMAGE"),
  image: imageSchema,
});

export const Schema = z.object({
  backgroundTitle: z.string().default("EVOLUTION"),
  title: z.string().default("时代的印记"),
  englishTitle: z.string().default("THE IMPRINT OF THE ERA"),
  subtitle: z.string().default("从历史到现在 ｜ 类型演化 × 全球扩散"),
  phaseLabel: z.string().default("SYSTEM TRANSITION"),
  phaseCode: z.string().default("PHASE_04"),
  backgroundImage: imageSchema,
  imageStrip: z.array(stripItemSchema).length(5).default([
    {
      accent: "cyan",
      title: "Classic",
      image: {
        __image_url__: "https://www.talentsec.ai/image_placeholder.png",
        __image_prompt__: "Classic anime style",
      },
    },
    {
      accent: "magenta",
      title: "Mecha",
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/eb7e75133c289df5bdef3394a1e07ee0.webp",
        __image_prompt__: "Mecha anime style",
      },
    },
    {
      accent: "yellow",
      title: "Fantasy",
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/b7dac7e2ff9f9967a93d0e7c968e95cb.webp",
        __image_prompt__: "Fantasy anime style",
      },
    },
    {
      accent: "cyan",
      title: "Cyberpunk",
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/4384a550b77e8975696e829cad7f7201.webp",
        __image_prompt__: "Cyberpunk anime style",
      },
    },
    {
      accent: "cyan",
      title: "Modern",
      image: {
        __image_url__:
          "https://page.talentsecsite.com/slides_images/56d4d4a6a828cdef593541957ad1057e.webp",
        __image_prompt__: "Modern anime style",
      },
    },
  ]),
});

export const layoutId = "era-imprint-transition";
export const layoutName = "Era Imprint Transition";
export const layoutDescription =
  "A neon transition slide with a centered title, atmospheric background image, and a five-image evolution strip.";
export const layoutTags = ["anime", "transition", "section-divider", "neon", "image-strip"];
export const layoutRole = "content";
export const contentElements = ["headline", "section-label", "background-title", "image-strip"];
export const useCases = ["section-divider", "chapter-intro", "narrative-transition"];
export const suitableFor =
  "Suitable for introducing a new chapter or bridging narrative sections with a strong visual mood and short editable text.";
export const avoidFor =
  "Avoid using this layout for dense analysis, multi-column body copy, or slides that require charts and long explanations.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const accentPalette = {
  cyan: {
    line: "#00F6FF",
    tint: "rgba(0, 246, 255, 0.16)",
    border: "#1D3441",
  },
  magenta: {
    line: "#FF4FD8",
    tint: "rgba(255, 79, 216, 0.18)",
    border: "#3A2538",
  },
  yellow: {
    line: "#FFD24A",
    tint: "rgba(255, 210, 74, 0.18)",
    border: "#40351D",
  },
} as const;

const CornerFrame = ({
  position,
  color,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  color: string;
}) => {
  const base = "absolute h-[14px] w-[14px]";

  if (position === "top-left") {
    return (
      <div className={`${base} left-[26px] top-[24px]`}>
        <div className="absolute left-0 top-0 h-[4px] w-[30px]" style={{ backgroundColor: color }} />
        <div className="absolute left-0 top-0 h-[30px] w-[4px]" style={{ backgroundColor: color }} />
      </div>
    );
  }

  if (position === "top-right") {
    return (
      <div className={`${base} right-[26px] top-[24px]`}>
        <div className="absolute right-0 top-0 h-[4px] w-[30px]" style={{ backgroundColor: color }} />
        <div className="absolute right-0 top-0 h-[30px] w-[4px]" style={{ backgroundColor: color }} />
      </div>
    );
  }

  if (position === "bottom-left") {
    return (
      <div className={`${base} bottom-[24px] left-[26px]`}>
        <div className="absolute bottom-0 left-0 h-[4px] w-[30px]" style={{ backgroundColor: color }} />
        <div className="absolute bottom-0 left-0 h-[30px] w-[4px]" style={{ backgroundColor: color }} />
      </div>
    );
  }

  return (
    <div className={`${base} bottom-[24px] right-[26px]`}>
      <div className="absolute bottom-0 right-0 h-[4px] w-[30px]" style={{ backgroundColor: color }} />
      <div className="absolute bottom-0 right-0 h-[30px] w-[4px]" style={{ backgroundColor: color }} />
    </div>
  );
};

const OffsetTitle = ({ text }: { text: string }) => (
  <div className="relative">
    <div
      aria-hidden="true"
      className="absolute left-[8px] top-[8px] whitespace-nowrap text-[88px] font-black leading-none tracking-[0.06em]"
      style={{ color: "#FF4FD8" }}
    >
      {text}
    </div>
    <div
      aria-hidden="true"
      className="absolute left-[-4px] top-[-4px] whitespace-nowrap text-[88px] font-black leading-none tracking-[0.06em]"
      style={{ color: "#00F6FF" }}
    >
      {text}
    </div>
    <div className="relative whitespace-nowrap text-[88px] font-black leading-none tracking-[0.06em] text-white">
      {text}
    </div>
  </div>
);

const PhasePanel = ({
  label,
  code,
}: {
  label: string;
  code: string;
}) => (
  <div className="absolute right-[92px] top-[84px] z-20">
    <div className="absolute left-[-12px] top-[14px] h-[40px] w-[4px] bg-[#FF4FD8]" />
    <div
      className="w-[238px] border px-[18px] py-[16px]"
      style={{
        borderColor: "#263848",
        backgroundColor: "rgba(6, 9, 18, 0.88)",
      }}
    >
      <div
        className="whitespace-nowrap text-[12px] font-bold tracking-[0.26em]"
        style={{
          color: "#8FA4B8",
          fontFamily:
            'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
        }}
      >
        {label}
      </div>
      <div className="mt-[10px] flex items-center gap-[12px]">
        <div className="h-[2px] w-[50px] bg-[#00F6FF]" />
        <div
          className="whitespace-nowrap text-[24px] font-bold leading-none"
          style={{
            color: "#FFFFFF",
            fontFamily:
              'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          {code}
        </div>
      </div>
    </div>
  </div>
);

const StripCard = ({
  item,
  index,
}: {
  item: z.infer<typeof stripItemSchema>;
  index: number;
}) => {
  const palette = accentPalette[item.accent];

  return (
    <div
      className="relative h-[96px] overflow-hidden border"
      style={{
        borderColor: palette.border,
        backgroundColor: "#0B101A",
      }}
    >
      <img
        src={item.image.__image_url__}
        alt={item.image.__image_prompt__ || item.title}
        className="h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0" style={{ backgroundColor: palette.tint }} />
      <div className="absolute left-0 top-0 h-[4px] w-full" style={{ backgroundColor: palette.line }} />
      <div className="absolute inset-[8px] border" style={{ borderColor: "rgba(255,255,255,0.18)" }} />
      <div
        className="absolute bottom-[10px] left-[12px] whitespace-nowrap text-[11px] font-bold tracking-[0.22em]"
        style={{
          color: "#F4F7FB",
          fontFamily:
            'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
        }}
      >
        {`0${index + 1}`}
      </div>
    </div>
  );
};

const EraImprintTransition = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#090A11">
      <img
        src={parsed.backgroundImage.__image_url__}
        alt={parsed.backgroundImage.__image_prompt__ || "Transition background"}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(5, 7, 14, 0.56)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 top-0 w-[218px]"
        style={{
          backgroundColor: "rgba(5, 7, 14, 0.36)",
        }}
      />
      <div
        className="absolute bottom-0 right-0 top-0 w-[218px]"
        style={{
          backgroundColor: "rgba(5, 7, 14, 0.36)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[248px]"
        style={{
          backgroundColor: "rgba(5, 7, 14, 0.28)",
        }}
      />
      {Array.from({ length: 180 }, (_, index) => (
        <div
          key={`scanline-${index}`}
          className="absolute left-0 right-0 h-[1px]"
          style={{
            top: `${index * 4}px`,
            backgroundColor: index % 2 === 0 ? "rgba(0, 0, 0, 0.11)" : "rgba(255, 255, 255, 0.02)",
          }}
        />
      ))}

      <div className="absolute bottom-0 left-[54px] top-0 w-[1px] bg-[#202633]" />
      <div className="absolute bottom-0 right-[54px] top-0 w-[1px] bg-[#202633]" />

      <CornerFrame position="top-left" color="#00F6FF" />
      <CornerFrame position="top-right" color="#00F6FF" />
      <CornerFrame position="bottom-left" color="#FF4FD8" />
      <CornerFrame position="bottom-right" color="#FF4FD8" />

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[192px] z-0 text-center whitespace-nowrap text-[164px] font-bold leading-none tracking-[0.18em]"
        style={{
          color: "#141924",
          fontFamily:
            'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
        }}
      >
        {parsed.backgroundTitle}
      </div>

      <PhasePanel label={parsed.phaseLabel} code={parsed.phaseCode} />

      <div className="absolute inset-x-0 top-[150px] z-10 flex flex-col items-center">
        <div className="h-[104px] w-[4px] bg-[#FF4FD8]" />

        <div className="mt-[22px]">
          <OffsetTitle text={parsed.title} />
        </div>

        <div
          className="mt-[16px] w-full text-center whitespace-nowrap text-[18px] font-bold tracking-[0.34em]"
          style={{
            color: "#FF89E8",
            fontFamily:
              'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          {parsed.englishTitle}
        </div>

        <div className="mt-[22px] h-[2px] w-[560px] bg-[#00F6FF]" />

        <div
          className="mt-[24px] inline-flex h-[62px] items-center justify-center border px-[30px]"
          style={{
            borderColor: "#23404A",
            backgroundColor: "rgba(6, 10, 18, 0.84)",
          }}
        >
          <div
            className="whitespace-nowrap text-[26px] font-semibold leading-none tracking-[0.08em]"
            style={{ color: "#EAF2FF" }}
          >
            {parsed.subtitle}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[48px] left-[140px] right-[140px] z-10 grid grid-cols-5 gap-[16px]">
        {parsed.imageStrip.map((item, index) => (
          <StripCard key={`${index}-${item.title}`} item={item} index={index} />
        ))}
      </div>
    </AnimeCanvas>
  );
};

export default EraImprintTransition;
