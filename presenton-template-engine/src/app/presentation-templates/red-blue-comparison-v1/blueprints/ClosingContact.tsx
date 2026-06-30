import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import IconText from "../components/IconText.tsx";
import ThemeCanvas from "../components/ThemeCanvas.tsx";
import ThemePanelShell from "../components/ThemePanelShell.tsx";
import ThemeSoftCircle from "../components/ThemeSoftCircle.tsx";
import ThemePill from "../components/ThemePill.tsx";
import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

const ToneSchema = z.enum(["red", "blue", "purple", "neutral"]);
const ContactIconSchema = z.enum(["email", "phone", "link", "person"]);

const ContactItemSchema = z.object({
  icon: ContactIconSchema.default("email"),
  label: z.string().min(2).max(72),
  tone: ToneSchema.default("purple"),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("Thank You!"),
  urlLabel: z.string().min(2).max(48).default("www.example.com"),
  contactItems: z.array(ContactItemSchema).min(1).max(3).default([
    { icon: "email", label: "contact@example.com", tone: "purple" },
    { icon: "phone", label: "+1-555-000-0000", tone: "purple" },
  ]),
  footerNote: z.string().min(2).max(80).optional(),
  accentTone: ToneSchema.default("purple"),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({
  title: "Thank You!",
  urlLabel: "www.example.com",
  contactItems: [
    { icon: "email", label: "contact@example.com", tone: "purple" },
    { icon: "phone", label: "+1-555-000-0000", tone: "purple" },
  ],
  footerNote: "Red Blue Comparison | Closing",
  accentTone: "purple",
  showDecorations: true,
});

export const layoutId = "closing-contact";
export const layoutName = "Closing Contact";
export const layoutDescription =
  "A TSX-first closing page with a large thank-you message, editable URL pill, contact rows, and soft purple circle decorations.";
export const layoutTags = ["closing", "thank-you", "contact", "red-blue", "tsx-first"];
export const layoutRole = "closing";
export const contentElements = ["thank-you-title", "url-pill", "contact-items", "soft-circle-decorations"];
export const useCases = ["closing", "thank you", "contact information", "final page"];
export const suitableFor =
  "Suitable for the final slide of a comparison deck when the audience needs a clean thank-you page and one to three contact or follow-up lines.";
export const avoidFor =
  "Avoid using this layout for analytical conclusions, next-step action lists, dense recommendations, or content that needs charts or tables.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const closingCircles = [
  { key: "large-top-left", tone: "purple", left: -80, top: -120, size: 350, alpha: 0.08 },
  { key: "bottom-right", tone: "purple", left: 850, top: 610, size: 250, alpha: 0.18 },
  { key: "right-middle", tone: "purple", left: 1130, top: 180, size: 200, alpha: 0.06 },
  { key: "left-bottom", tone: "purple", left: 120, top: 450, size: 150, alpha: 0.12 },
  { key: "right-top", tone: "purple", left: 800, top: 80, size: 180, alpha: 0.05 },
  { key: "left-mid", tone: "purple", left: 300, top: 380, size: 120, alpha: 0.14 },
] as const;

const ContactIcon = ({ icon, tone }: { icon: z.infer<typeof ContactIconSchema>; tone: RedBlueTone }) => {
  const toneValue = redBlueComparisonTheme.tone[tone];

  const iconPath = {
    email: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    phone: (
      <>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.2-1.2" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22a8 8 0 0 1 16 0" />
      </>
    ),
  } satisfies Record<z.infer<typeof ContactIconSchema>, React.ReactNode>;

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={24}
      stroke={toneValue.color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.2}
      viewBox="0 0 24 24"
      width={24}
    >
      {iconPath[icon]}
    </svg>
  );
};

const ClosingContact = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const accentTone = parsed.accentTone as RedBlueTone;
  const accent = redBlueComparisonTheme.tone[accentTone];

  return (
    <ThemeCanvas>
      {parsed.showDecorations ? (
        <>
          {closingCircles.map((circle) => (
            <ThemeSoftCircle
              key={circle.key}
              tone={circle.tone}
              left={circle.left}
              top={circle.top}
              size={circle.size}
              alpha={circle.alpha}
            />
          ))}
        </>
      ) : null}

      <div className="absolute left-1/2 top-[128px] z-10 flex w-[860px] -translate-x-1/2 flex-col items-center text-center">
        <h1
          className="m-0 max-w-[860px] text-[118px] font-black leading-[1.06]"
          style={{
            color: accent.color,
            fontFamily: redBlueComparisonTheme.fonts.heading,
          }}
        >
          {parsed.title}
        </h1>

        <div className="mt-[38px]">
          <ThemePill tone={accentTone} height={54} className="px-[36px] normal-case">
            <span className="text-[27px] font-black leading-none">{parsed.urlLabel}</span>
          </ThemePill>
        </div>

        <ThemePanelShell
          className="mt-[34px] flex w-[600px] flex-col items-center gap-[14px]"
          padding={22}
          radius={redBlueComparisonTheme.radius.xl}
          borderColor={accent.border}
          backgroundColor="rgba(255,255,255,0.88)"
          shadow={redBlueComparisonTheme.shadow.panel}
        >
          {parsed.contactItems.map((item, index) => {
            const tone = item.tone as RedBlueTone;

            return (
              <IconText
                key={`${item.icon}-${item.label}-${index}`}
                icon={<ContactIcon icon={item.icon} tone={tone} />}
                label={item.label}
                height={30}
                iconSize={24}
                gap={12}
                fontSize={21}
                fontWeight={700}
                textColor={redBlueComparisonTheme.colors.backgroundText}
              />
            );
          })}
        </ThemePanelShell>

        {parsed.footerNote ? (
          <div
            className="mt-[28px] max-w-[720px] break-words text-[14px] font-black uppercase"
            style={{ color: redBlueComparisonTheme.colors.subtleText }}
          >
            {parsed.footerNote}
          </div>
        ) : null}
      </div>
    </ThemeCanvas>
  );
};

export default ClosingContact;
