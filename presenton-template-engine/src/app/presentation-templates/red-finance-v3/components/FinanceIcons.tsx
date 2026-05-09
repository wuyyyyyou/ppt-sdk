import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";

export type FinanceIconName =
  | "bank"
  | "bolt"
  | "book-open"
  | "brain"
  | "calendar"
  | "chart-column"
  | "chart-line"
  | "chart-pie"
  | "chess"
  | "clock"
  | "briefcase"
  | "compass"
  | "coins"
  | "database"
  | "document"
  | "gavel"
  | "grid"
  | "flag"
  | "globe"
  | "health"
  | "leaf"
  | "lightbulb"
  | "laptop-code"
  | "list"
  | "microchip"
  | "network"
  | "architecture"
  | "regtech"
  | "robot"
  | "route"
  | "security"
  | "shield"
  | "shuffle"
  | "smartphone"
  | "user"
  | "user-plus"
  | "users"
  | "wallet";

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
    case "bolt":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path
            d="M13.5 3 6.8 12h4.4L10.5 21l6.7-9h-4.4L13.5 3Z"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="4" y="6" width="16" height="14" rx="2" stroke={stroke} strokeWidth="1.8" />
          <path d="M8 4v4M16 4v4M4 10h16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="12" cy="12" r="7.4" stroke={stroke} strokeWidth="1.8" />
          <path d="M12 7.4v4.8l3 1.8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "book-open":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M4.5 5.5h5.2c1.3 0 2.3 1 2.3 2.3v10.7c0-1.3-1-2.3-2.3-2.3H4.5V5.5Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M19.5 5.5h-5.2c-1.3 0-2.3 1-2.3 2.3v10.7c0-1.3 1-2.3 2.3-2.3h5.2V5.5Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M5 8.5h12.5A2.5 2.5 0 0 1 20 11v6A2.5 2.5 0 0 1 17.5 19H6.5A2.5 2.5 0 0 1 4 16.5v-8A2.5 2.5 0 0 1 6.5 6H17" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15.5 13.2h4.5v3.6h-4.5a1.8 1.8 0 1 1 0-3.6Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M16.9 15h.01" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "brain":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M9.2 6.3a3 3 0 0 1 5.6 1.5 2.7 2.7 0 0 1 2.6 2.8 2.7 2.7 0 0 1-.9 2 2.8 2.8 0 0 1 .4 1.5 3 3 0 0 1-3 3H10a3.2 3.2 0 0 1-3.2-3.2 3 3 0 0 1 .5-1.7 2.7 2.7 0 0 1-.8-1.9 2.7 2.7 0 0 1 2.7-2.7Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M10.8 8.8v6.8M13.4 9.6v5.2M10.8 12h2.6M13.4 11.2h2.2" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
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
    case "chart-column":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M4.5 19h15" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <rect x="6" y="11.5" width="2.6" height="5" rx="0.8" fill={stroke} stroke="none" />
          <rect x="10.7" y="8.5" width="2.6" height="8" rx="0.8" fill={stroke} stroke="none" />
          <rect x="15.4" y="5.5" width="2.6" height="11" rx="0.8" fill={stroke} stroke="none" />
        </svg>
      );
    case "coins":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <ellipse cx="12" cy="7" rx="5.5" ry="2.8" stroke={stroke} strokeWidth="1.8" />
          <path d="M6.5 7v4.4C6.5 13 9 14.2 12 14.2s5.5-1.2 5.5-2.8V7" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 13.4v3.1c0 1.2 1.8 2.2 4 2.2s4-1 4-2.2v-3.1" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "briefcase":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="4" y="8" width="16" height="11" rx="2" stroke={stroke} strokeWidth="1.8" />
          <path d="M9 8V6.4A1.4 1.4 0 0 1 10.4 5h3.2A1.4 1.4 0 0 1 15 6.4V8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4 12h16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "compass":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.8" />
          <path d="m9.2 14.8 1.8-5.4 5.4-1.8-1.8 5.4-5.4 1.8Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "lightbulb":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M9.2 16.4h5.6M10 19h4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 10.2a4 4 0 1 1 8 0c0 1.4-.58 2.12-1.5 3.2-.68.8-1.14 1.65-1.3 2.5h-2.4c-.16-.85-.62-1.7-1.3-2.5-.92-1.08-1.5-1.8-1.5-3.2Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "database":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <ellipse cx="12" cy="6.8" rx="5.8" ry="2.8" stroke={stroke} strokeWidth="1.8" />
          <path d="M6.2 6.8v4.5c0 1.55 2.6 2.8 5.8 2.8s5.8-1.25 5.8-2.8V6.8M6.2 11.3v4.5c0 1.55 2.6 2.8 5.8 2.8s5.8-1.25 5.8-2.8v-4.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "document":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M8 4.8h6.7l3.3 3.3V19H8z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14.7 4.8v3.4H18M10.2 11.2h5.6M10.2 14.3h5.6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "gavel":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="m8 7.3 3.2 3.2M6.2 9.1l3.2 3.2M13.4 5.5l3.4 3.4M10 8.9l5.1-5.1M8.2 11.8l-3 3M12.4 16h7.4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "grid":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="4.5" y="4.5" width="6.2" height="6.2" rx="1.2" stroke={stroke} strokeWidth="1.8" />
          <rect x="13.3" y="4.5" width="6.2" height="6.2" rx="1.2" stroke={stroke} strokeWidth="1.8" />
          <rect x="4.5" y="13.3" width="6.2" height="6.2" rx="1.2" stroke={stroke} strokeWidth="1.8" />
          <rect x="13.3" y="13.3" width="6.2" height="6.2" rx="1.2" stroke={stroke} strokeWidth="1.8" />
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
    case "smartphone":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="7" y="4.5" width="10" height="15" rx="2.4" stroke={stroke} strokeWidth="1.8" />
          <path d="M10 7.5h4M10 16.5h4M12 14.5h.01" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
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
    case "shuffle":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M5 7.5h4c1.8 0 2.8.8 4 2.4l2 2.7c1.2 1.6 2.2 2.4 4 2.4h.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M17 5.5h2.5V8M17 18.5h2.5V16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 16.5h4c1.8 0 2.8-.8 4-2.4l2-2.7c1.2-1.6 2.2-2.4 4-2.4h.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
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
    case "robot":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="6" y="8" width="12" height="9" rx="2.4" stroke={stroke} strokeWidth="1.8" />
          <path d="M12 4.5v2.5M9.5 12h.01M14.5 12h.01M9 15.2h6M4.8 10.5v4M19.2 10.5v4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "network":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="6" cy="12" r="2" stroke={stroke} strokeWidth="1.8" />
          <circle cx="18" cy="7" r="2" stroke={stroke} strokeWidth="1.8" />
          <circle cx="18" cy="17" r="2" stroke={stroke} strokeWidth="1.8" />
          <path d="M8 11.2 16 7.8M8 12.8 16 16.2" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "architecture":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="4.5" y="5" width="6.5" height="4.8" rx="1.2" stroke={stroke} strokeWidth="1.8" />
          <rect x="13" y="5" width="6.5" height="4.8" rx="1.2" stroke={stroke} strokeWidth="1.8" />
          <rect x="8.8" y="14.2" width="6.5" height="4.8" rx="1.2" stroke={stroke} strokeWidth="1.8" />
          <path d="M7.8 9.8v2.3h8.4V9.8M12 12.1v2.1" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "regtech":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M8 4.8h6.6l3.4 3.5v9.9A1.8 1.8 0 0 1 16.2 20H8a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14.6 4.8v3.8h3.4M9 12.2h6M9 15.4h4.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m10.2 9.2 1.2 1.2 2.5-2.6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "leaf":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M18 5c-5.8.5-9.8 4.2-10.5 9.5 3.6.3 6.2-.7 8.1-2.7C17.7 9.8 18.2 7.5 18 5Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 18c1.1-2.8 3.4-4.9 6.8-6.6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.8" />
          <path d="M4.5 12h15M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "health":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M12 5.2v13.6M5.2 12h13.6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="12" r="7.2" stroke={stroke} strokeWidth="1.8" />
        </svg>
      );
    case "user":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="12" cy="8" r="3.2" stroke={stroke} strokeWidth="1.8" />
          <path d="M6.5 19c.9-3 3.15-4.5 5.5-4.5s4.6 1.5 5.5 4.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "user-plus":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="10" cy="8" r="3" stroke={stroke} strokeWidth="1.8" />
          <path d="M4.8 18c.9-2.8 2.9-4.3 5.2-4.3 2.3 0 4.3 1.5 5.2 4.3" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M18 7h2M19 6v2" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="8" cy="9" r="2.2" stroke={stroke} strokeWidth="1.8" />
          <circle cx="16" cy="9" r="2.2" stroke={stroke} strokeWidth="1.8" />
          <path d="M4.8 18c.8-2.4 2.3-3.7 4.4-3.7 2.1 0 3.6 1.3 4.4 3.7M10.4 18c.8-2.4 2.3-3.7 4.4-3.7 2.1 0 3.6 1.3 4.4 3.7" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M12 4 18 6.4V11c0 4.1-2.25 7-6 9-3.75-2-6-4.9-6-9V6.4L12 4Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m9.5 12 1.7 1.7 3.6-3.9" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "security":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <path d="M12 4 18 6.3v4.9c0 4-2.2 6.8-6 8.8-3.8-2-6-4.8-6-8.8V6.3L12 4Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 10.4a1.8 1.8 0 0 1 1.8 1.8v2.8h-3.6v-2.8a1.8 1.8 0 0 1 1.8-1.8Zm0 0V9.1a1.8 1.8 0 1 1 3.6 0v1.3" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
};
