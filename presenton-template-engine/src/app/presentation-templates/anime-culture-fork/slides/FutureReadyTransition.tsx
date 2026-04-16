import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const imageSchema = z
  .object({
    __image_url__: z
      .string()
      .default(
        "https://page.talentsecsite.com/slides_images/d5e6d0cfe4ec9ba9a383caf514376809.webp",
      ),
    __image_prompt__: z.string().default("Futuristic city night"),
  })
  .default({
    __image_url__:
      "https://page.talentsecsite.com/slides_images/d5e6d0cfe4ec9ba9a383caf514376809.webp",
    __image_prompt__: "Futuristic city night",
  });

export const Schema = z.object({
  backgroundTitle: z.string().default("FUTURE"),
  title: z.string().default("未来可期"),
  subtitle: z.string().default("技术 × 叙事 × 全球协作"),
  phaseLabel: z.string().default("SYSTEM TRANSITION"),
  phaseCode: z.string().default("PHASE_05"),
  phaseNote: z.string().default("FUTURE_READY"),
  loadingLabel: z.string().default("NEXT CHAPTER LOADING"),
  loadingValue: z.string().default("99%"),
  nextLabel: z.string().default("NEXT PHASE"),
  backgroundImage: imageSchema,
});

export const layoutId = "future-ready-transition";
export const layoutName = "Future Ready Transition";
export const layoutDescription =
  "A neon future-chapter transition slide with concentric tech rings, centered offset title, and concise next-phase metadata.";
export const layoutTags = ["anime", "transition", "future", "section-divider", "neon"];
export const layoutRole = "content";
export const contentElements = ["headline", "background-title", "status-label", "hero-graphic"];
export const useCases = ["section-divider", "future-outlook", "chapter-intro"];
export const suitableFor =
  "Suitable for introducing a future-facing chapter or creating a high-impact visual pause before a conclusion or outlook section.";
export const avoidFor =
  "Avoid using this layout for dense analysis, chart-heavy explanations, or slides that require more than a short set of editable labels.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const particlePositions = [
  { left: 248, top: 210, size: 4, color: "#00F6FF" },
  { left: 774, top: 156, size: 3, color: "#00F6FF" },
  { left: 1022, top: 304, size: 4, color: "#00F6FF" },
  { left: 978, top: 522, size: 6, color: "#FF4FD8" },
  { left: 292, top: 566, size: 5, color: "#FF4FD8" },
] as const;

const loadingSegments = [
  "#FF4FD8",
  "#FF4FD8",
  "#FF4FD8",
  "#FF4FD8",
  "#FF4FD8",
  "#00F6FF",
  "#00F6FF",
  "#00F6FF",
  "#00F6FF",
  "#3C4656",
] as const;

const CornerFrame = ({
  position,
  color,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  color: string;
}) => {
  const cornerSize = 24;
  const strokeThickness = 3;
  const strokeLength = 26;

  if (position === "top-left") {
    return (
      <div className="absolute left-[50px] top-[50px] z-20">
        <div
          className="absolute left-0 top-0"
          style={{ height: strokeThickness, width: strokeLength, backgroundColor: color }}
        />
        <div
          className="absolute left-0 top-0"
          style={{ height: strokeLength, width: strokeThickness, backgroundColor: color }}
        />
        <div className="h-[24px] w-[24px]" style={{ width: cornerSize, height: cornerSize }} />
      </div>
    );
  }

  if (position === "top-right") {
    return (
      <div className="absolute right-[50px] top-[50px] z-20">
        <div
          className="absolute right-0 top-0"
          style={{ height: strokeThickness, width: strokeLength, backgroundColor: color }}
        />
        <div
          className="absolute right-0 top-0"
          style={{ height: strokeLength, width: strokeThickness, backgroundColor: color }}
        />
        <div className="h-[24px] w-[24px]" style={{ width: cornerSize, height: cornerSize }} />
      </div>
    );
  }

  if (position === "bottom-left") {
    return (
      <div className="absolute bottom-[50px] left-[50px] z-20">
        <div
          className="absolute bottom-0 left-0"
          style={{ height: strokeThickness, width: strokeLength, backgroundColor: color }}
        />
        <div
          className="absolute bottom-0 left-0"
          style={{ height: strokeLength, width: strokeThickness, backgroundColor: color }}
        />
        <div className="h-[24px] w-[24px]" style={{ width: cornerSize, height: cornerSize }} />
      </div>
    );
  }

  return (
    <div className="absolute bottom-[50px] right-[50px] z-20">
      <div
        className="absolute bottom-0 right-0"
        style={{ height: strokeThickness, width: strokeLength, backgroundColor: color }}
      />
      <div
        className="absolute bottom-0 right-0"
        style={{ height: strokeLength, width: strokeThickness, backgroundColor: color }}
      />
      <div className="h-[24px] w-[24px]" style={{ width: cornerSize, height: cornerSize }} />
    </div>
  );
};

