import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";

type FinanceIconName = "bank" | "calendar" | "user" | "shield";

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
