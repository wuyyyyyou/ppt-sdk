import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const impactCardSchema = z.object({
  accent: z.enum(["cyan", "magenta", "yellow"]).default("cyan"),
  icon: z.enum(["search", "headphones", "globe"]).default("search"),
  title: z.string().default("Discovery & Brand"),
  description: z
    .string()
    .default("OP/ED themes drive first impressions and lasting brand recall for global audiences."),
});

const trackSchema = z.object({
  number: z.string().default("01"),
  title: z.string().default("A Cruel Angel's Thesis"),
  animeTitle: z.string().default("Neon Genesis Evangelion (新世纪福音战士)"),
});

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

export const Schema = z.object({
  backgroundTitle: z.string().default("MUSIC"),
  title: z.string().default("动漫音乐的力量"),
  subtitle: z.string().default("THE POWER OF ANIME MUSIC"),
  signalLabel: z.string().default("SOUND_ANALYSIS"),
  signalNote: z.string().default("CLASSIC OST COLLECTION"),
  playlistTitle: z.string().default("Iconic Tracks Selection"),
  playlistCode: z.string().default("CURATED OST / 05"),
  chartTitle: z.string().default("Audio Spectrum Visualization"),
  chartCode: z.string().default("STATIC FREQUENCY MAP"),
  chartHint: z.string().default("Replace with a real spectrum, waveform, or concert-equipment visual."),
  footerTag: z.string().default("ANIME FILE / 17"),
  impactCards: z.array(impactCardSchema).length(3).default([
    {
      accent: "cyan",
      icon: "search",
      title: "Discovery & Brand",
      description:
        "OP/ED themes drive first impressions and lasting brand recall for global audiences.",
    },
    {
      accent: "magenta",
      icon: "headphones",
      title: "Retention Boost",
      description:
        "OST streaming on platforms like Spotify increases viewer engagement and long-term retention.",
    },
    {
      accent: "yellow",
      icon: "globe",
      title: "Global Expansion",
      description:
        "Live concerts and tours (Ani-Song) expand the fan community beyond cultural borders.",
    },
  ]),
  tracks: z.array(trackSchema).length(5).default([
    {
      number: "01",
      title: "A Cruel Angel's Thesis",
      animeTitle: "Neon Genesis Evangelion (新世纪福音战士)",
    },
    {
      number: "02",
      title: "Tank!",
      animeTitle: "Cowboy Bebop (星际牛仔)",
    },
    {
      number: "03",
      title: "Gurenge (红莲华)",
      animeTitle: "Demon Slayer (鬼灭之刃)",
    },
    {
      number: "04",
      title: "Again",
      animeTitle: "Fullmetal Alchemist (钢之炼金术师)",
    },
    {
      number: "05",
      title: "My Dearest",
      animeTitle: "Guilty Crown (罪恶王冠)",
    },
  ]),
  spectrumImage: imageSchema(
    "",
    "Audio spectrum visualization placeholder",
  ),
});

export const layoutId = "music-power-showcase";
export const layoutName = "Music Power Showcase";
export const layoutDescription =
  "A final anime music slide with three impact cards, a curated OST playlist, and a compact spectrum panel that keeps text editable while isolating the graphic chart area.";
export const layoutTags = ["anime", "music", "ost", "playlist", "spectrum", "closing"];
export const layoutRole = "conclusion";
export const contentElements = ["headline", "impact-cards", "playlist-panel", "spectrum-panel"];
export const useCases = ["music-culture", "ost-summary", "final-topic-highlight"];
export const suitableFor =
  "Suitable for a final thematic slide that closes a deck with music influence, notable tracks, and one compact graphic module.";
