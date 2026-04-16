import type { JSX } from "react";

type IconProps = {
    className?: string;
    color?: string;
};

export type RedFinanceIconKey =
    | "landmark"
    | "anchor"
    | "list-ol"
    | "book-open"
    | "list"
    | "chart-pie"
    | "chart-line"
    | "laptop-code"
    | "microchip"
    | "chess"
    | "shield-alt"
    | "route"
    | "flag-checkered";

const defaultStroke = "currentColor";

export const BrandIcon = ({ className = "h-7 w-7", color = "var(--primary-color,#B71C1C)" }: IconProps) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={{ color }}>
        <path d="M4 9.5 12 5l8 4.5" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 10.5v6.5M10 10.5v6.5M14 10.5v6.5M17.5 10.5v6.5" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4.5 19h15M3.5 8.8h17" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const iconView = (children: JSX.Element | JSX.Element[], className: string, color: string) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={{ color }}>
        {children}
    </svg>
);

export const FinanceIcon = ({
    name,
    className = "h-6 w-6",
    color = "currentColor",
}: IconProps & { name: RedFinanceIconKey }) => {
    switch (name) {
        case "landmark":
            return <BrandIcon className={className} color={color} />;
        case "anchor":
            return iconView(
                <>
                    <circle cx="12" cy="5.6" r="1.9" stroke={defaultStroke} strokeWidth="1.8" />
                    <path d="M12 7.8v9.1" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8.2 11.6a4.7 4.7 0 0 0 7.6 0" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M6.5 14.2c0 2.7 2.45 4.8 5.5 4.8s5.5-2.1 5.5-4.8" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8.2 18.4V15.7M15.8 18.4V15.7" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
                </>,
                className,
                color,
            );
        case "list-ol":
            return iconView(
                <>
                    <path d="M10 7h10M10 12h10M10 17h10" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M4.2 6.3c.25-.47.7-.8 1.33-.8.84 0 1.37.53 1.37 1.27 0 .57-.3.97-.86 1.35l-1.37.95h2.3M4.8 11.2h1c.72 0 1.17.36 1.17.94 0 .7-.57 1.11-1.4 1.11-.61 0-1.1-.18-1.53-.53M4.6 16.2h2.26v2.3" stroke={defaultStroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </>,
                className,
                color,
            );
        case "book-open":
            return iconView(
                <>
                    <path d="M4.5 6.8A2.8 2.8 0 0 1 7.3 4H19v14.8H7.3a2.8 2.8 0 0 0-2.8 2.8ZM19 4H7.3a2.8 2.8 0 0 0-2.8 2.8v14" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 6.8v12" stroke={defaultStroke} strokeWidth="1.6" strokeLinecap="round" />
                </>,
                className,
                color,
            );
        case "list":
            return iconView(
                <>
                    <path d="M8.5 7h11M8.5 12h11M8.5 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
                </>,
                className,
                color,
            );
        case "chart-pie":
            return iconView(
                <>
                    <path d="M12 4v8h8A8 8 0 0 0 12 4Z" stroke={defaultStroke} strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M10.5 5.2a8 8 0 1 0 8.3 8.3H10.5Z" stroke={defaultStroke} strokeWidth="1.8" strokeLinejoin="round" />
                </>,
                className,
                color,
            );
        case "chart-line":
            return iconView(
                <>
                    <path d="M4 18h16" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="m5.5 15 4-4 3 2.5 5-6" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="m16.8 7.5 1-.1.1 1" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
                </>,
                className,
                color,
            );
        case "laptop-code":
            return iconView(
                <>
                    <rect x="4" y="5" width="16" height="11" rx="2" stroke={defaultStroke} strokeWidth="1.8" />
                    <path d="M2.8 19h18.4M10 9l-2 2 2 2M14 9l2 2-2 2" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </>,
                className,
                color,
            );
        case "microchip":
            return iconView(
                <>
                    <rect x="7" y="7" width="10" height="10" rx="1.6" stroke={defaultStroke} strokeWidth="1.8" />
                    <path d="M9.5 2.8v3M14.5 2.8v3M9.5 18.2v3M14.5 18.2v3M18.2 9.5h3M18.2 14.5h3M2.8 9.5h3M2.8 14.5h3" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M10 10h4v4h-4z" fill={defaultStroke} stroke="none" />
                </>,
                className,
                color,
            );
        case "chess":
            return iconView(
                <>
                    <path d="M9 20h6M8 17h8M9.2 9.2c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5c0 .9-.47 1.7-1.18 2.14.85.5 1.43 1.42 1.43 2.48V17h-6.6v-3.18c0-1.06.58-1.98 1.43-2.48A2.5 2.5 0 0 1 9.2 9.2Z" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M11.7 4.2h.01" stroke={defaultStroke} strokeWidth="2.2" strokeLinecap="round" />
                </>,
                className,
                color,
            );
        case "shield-alt":
            return iconView(
                <>
                    <path d="M12 4 18 6.4V11c0 4.1-2.25 7-6 9-3.75-2-6-4.9-6-9V6.4L12 4Z" stroke={defaultStroke} strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="m9.5 12 1.7 1.7 3.6-3.9" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </>,
                className,
                color,
            );
        case "route":
            return iconView(
                <>
                    <circle cx="6" cy="18" r="1.7" fill={defaultStroke} stroke="none" />
                    <circle cx="18" cy="6" r="1.7" fill={defaultStroke} stroke="none" />
                    <path d="M7.8 17.2c3.1-.9 5.8-3 6.7-5.9.62-2.03 1.86-3.25 4-4.1" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2.5 3.5" />
                    <path d="M12.3 11.4h2.5v2.5" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </>,
                className,
                color,
            );
        case "flag-checkered":
            return iconView(
                <>
                    <path d="M6 20V4" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M6 5c2-1.25 4-.75 6 .25s4 1.5 6 .25v8c-2 1.25-4 .75-6-.25s-4-1.5-6-.25Z" stroke={defaultStroke} strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M12 5.7v7.6M9 6.5v7.6M15 6.1v7.6" stroke={defaultStroke} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
                </>,
                className,
                color,
            );
        default:
            return iconView(<path d="M5 12h14" stroke={defaultStroke} strokeWidth="1.8" strokeLinecap="round" />, className, color);
    }
};