const OffsetTitle = ({ text }: { text: string }) => (
  <div className="relative">
    <div
      aria-hidden="true"
      className="absolute left-[6px] top-[6px] whitespace-nowrap text-[96px] font-black leading-none tracking-[0.06em]"
      style={{ color: "#FF4FD8" }}
    >
      {text}
    </div>
    <div
      aria-hidden="true"
      className="absolute left-[-4px] top-[-4px] whitespace-nowrap text-[96px] font-black leading-none tracking-[0.06em]"
      style={{ color: "#00F6FF" }}
    >
      {text}
    </div>
    <div className="relative whitespace-nowrap text-[96px] font-black leading-none tracking-[0.06em] text-white">
      {text}
    </div>
  </div>
);

const ChevronIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 20 20" className="h-[20px] w-[20px]" aria-hidden="true">
    <path
      d="m6 4 6 6-6 6"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ConcentricRings = () => (
  <div className="absolute inset-0 z-[6] flex items-center justify-center" aria-hidden="true">
    <svg width="900" height="900" viewBox="0 0 900 900" fill="none">
      <circle cx="450" cy="450" r="350" stroke="#00F6FF" strokeOpacity="0.38" strokeWidth="2" />
      <circle
        cx="450"
        cy="450"
        r="360"
        stroke="#00F6FF"
        strokeOpacity="0.18"
        strokeWidth="1"
        strokeDasharray="10 10"
      />
      <circle
        cx="450"
        cy="450"
        r="280"
        stroke="#FF4FD8"
        strokeOpacity="0.54"
        strokeWidth="3"
        strokeDasharray="40 20"
      />
      <circle cx="450" cy="450" r="200" stroke="#00F6FF" strokeOpacity="0.24" strokeWidth="5" />
      <circle cx="450" cy="450" r="180" stroke="#FFFFFF" strokeOpacity="0.34" strokeWidth="1.2" />
      <circle cx="100" cy="450" r="4" fill="#00F6FF" />
      <circle cx="800" cy="450" r="4" fill="#00F6FF" />
      <circle cx="450" cy="170" r="4" fill="#FF4FD8" />
    </svg>
  </div>
);

