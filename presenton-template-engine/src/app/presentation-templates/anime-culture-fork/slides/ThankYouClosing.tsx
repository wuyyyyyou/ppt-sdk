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

const contactItemSchema = z.object({
  label: z.string().default("WEB"),
  value: z.string().default("www.talentsec.ai"),
  icon: z.enum(["globe", "mail", "signal"]).default("globe"),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("THANK YOU"),
  title: z.string().default("感谢聆听"),
  subtitle: z.string().default("FOR YOUR ATTENTION"),
  presenterLabel: z.string().default("PRESENTER"),
  presenterName: z.string().default("Talentsec AI"),
  presenterRole: z.string().default("Intelligent Presentation Generator"),
  contacts: z.array(contactItemSchema).default([
    { label: "WEB", value: "www.talentsec.ai", icon: "globe" },
    { label: "MAIL", value: "contact@talentsec.ai", icon: "mail" },
    { label: "SOCIAL", value: "@TalentsecAI", icon: "signal" },
  ]),
  systemLabel: z.string().default("SYSTEM STATUS"),
  systemValue: z.string().default("COMPLETE"),
  sessionCode: z.string().default("SESSION_END"),
  qrLabel: z.string().default("SCAN FOR SLIDES"),
  qrHelper: z.string().default("ACCESS THE FULL DECK"),
  qrTarget: z.string().default("https://www.talentsec.ai"),
  qrImage: imageSchema(
    "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.talentsec.ai",
    "Talentsec deck QR code",
  ),
  footerLeft: z.string().default("© 2026 Talentsec AI. All Rights Reserved."),
  footerRight: z
    .string()
    .default("Images sourced from Unsplash & Talentsec Asset Library"),
});

export const layoutId = "thank-you-closing";
export const layoutName = "Thank You Closing";
export const layoutDescription =
  "A final thank-you slide with a neon offset headline, presenter contact panel, and QR card for deck access.";
export const layoutTags = ["closing", "thank-you", "anime", "qr", "contact"];
export const layoutRole = "conclusion";
export const contentElements = ["headline", "contact-panel", "qr-card", "footer-meta"];
export const useCases = ["thank-you", "closing", "contact-slide"];
export const suitableFor =
  "Suitable for the final page of a deck when the presentation should end with a clear thank-you, presenter identity, and QR access point.";
export const avoidFor =
  "Avoid using this layout for summary-heavy conclusions, dense analysis, or slides that require multiple charts and long body copy.";
export const density = "low";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);

const monoFontFamily =
  'ui-monospace, "SFMono-Regular", "SFMono-Regular", Menlo, Consolas, monospace';

const OffsetHeadline = ({ text }: { text: string }) => (
  <div className="relative" style={{ height: "108px" }}>
    <div
      aria-hidden="true"
      className="absolute left-[8px] top-[8px] whitespace-nowrap text-[86px] font-black leading-none tracking-[0.03em]"
      style={{ color: "#FF00FF" }}
    >
      {text}
    </div>
    <div
      aria-hidden="true"
      className="absolute left-[-4px] top-[-4px] whitespace-nowrap text-[86px] font-black leading-none tracking-[0.03em]"
      style={{ color: "#00F6FF" }}
    >
      {text}
    </div>
    <div className="relative whitespace-nowrap text-[86px] font-black leading-none tracking-[0.03em] text-white">
      {text}
    </div>
  </div>
);

const GlobeIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke={color} strokeWidth="2" />
    <path
      d="M3.7 12h16.6M12 3.7c2.6 2.4 4.2 5.2 4.2 8.3 0 3.1-1.6 5.9-4.2 8.3-2.6-2.4-4.2-5.2-4.2-8.3 0-3.1 1.6-5.9 4.2-8.3Z"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const MailIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke={color} strokeWidth="2" />
    <path
      d="m5.4 7.8 6.6 5.1 6.6-5.1"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SignalIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path
      d="M6 17.5c1.4-1.8 3.4-2.8 6-2.8s4.6 1 6 2.8M8.8 14.1c.8-1.1 1.9-1.7 3.2-1.7 1.4 0 2.4.6 3.3 1.7M11.1 10.6c.3-.4.6-.6.9-.6.4 0 .7.2 1 .6"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="18.8" r="1.4" fill={color} />
  </svg>
);

const QrIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <rect x="3" y="3" width="6" height="6" fill="none" stroke="#FF00FF" strokeWidth="2" />
    <rect x="15" y="3" width="6" height="6" fill="none" stroke="#FF00FF" strokeWidth="2" />
    <rect x="3" y="15" width="6" height="6" fill="none" stroke="#FF00FF" strokeWidth="2" />
    <path
      d="M15 15h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z"
      fill="#00F6FF"
    />
  </svg>
);

const ContactIcon = ({
  icon,
  color,
}: {
  icon: z.infer<typeof contactItemSchema>["icon"];
  color: string;
}) => {
  switch (icon) {
    case "globe":
      return <GlobeIcon color={color} />;
    case "mail":
      return <MailIcon color={color} />;
    case "signal":
      return <SignalIcon color={color} />;
  }
};

const CornerBracket = ({
  position,
  color,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  color: string;
}) => {
  const horizontalClass =
    position === "top-left" || position === "bottom-left" ? "left-0" : "right-0";
  const verticalClass =
    position === "top-left" || position === "top-right" ? "top-0" : "bottom-0";

  return (
    <div className={`absolute ${horizontalClass} ${verticalClass} h-[22px] w-[22px]`}>
      <div
        className={`absolute ${verticalClass} ${horizontalClass} h-[3px] w-[22px]`}
        style={{ backgroundColor: color }}
      />
      <div
        className={`absolute ${verticalClass} ${horizontalClass} h-[22px] w-[3px]`}
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

const ThankYouClosing = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#090A11">
      <div className="absolute inset-0 bg-[#090A11]" />
      <div className="absolute left-0 top-0 h-full w-[712px] bg-[#07080F]" style={{ opacity: 0.86 }} />
      <div className="absolute right-0 top-0 h-full w-[568px] bg-[#10131E]" style={{ opacity: 0.6 }} />

      {gridRows.map((top) => (
        <div
          key={`grid-row-${top}`}
          className="absolute left-0 h-px w-full"
          style={{ top, backgroundColor: "#1B1E27" }}
        />
      ))}
      {gridColumns.map((left) => (
        <div
          key={`grid-column-${left}`}
          className="absolute top-0 h-full w-px"
          style={{ left, backgroundColor: "#1B1E27" }}
        />
      ))}

      <div className="absolute left-0 top-[60px] h-px w-full bg-[#222531]" />

      <div className="absolute left-[54px] top-[98px] h-[54px] w-[54px] border border-[#202431]" />
      <div className="absolute bottom-[114px] right-[58px] h-[54px] w-[54px] border border-[#202431]" />

      <div
        aria-hidden="true"
        className="absolute right-[72px] top-[76px] whitespace-nowrap text-[84px] font-bold uppercase leading-none"
        style={{
          color: "#171A22",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {parsed.backgroundTitle}
      </div>

      <div className="absolute right-[54px] top-[24px] z-20 flex items-center gap-[12px]">
        <div
          className="whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.26em]"
          style={{ color: "#6D7382", fontFamily: monoFontFamily }}
        >
          {parsed.systemLabel}
        </div>
        <div className="h-[2px] w-[42px] bg-[#2A3141]" />
        <div
          className="whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "#00F6FF", fontFamily: monoFontFamily }}
        >
          {parsed.systemValue}
        </div>
        <div
          className="whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.2em]"
          style={{ color: "#FF00FF", fontFamily: monoFontFamily }}
        >
          {parsed.sessionCode}
        </div>
      </div>

      <div className="absolute left-[84px] top-[102px] z-10 w-[542px]">
        <div
          className="whitespace-nowrap text-[17px] font-bold tracking-[0.3em]"
          style={{
            color: "#00F6FF",
            fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          }}
        >
          {parsed.subtitle}
        </div>
        <div className="mt-[10px] h-[4px] w-[96px] bg-[#00F6FF]" />

        <div className="mt-[14px]">
          <OffsetHeadline text={parsed.title} />
        </div>

        <div
          className="relative mt-[22px] rounded-[8px] border bg-[#10131B]"
          style={{ borderColor: "#2A3040" }}
        >
          <div className="absolute bottom-0 left-0 top-0 w-[4px] bg-[#FF00FF]" />

          <div className="px-[26px] pb-[16px] pl-[32px] pt-[18px]">
            <div
              className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.26em]"
              style={{ color: "#7A8090", fontFamily: monoFontFamily }}
            >
              {parsed.presenterLabel}
            </div>

            <div
              className="mt-[8px] text-[40px] font-bold leading-none text-white"
              style={{ fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)' }}
            >
              {parsed.presenterName}
            </div>

            <div className="mt-[8px] text-[17px] font-semibold leading-none text-[#00F6FF]">
              {parsed.presenterRole}
            </div>

            <div className="mt-[16px] grid gap-[8px]">
              {parsed.contacts.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="flex items-center gap-[10px] rounded-[6px] border px-[12px] py-[8px]"
                  style={{
                    borderColor: "#272D3C",
                    backgroundColor: "#0B0E15",
                  }}
                >
                  <div
                    className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[6px] border"
                    style={{ borderColor: "#3A4151", backgroundColor: "#141925" }}
                  >
                    <ContactIcon icon={item.icon} color="#FF00FF" />
                  </div>

                  <div className="min-w-0">
                    <div
                      className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: "#7C8393", fontFamily: monoFontFamily }}
                    >
                      {item.label}
                    </div>
                    <div className="mt-[2px] whitespace-nowrap text-[16px] font-medium leading-none text-[#D8DBE4]">
                      {item.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute left-[682px] top-[116px] z-10 h-[470px] w-px bg-[#313644]" />
      <div className="absolute left-[680px] top-[324px] z-10 h-[72px] w-[5px] bg-[#00F6FF]" />

      <div className="absolute right-[102px] top-[144px] z-10">
        <div
          className="whitespace-nowrap text-[13px] font-bold uppercase tracking-[0.26em]"
          style={{ color: "#7B8190", fontFamily: monoFontFamily }}
        >
          QR ACCESS
        </div>

        <div
          className="relative mt-[18px] h-[352px] w-[352px] border bg-[#0C0E16]"
          style={{ borderColor: "#2A3040" }}
        >
          <CornerBracket position="top-left" color="#00F6FF" />
          <CornerBracket position="top-right" color="#00F6FF" />
          <CornerBracket position="bottom-left" color="#00F6FF" />
          <CornerBracket position="bottom-right" color="#00F6FF" />

          <div className="absolute left-[26px] top-[26px] h-[300px] w-[300px] bg-white p-[12px]">
            <img
              src={parsed.qrImage.__image_url__}
              alt={parsed.qrImage.__image_prompt__ || "Deck QR code"}
              className="h-full w-full object-contain"
            />
          </div>

        </div>

        <div
          className="mt-[22px] flex h-[78px] w-[352px] items-center gap-[14px] border px-[18px]"
          style={{ borderColor: "#FF00FF", backgroundColor: "#16111F" }}
        >
          <div
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[6px] border"
            style={{ borderColor: "#4A3552", backgroundColor: "#0F0F16" }}
          >
            <QrIcon />
          </div>

          <div className="min-w-0">
            <div
              className="whitespace-nowrap text-[22px] font-bold leading-none text-white"
              style={{ fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)' }}
            >
              {parsed.qrLabel}
            </div>
            <div
              className="mt-[8px] whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.22em]"
              style={{ color: "#D873D8", fontFamily: monoFontFamily }}
            >
              {parsed.qrHelper}
            </div>
          </div>
        </div>

        <div
          className="mt-[10px] whitespace-nowrap text-center text-[13px] font-bold uppercase tracking-[0.2em]"
          style={{ color: "#8E94A3", fontFamily: monoFontFamily }}
        >
          {parsed.qrTarget}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-20 h-[60px] w-full border-t bg-[#090B12]" style={{ borderColor: "#232733" }}>
        <div className="flex h-full items-center justify-between px-[48px]">
          <div
            className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ color: "#666C79", fontFamily: monoFontFamily }}
          >
            {parsed.footerLeft}
          </div>
          <div
            className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ color: "#666C79", fontFamily: monoFontFamily }}
          >
            {parsed.footerRight}
          </div>
        </div>
      </div>
    </AnimeCanvas>
  );
};

export default ThankYouClosing;
