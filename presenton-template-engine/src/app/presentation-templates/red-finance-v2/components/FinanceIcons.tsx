import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";

export type FinanceIconName =
  | "bank"
  | "book-open"
  | "calendar"
  | "chart-line"
  | "chart-pie"
  | "chess"
  | "flag"
  | "laptop-code"
  | "list"
  | "microchip"
  | "route"
  | "shield"
  | "user";

type FinanceIconProps = {
  name: FinanceIconName;
  className?: string;
  stroke?: string;
};

const defaultStroke = redFinanceTheme.colors.primary;

export const FinanceIcon = ({
  name,
  className = "h-5 w-5",
  stroke = defaultStroke,
}: FinanceIconProps) => {
  switch (name) {
    case "bank":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M4 9.5 12 5l8 4.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 10.5v6.5M10 10.5v6.5M14 10.5v6.5M17.5 10.5v6.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4.5 19h15M3.5 8.8h17" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="4" y="6" width="16" height="14" rx="2" stroke={stroke} strokeWidth="1.8" />
          <path d="M8 4v4M16 4v4M4 10h16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "book-open":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M4.5 5.5h5.2c1.3 0 2.3 1 2.3 2.3v10.7c0-1.3-1-2.3-2.3-2.3H4.5V5.5Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M19.5 5.5h-5.2c-1.3 0-2.3 1-2.3 2.3v10.7c0-1.3 1-2.3 2.3-2.3h5.2V5.5Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "list":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M9 7h11M9 12h11M9 17h11" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
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
    case "chart-line":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M4 19h16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="m5 15 4-4 3 3 6-7" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 7h2.8v2.8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "laptop-code":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="5" y="5" width="14" height="10" rx="1.8" stroke={stroke} strokeWidth="1.8" />
          <path d="M3.5 18.5h17M10 8.5l-2 1.8 2 1.8M14 8.5l2 1.8-2 1.8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "microchip":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="7" y="7" width="10" height="10" rx="2" stroke={stroke} strokeWidth="1.8" />
          <path d="M10 3.8v3.2M14 3.8v3.2M10 17v3.2M14 17v3.2M3.8 10h3.2M3.8 14h3.2M17 10h3.2M17 14h3.2" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10.2 10.2h3.6v3.6h-3.6z" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case "chess":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M8 19h8M9 16h6M10 9.5 8.5 6.8 12 4l3.5 2.8-1.5 2.7" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 16c.7-2.8 1-4.3.2-6.5h4.6c-.8 2.2-.5 3.7.2 6.5" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "route":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M6.5 7.5h5c2.8 0 2.8 4 0 4h-2c-2.8 0-2.8 4 0 4h8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="5" cy="7.5" r="2" stroke={stroke} strokeWidth="1.8" />
          <circle cx="19" cy="15.5" r="2" stroke={stroke} strokeWidth="1.8" />
        </svg>
      );
    case "flag":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M6 20V5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 5.5h9.5l-1.4 3 1.4 3H7" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M6 20h8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "user":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="12" cy="8" r="3.2" stroke={stroke} strokeWidth="1.8" />
          <path d="M6.5 19c.9-3 3.15-4.5 5.5-4.5s4.6 1.5 5.5 4.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M12 4 18 6.4V11c0 4.1-2.25 7-6 9-3.75-2-6-4.9-6-9V6.4L12 4Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m9.5 12 1.7 1.7 3.6-3.9" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
};