const FutureReadyTransition = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#090A11">
      <img
        src={parsed.backgroundImage.__image_url__}
        alt={parsed.backgroundImage.__image_prompt__ || "Future transition background"}
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{ opacity: 0.32 }}
      />

      <div className="absolute inset-0 bg-[#090A11]" style={{ opacity: 0.7 }} />
      <div className="absolute left-0 top-0 h-full w-[220px] bg-[#0A0D16]" style={{ opacity: 0.48 }} />
      <div className="absolute right-0 top-0 h-full w-[220px] bg-[#0A0D16]" style={{ opacity: 0.48 }} />
      <div className="absolute inset-x-0 bottom-0 h-[170px] bg-[#090A11]" style={{ opacity: 0.52 }} />

      {Array.from({ length: 180 }, (_, index) => (
        <div
          key={`scanline-${index}`}
          className="absolute left-0 right-0 h-[1px]"
          style={{
            top: `${index * 4}px`,
            backgroundColor: index % 2 === 0 ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.02)",
          }}
        />
      ))}

      <div className="absolute left-[60px] top-0 z-10 h-full w-[1px] bg-[#222B38]" />
      <div className="absolute right-[60px] top-0 z-10 h-full w-[1px] bg-[#222B38]" />
      <div className="absolute left-0 top-[60px] z-10 h-[1px] w-full bg-[#222B38]" />
      <div className="absolute bottom-[60px] left-0 z-10 h-[1px] w-full bg-[#222B38]" />

      <CornerFrame position="top-left" color="#FF4FD8" />
      <CornerFrame position="top-right" color="#FF4FD8" />
      <CornerFrame position="bottom-left" color="#FF4FD8" />
      <CornerFrame position="bottom-right" color="#FF4FD8" />

      <ConcentricRings />

      {particlePositions.map((particle, index) => (
        <div
          key={`particle-${index}`}
          className="absolute z-[8] rounded-full"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            boxShadow: `0 0 10px ${particle.color}`,
          }}
        />
      ))}

      <div className="absolute left-[60px] top-[28px] z-20 inline-flex h-[28px] items-center gap-[12px]">
        <div
          className="whitespace-nowrap text-[11px] font-bold tracking-[0.18em]"
          style={{
            color: "#7FEFFF",
            fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          {parsed.phaseLabel}
        </div>
        <div className="h-[10px] w-[1px] bg-[#2C4B58]" />
        <div
          className="whitespace-nowrap text-[11px] font-bold tracking-[0.18em]"
          style={{
            color: "#C3D0DB",
            fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          {parsed.phaseCode}
        </div>
        <div className="h-[10px] w-[1px] bg-[#2C4B58]" />
        <div
          className="whitespace-nowrap text-[11px] font-bold tracking-[0.18em]"
          style={{
            color: "#7FEFFF",
            fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          {parsed.phaseNote}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[198px] z-[5] text-center whitespace-nowrap text-[164px] font-bold leading-none tracking-[0.18em]"
        style={{
          color: "#151A26",
          fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
        }}
      >
        {parsed.backgroundTitle}
      </div>

      <div className="absolute inset-x-0 top-[168px] z-20 flex flex-col items-center">
        <div className="h-[92px] w-[4px] bg-[#FF4FD8]" />

        <div className="mt-[22px]">
          <OffsetTitle text={parsed.title} />
        </div>

        <div className="relative mt-[18px] h-[16px] w-[200px]">
          <div className="absolute left-0 top-0 h-[4px] w-[140px] bg-[#FF4FD8]" />
          <div className="absolute left-[28px] top-[10px] h-[2px] w-[100px] bg-[#00F6FF]" />
        </div>

        <div
          className="relative mt-[18px] inline-flex h-[68px] items-center justify-center border px-[42px]"
          style={{
            borderColor: "#284552",
            backgroundColor: "rgba(6, 10, 18, 0.84)",
          }}
        >
          <div className="absolute left-[14px] top-[12px] h-[44px] w-[4px] bg-[#00F6FF]" />
          <div className="absolute right-[14px] top-[12px] h-[44px] w-[4px] bg-[#00F6FF]" />
          <div
            className="whitespace-nowrap text-[28px] font-semibold tracking-[0.08em]"
            style={{ color: "#EAF2FF" }}
          >
            {parsed.subtitle}
          </div>
        </div>

        <div
          className="relative mt-[18px] inline-flex h-[28px] items-center gap-[14px]"
          style={{
            fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          <div className="whitespace-nowrap text-[11px] font-bold tracking-[0.34em] text-[#97A4B3]">
            {parsed.loadingLabel}
          </div>
          <div className="inline-flex h-[10px] items-center gap-[4px]">
            {loadingSegments.map((color, index) => (
              <div key={`segment-${index}`} className="h-[10px] w-[14px]" style={{ backgroundColor: color }} />
            ))}
          </div>
          <div className="whitespace-nowrap text-[12px] font-bold tracking-[0.2em] text-[#D8E4EF]">
            {parsed.loadingValue}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[38px] right-[80px] z-20 inline-flex h-[28px] items-center gap-[10px]">
        <div
          className="whitespace-nowrap text-[16px] font-bold tracking-[0.16em]"
          style={{
            color: "#D8E4EF",
            fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          {parsed.nextLabel}
        </div>
        <div className="inline-flex items-center">
          <ChevronIcon color="#00F6FF" />
          <div className="ml-[-4px]">
            <ChevronIcon color="#7B8C9F" />
          </div>
        </div>
      </div>
    </AnimeCanvas>
  );
};

export default FutureReadyTransition;