export const avoidFor =
  "Avoid using this layout for long essays, large tables, or slides that require multiple independent charts.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const accentPalette = {
  cyan: {
    line: "#00F6FF",
    border: "#24404C",
    panel: "#111821",
    label: "#A8F9FF",
    dim: "#91A6B3",
  },
  magenta: {
    line: "#FF4FD8",
    border: "#442D48",
    panel: "#17131D",
    label: "#FFD1F8",
    dim: "#A991B1",
  },
  yellow: {
    line: "#FFD24A",
    border: "#493C1E",
    panel: "#19160F",
    label: "#FFE8A1",
    dim: "#B1A17A",
  },
} as const;

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);
const monoFontFamily =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const CornerMark = ({
  position,
  color,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  color: string;
}) => {
  const horizontalClass =
    position === "top-left" || position === "bottom-left" ? "left-[10px]" : "right-[10px]";
  const verticalClass =
    position === "top-left" || position === "top-right" ? "top-[10px]" : "bottom-[10px]";
  const horizontalEdge =
    position === "top-left" || position === "bottom-left" ? "left-0" : "right-0";
  const verticalEdge =
    position === "top-left" || position === "top-right" ? "top-0" : "bottom-0";

  return (
    <div className={`absolute ${horizontalClass} ${verticalClass} h-[18px] w-[18px]`}>
      <div
        className={`absolute ${verticalEdge} ${horizontalEdge} h-[3px] w-[18px]`}
        style={{ backgroundColor: color }}
      />
      <div
        className={`absolute ${verticalEdge} ${horizontalEdge} h-[18px] w-[3px]`}
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

const SearchIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke={color} strokeWidth="2.2" />
    <path d="m15 15 4 4" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const HeadphonesIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path
      d="M5.2 12a6.8 6.8 0 0 1 13.6 0"
      fill="none"
      stroke={color}
      strokeWidth="2.1"
      strokeLinecap="round"
    />
    <rect x="4.5" y="11.2" width="3.4" height="6.3" rx="1.4" fill="none" stroke={color} strokeWidth="2.1" />
    <rect x="16.1" y="11.2" width="3.4" height="6.3" rx="1.4" fill="none" stroke={color} strokeWidth="2.1" />
  </svg>
);

const GlobeIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <circle cx="12" cy="12" r="8" fill="none" stroke={color} strokeWidth="2.1" />
    <path
      d="M4.8 12h14.4M12 4.4c2.2 2.2 3.5 4.8 3.5 7.6s-1.3 5.4-3.5 7.6c-2.2-2.2-3.5-4.8-3.5-7.6s1.3-5.4 3.5-7.6Z"
      fill="none"
      stroke={color}
      strokeWidth="2.1"
      strokeLinejoin="round"
    />
  </svg>
);

const PlaylistIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <path d="M7 8.2h10M7 12h10M7 15.8h6.5" fill="none" stroke="#7E8798" strokeWidth="2" strokeLinecap="round" />
    <circle cx="17.6" cy="16.8" r="1.6" fill="#00F6FF" />
  </svg>
);

const SpectrumIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <rect x="4.5" y="11" width="2.5" height="7" rx="1.1" fill="#00F6FF" />
    <rect x="10.75" y="6.5" width="2.5" height="11.5" rx="1.1" fill="#FF4FD8" />
    <rect x="17" y="8.5" width="2.5" height="9.5" rx="1.1" fill="#FFD24A" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="#FF4FD8" strokeWidth="1.8" />
    <path d="m10 8.8 5.4 3.2-5.4 3.2V8.8Z" fill="#FF4FD8" />
  </svg>
);

const ImpactIcon = ({
  icon,
  color,
}: {
  icon: z.infer<typeof impactCardSchema>["icon"];
  color: string;
}) => {
  switch (icon) {
    case "search":
      return <SearchIcon color={color} />;
    case "headphones":
      return <HeadphonesIcon color={color} />;
    case "globe":
      return <GlobeIcon color={color} />;
  }
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
      className="absolute left-0 top-[-8px] whitespace-nowrap text-[82px] font-bold uppercase leading-none"
      style={{
        color: "#171B25",
        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
      }}
    >
      {backgroundTitle}
    </div>
    <div className="relative pt-[28px]">
      <div
        aria-hidden="true"
        className="absolute left-[5px] top-[31px] whitespace-nowrap text-[40px] font-black leading-none"
        style={{ color: "#00F6FF" }}
      >
        {title}
      </div>
      <div className="relative whitespace-nowrap text-[40px] font-black leading-none text-white">
        {title}
      </div>
      <div className="mt-[10px] h-[4px] w-[86px] bg-[#FF4FD8]" />
      <div
        className="mt-[10px] whitespace-nowrap text-[13px] font-bold tracking-[0.26em]"
        style={{ color: "#8893A6", fontFamily: monoFontFamily }}
      >
        {subtitle}
      </div>
    </div>
  </div>
);

