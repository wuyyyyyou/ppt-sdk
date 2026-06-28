import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

export type AnalyticsIconName =
  | "binoculars"
  | "bolt"
  | "broadcast"
  | "chart-column"
  | "chart-line"
  | "chart-pie"
  | "file-signature"
  | "flask"
  | "gauge"
  | "grid"
  | "robot"
  | "scale"
  | "shield"
  | "users"
  | "wallet";

const ICON_NAMES = new Set<string>([
  "binoculars",
  "bolt",
  "broadcast",
  "chart-column",
  "chart-line",
  "chart-pie",
  "file-signature",
  "flask",
  "gauge",
  "grid",
  "robot",
  "scale",
  "shield",
  "users",
  "wallet",
]);

export function isAnalyticsIconName(name: string): name is AnalyticsIconName {
  return ICON_NAMES.has(name);
}

type AnalyticsIconProps = {
  name: AnalyticsIconName | string;
  className?: string;
  stroke?: string;
  fill?: string;
};

const defaultStroke = chartAnalyticsTheme.colors.primary;

export const AnalyticsIcon = ({
  name,
  className = "h-[20px] w-[20px]",
  stroke = defaultStroke,
  fill = "none",
}: AnalyticsIconProps) => {
  const resolvedName = isAnalyticsIconName(name) ? name : "chart-column";

  switch (resolvedName) {
    case "binoculars":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M8 8.5 6 15.8A3 3 0 1 0 11.8 17l.2-1h0l.2 1A3 3 0 1 0 18 15.8l-2-7.3" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 8.5h6M10 6h4v2.5h-4V6Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="8.7" cy="16.5" r="1.1" fill={stroke} />
          <circle cx="15.3" cy="16.5" r="1.1" fill={stroke} />
        </svg>
      );
    case "bolt":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill={fill}>
          <path d="M13.5 3 6.8 12h4.4L10.5 21l6.7-9h-4.4L13.5 3Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "broadcast":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M12 19V9.5M8.5 19h7M10.2 9.5h3.6L12 5.5l-1.8 4Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7.4 7.7a6.5 6.5 0 0 0 0 7.1M16.6 7.7a6.5 6.5 0 0 1 0 7.1M4.6 5.2a10.2 10.2 0 0 0 0 12.1M19.4 5.2a10.2 10.2 0 0 1 0 12.1" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "chart-line":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M4 19h16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="m5 15 4-4 3 3 6-7" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 7h2.8v2.8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "chart-pie":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M12 4.5v7.5h7.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19.2 9.2A7.7 7.7 0 1 0 12 19.7a7.7 7.7 0 0 0 7.2-5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M14 4.8a7.8 7.8 0 0 1 5.2 5.2H14V4.8Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "file-signature":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M7 3.8h6.4L18 8.4V20H7V3.8Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M13.2 4v4.6H18M9.5 12h5M9.5 15h2.2" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12.5 17.4c1.2-1.4 2.1-1.5 2.6-.3.5 1.1 1.2 1 2.2-.1" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "flask":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M9 4h6M10 4v5.4l-4.2 7.4A2.3 2.3 0 0 0 7.8 20h8.4a2.3 2.3 0 0 0 2-3.2L14 9.4V4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.2 15.5h7.6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "gauge":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M4.5 15.5a7.5 7.5 0 1 1 15 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="m12 15 4-4M7.5 15.5h9" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7.3 10.4 6.1 9.2M16.7 10.4l1.2-1.2M12 8V6.2" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "grid":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="5" y="5" width="5.2" height="5.2" rx="1.2" stroke={stroke} strokeWidth="1.8" />
          <rect x="13.8" y="5" width="5.2" height="5.2" rx="1.2" stroke={stroke} strokeWidth="1.8" />
          <rect x="5" y="13.8" width="5.2" height="5.2" rx="1.2" stroke={stroke} strokeWidth="1.8" />
          <rect x="13.8" y="13.8" width="5.2" height="5.2" rx="1.2" stroke={stroke} strokeWidth="1.8" />
        </svg>
      );
    case "robot":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M12 4v2.5M7.5 8h9A2.5 2.5 0 0 1 19 10.5V16a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5.5A2.5 2.5 0 0 1 7.5 8Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9.2" cy="13" r="1" fill={stroke} />
          <circle cx="14.8" cy="13" r="1" fill={stroke} />
          <path d="M9.5 16h5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "scale":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M12 5v14M7 8h10M7 8l-3 6h6L7 8ZM17 8l-3 6h6l-3-6Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 19h7" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M12 4.5 18.5 7v5.2c0 3.5-2.2 6.1-6.5 7.3-4.3-1.2-6.5-3.8-6.5-7.3V7L12 4.5Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m9.2 12.3 1.8 1.8 3.9-4.2" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="9" cy="8.2" r="3" stroke={stroke} strokeWidth="1.8" />
          <path d="M4.5 18.5c.5-3.1 2.1-4.6 4.5-4.6s4 1.5 4.5 4.6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M15.2 11.4a2.5 2.5 0 1 0-.2-4.9M15.5 14c1.9.3 3.2 1.8 3.8 4.2" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M5 8.5h12.5A2.5 2.5 0 0 1 20 11v6A2.5 2.5 0 0 1 17.5 19H6.5A2.5 2.5 0 0 1 4 16.5v-8A2.5 2.5 0 0 1 6.5 6H17" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15.5 13.2h4.5v3.6h-4.5a1.8 1.8 0 1 1 0-3.6Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "chart-column":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M4.5 19h15" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <rect x="6" y="11.5" width="2.6" height="5" rx="0.8" fill={stroke} stroke="none" />
          <rect x="10.7" y="8.5" width="2.6" height="8" rx="0.8" fill={stroke} stroke="none" />
          <rect x="15.4" y="5.5" width="2.6" height="11" rx="0.8" fill={stroke} stroke="none" />
        </svg>
      );
  }
};
