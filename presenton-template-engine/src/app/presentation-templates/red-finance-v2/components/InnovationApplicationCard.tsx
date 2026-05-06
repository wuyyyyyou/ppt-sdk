import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";

export type InnovationApplicationIconName =
  | "wallet"
  | "brain"
  | "architecture"
  | "regtech"
  | "security";

type InnovationApplicationCardProps = {
  icon: InnovationApplicationIconName;
  title: string;
  tag: string;
  description: string;
  density?: "normal" | "compact" | "dense";
};

const InnovationApplicationIcon = ({
  name,
}: {
  name: InnovationApplicationIconName;
}) => {
  const className = "h-6 w-6";
  const style = { color: redFinanceTheme.colors.primary };

  switch (name) {
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
          <path d="M5 8.5h12.5A2.5 2.5 0 0 1 20 11v6A2.5 2.5 0 0 1 17.5 19H6.5A2.5 2.5 0 0 1 4 16.5v-8A2.5 2.5 0 0 1 6.5 6H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15.5 13.2h4.5v3.6h-4.5a1.8 1.8 0 1 1 0-3.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M16.9 15h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "brain":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
          <path d="M9.2 6.3a3 3 0 0 1 5.6 1.5 2.7 2.7 0 0 1 2.6 2.8 2.7 2.7 0 0 1-.9 2 2.8 2.8 0 0 1 .4 1.5 3 3 0 0 1-3 3H10a3.2 3.2 0 0 1-3.2-3.2 3 3 0 0 1 .5-1.7 2.7 2.7 0 0 1-.8-1.9 2.7 2.7 0 0 1 2.7-2.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M10.8 8.8v6.8M13.4 9.6v5.2M10.8 12h2.6M13.4 11.2h2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "architecture":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
          <rect x="4.5" y="5" width="6.5" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
          <rect x="13" y="5" width="6.5" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
          <rect x="8.8" y="14.2" width="6.5" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M7.8 9.8v2.3h8.4V9.8M12 12.1v2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "regtech":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
          <path d="M8 4.8h6.6l3.4 3.5v9.9A1.8 1.8 0 0 1 16.2 20H8a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14.6 4.8v3.8h3.4M9 12.2h6M9 15.4h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m10.2 9.2 1.2 1.2 2.5-2.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "security":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
          <path d="M12 4 18 6.3v4.9c0 4-2.2 6.8-6 8.8-3.8-2-6-4.8-6-8.8V6.3L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 10.4a1.8 1.8 0 0 1 1.8 1.8v2.8h-3.6v-2.8a1.8 1.8 0 0 1 1.8-1.8Zm0 0V9.1a1.8 1.8 0 1 1 3.6 0v1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
};

const InnovationApplicationCard = ({
  icon,
  title,
  tag,
  description,
  density = "normal",
}: InnovationApplicationCardProps) => {
  const iconBoxSize = density === "dense" ? 46 : density === "compact" ? 48 : 52;
  const iconClassName = density === "dense" ? "h-5 w-5" : "h-6 w-6";
  const outerPaddingX = density === "dense" ? 16 : 18;
  const outerPaddingY = density === "dense" ? 12 : density === "compact" ? 13 : 14;
  const innerGap = density === "dense" ? 14 : 16;
  const titleFontSize = density === "dense" ? 15 : 16;
  const descriptionFontSize = density === "dense" ? 12 : 13;
  const descriptionLineHeight = density === "dense" ? 1.4 : 1.45;
  const titleGap = density === "dense" ? 10 : 12;
  const titleMarginBottom = density === "dense" ? 5 : 6;

  return (
    <div
      className="flex overflow-hidden rounded-[8px] border"
      style={{
        borderColor: redFinanceTheme.colors.stroke,
        backgroundColor: redFinanceTheme.colors.background,
        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
      }}
    >
      <div
        className="w-[4px] flex-none"
        style={{ backgroundColor: "#D8DCE2" }}
      />
      <div
        className="flex min-w-0 flex-1 items-center"
        style={{
          gap: innerGap,
          paddingLeft: outerPaddingX,
          paddingRight: outerPaddingX,
          paddingTop: outerPaddingY,
          paddingBottom: outerPaddingY,
        }}
      >
        <div
          className="flex flex-none items-center justify-center rounded-[10px]"
          style={{
            width: iconBoxSize,
            height: iconBoxSize,
            backgroundColor: redFinanceTheme.colors.paleRed,
          }}
        >
          <div className={iconClassName}>
            <InnovationApplicationIcon name={icon} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="flex items-start justify-between"
            style={{
              gap: titleGap,
              marginBottom: titleMarginBottom,
            }}
          >
            <div
              className="min-w-0 flex-1 font-bold leading-[1.3]"
              style={{
                fontSize: titleFontSize,
                color: redFinanceTheme.colors.backgroundText,
              }}
            >
              {title}
            </div>
            <div
              className="flex-none whitespace-nowrap rounded-[4px] border px-[6px] py-[2px] text-[10px] font-semibold uppercase"
              style={{
                color: redFinanceTheme.colors.mutedText,
                borderColor: redFinanceTheme.colors.stroke,
                backgroundColor: "#FAFAFA",
              }}
            >
              {tag}
            </div>
          </div>
          <p
            style={{
              fontSize: descriptionFontSize,
              lineHeight: descriptionLineHeight,
              color: redFinanceTheme.colors.mutedText,
            }}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default InnovationApplicationCard;