const SignalTag = ({ label, note }: { label: string; note: string }) => (
  <div className="relative z-10 flex flex-col items-end gap-[9px]">
    <div
      className="inline-flex h-[34px] items-center gap-[10px] rounded-[6px] border px-[12px]"
      style={{ borderColor: "#22394A", backgroundColor: "#0B1218" }}
    >
      <div className="flex h-[16px] w-[16px] items-center justify-center">
        <SpectrumIcon />
      </div>
      <div
        className="whitespace-nowrap text-[12px] font-bold tracking-[0.22em]"
        style={{ color: "#00F6FF", fontFamily: monoFontFamily }}
      >
        {label}
      </div>
    </div>
    <div
      className="whitespace-nowrap text-[11px] font-bold tracking-[0.24em]"
      style={{ color: "#586071", fontFamily: monoFontFamily }}
    >
      {note}
    </div>
  </div>
);

const ImpactCard = ({ item }: { item: z.infer<typeof impactCardSchema> } & React.Attributes) => {
  const palette = accentPalette[item.accent];

  return (
    <div
      className="relative h-[112px] overflow-hidden rounded-[10px] border px-[18px] py-[14px]"
      style={{
        borderColor: palette.border,
        backgroundColor: palette.panel,
      }}
    >
      <div className="absolute left-0 top-0 h-full w-[4px]" style={{ backgroundColor: palette.line }} />
      <CornerMark position="top-right" color={palette.line} />
      <div className="flex items-start gap-[10px]">
        <div className="mt-[1px] flex h-[20px] w-[20px] shrink-0 items-center justify-center">
          <ImpactIcon icon={item.icon} color={palette.line} />
        </div>
        <div className="min-w-0">
          <div
            className="whitespace-nowrap text-[16px] font-bold uppercase leading-none"
            style={{
              color: "#FFFFFF",
              fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
            }}
          >
            {item.title}
          </div>
          <div className="mt-[10px] text-[13px] leading-[1.45]" style={{ color: palette.dim }}>
            {item.description}
          </div>
        </div>
      </div>
    </div>
  );
};

const PanelHeader = ({
  icon,
  title,
  code,
}: {
  icon: React.ReactNode;
  title: string;
  code: string;
}) => (
  <div
    className="relative z-10 grid items-center border-b pb-[12px]"
    style={{
      borderColor: "#232B37",
      gridTemplateColumns: "minmax(0, 1fr) 208px",
      columnGap: "12px",
    }}
  >
    <div className="flex min-w-0 items-center gap-[10px]">
      <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">{icon}</div>
      <div
        className="truncate whitespace-nowrap text-[17px] font-bold uppercase"
        style={{
          color: "#00F6FF",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {title}
      </div>
    </div>
    <div
      className="justify-self-end whitespace-nowrap text-[11px] font-bold tracking-[0.22em]"
      style={{ color: "#626C7D", fontFamily: monoFontFamily }}
    >
      {code}
    </div>
  </div>
);

const PlaylistRow = ({ item }: { item: z.infer<typeof trackSchema> } & React.Attributes) => (
  <div
    className="grid h-full items-center border-b"
    style={{
      borderColor: "#1A2029",
      gridTemplateColumns: "56px minmax(0, 1fr) 30px",
      columnGap: "12px",
    }}
  >
    <div
      className="whitespace-nowrap text-[22px] font-bold leading-none"
      style={{
        color: "#00F6FF",
        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
      }}
    >
      {item.number}
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-[15px] font-bold leading-[1.18] text-white">{item.title}</div>
      <div className="truncate mt-[2px] text-[11px] leading-[1.35]" style={{ color: "#7C8595" }}>
        {item.animeTitle}
      </div>
    </div>
    <div className="flex h-[18px] w-[18px] justify-self-end items-center justify-center">
      <PlayIcon />
    </div>
  </div>
);

const SpectrumPanel = ({
  title,
  code,
  hint,
  image,
}: {
  title: string;
  code: string;
  hint: string;
  image: z.infer<typeof Schema>["spectrumImage"];
}) => (
  <div
    className="relative h-[372px] overflow-hidden rounded-[10px] border px-[18px] py-[16px]"
    style={{
      borderColor: "#283242",
      backgroundColor: "#10141D",
    }}
  >
    <CornerMark position="bottom-right" color="#848B9A" />
    <PanelHeader icon={<SpectrumIcon />} title={title} code={code} />

    <div
      data-pptx-export="screenshot"
      className="relative mt-[8px] h-[272px] overflow-hidden rounded-[8px] border"
      style={{
        borderColor: "#1E2734",
        backgroundColor: "#0C1018",
      }}
    >
      {image.__image_url__ ? (
        <img
          src={image.__image_url__}
          alt={image.__image_prompt__ || "Audio spectrum visualization"}
          className="h-full w-full"
          style={{ objectFit: "cover", objectPosition: "center center" }}
        />
      ) : null}

      <div className="absolute inset-0 bg-[#0B0F17]" style={{ opacity: image.__image_url__ ? 0.18 : 0.82 }} />

      {!image.__image_url__ ? (
        <div className="absolute inset-0 flex items-center justify-center p-[28px]">
          <div
            className="w-full rounded-[10px] border px-[24px] py-[22px]"
            style={{
              borderColor: "#263241",
              backgroundColor: "#111722",
            }}
          >
            <div
              className="whitespace-nowrap text-[12px] font-bold tracking-[0.26em]"
              style={{ color: "#00F6FF", fontFamily: monoFontFamily }}
            >
              SPECTRUM IMAGE PLACEHOLDER
            </div>
            <div className="mt-[16px] text-[28px] font-black leading-[1.05] text-white">
              Use a real waveform, console spectrum, or concert-light image here.
            </div>
            <div className="mt-[14px] max-w-[430px] text-[14px] leading-[1.5]" style={{ color: "#8D98AA" }}>
              {hint}
            </div>
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-[14px] left-[18px] flex items-center gap-[10px]">
        <div className="h-[2px] w-[28px] bg-[#00F6FF]" />
        <div
          className="whitespace-nowrap text-[10px] font-bold tracking-[0.2em]"
          style={{ color: "#6A7689", fontFamily: monoFontFamily }}
        >
          IMAGE-LED MODULE
        </div>
      </div>
    </div>
  </div>
);

const MusicPowerShowcase = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#0A0A10">
      <div className="absolute inset-0 bg-[#0A0A10]" />
      <div className="absolute left-0 top-0 h-full w-[724px] bg-[#080A12]" />
      <div className="absolute right-0 top-0 h-full w-[556px] bg-[#10131C]" />

      {gridRows.map((top) => (
        <div
          key={`grid-row-${top}`}
          className="absolute left-0 h-px w-full"
          style={{ top, backgroundColor: "#181C26" }}
        />
      ))}
      {gridColumns.map((left) => (
        <div
          key={`grid-column-${left}`}
          className="absolute top-0 h-full w-px"
          style={{ left, backgroundColor: "#181C26" }}
        />
      ))}

      <div className="absolute left-0 top-[104px] h-px w-full bg-[#232935]" />
      <div className="absolute left-[56px] top-[58px] h-[52px] w-[52px] border border-[#1F2431]" />
      <div className="absolute right-[58px] top-[98px] h-[52px] w-[52px] border border-[#1F2431]" />

      <div className="absolute left-[64px] top-[26px]">
        <TitleBlock
          backgroundTitle={parsed.backgroundTitle}
          title={parsed.title}
          subtitle={parsed.subtitle}
        />
      </div>

      <div className="absolute right-[64px] top-[40px]">
        <SignalTag label={parsed.signalLabel} note={parsed.signalNote} />
      </div>

      <div className="absolute left-[64px] top-[146px] right-[64px] grid grid-cols-3 gap-[18px]">
        {parsed.impactCards.map((item, index) => (
          <ImpactCard key={`${index}-${item.title}`} item={item} />
        ))}
      </div>

      <div className="absolute left-[64px] top-[292px] flex gap-[22px]">
        <div
          className="relative h-[372px] w-[548px] overflow-hidden rounded-[10px] border px-[18px] py-[16px]"
          style={{
            borderColor: "#283242",
            backgroundColor: "#10141D",
          }}
        >
          <CornerMark position="top-left" color="#848B9A" />
          <PanelHeader
            icon={<PlaylistIcon />}
            title={parsed.playlistTitle}
            code={parsed.playlistCode}
          />
          <div className="mt-[10px] grid h-[286px] grid-rows-5">
            {parsed.tracks.map((track, index) => (
              <PlaylistRow key={`${index}-${track.number}-${track.title}`} item={track} />
            ))}
          </div>
        </div>

        <div className="w-[582px]">
          <SpectrumPanel
            title={parsed.chartTitle}
            code={parsed.chartCode}
            hint={parsed.chartHint}
            image={parsed.spectrumImage}
          />
        </div>
      </div>

      <div className="absolute bottom-[36px] left-[64px] flex items-center gap-[14px]">
        <div className="h-[2px] w-[56px] bg-[#00F6FF]" />
        <div
          className="whitespace-nowrap text-[11px] font-bold tracking-[0.24em]"
          style={{ color: "#647082", fontFamily: monoFontFamily }}
        >
          {parsed.footerTag}
        </div>
      </div>
    </AnimeCanvas>
  );
};

export default MusicPowerShowcase;
