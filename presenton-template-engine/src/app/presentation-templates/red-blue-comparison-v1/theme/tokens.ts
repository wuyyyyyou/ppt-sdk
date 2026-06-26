export const redBlueComparisonTheme = {
  colors: {
    background: "var(--background-color,#FFFFFF)",
    backgroundText: "var(--background-text,#2D3436)",
    mutedText: "var(--text-muted,#636E72)",
    subtleText: "var(--text-subtle,#7F8C8D)",
    primary: "var(--primary-color,#5038A6)",
    primaryText: "var(--primary-text,#FFFFFF)",
    purpleSoft: "var(--purple-soft,#DDD8F7)",
    purpleTint: "var(--purple-tint,#F5F3FF)",
    card: "var(--card-color,#FFFFFF)",
    stroke: "var(--stroke,#E9E7F6)",
    shadowSoft: "var(--shadow-soft,rgba(45,52,54,0.08))",
    chinaRed: "var(--china-red,#FF4757)",
    japanBlue: "var(--japan-blue,#2E86DE)",
    koreaRed: "var(--korea-red,#EF3340)",
    redTint: "var(--red-tint,#FFF1F3)",
    blueTint: "var(--blue-tint,#EFF6FF)",
  },
  fonts: {
    heading: 'var(--heading-font-family,Montserrat,"Noto Sans SC",sans-serif)',
    body: 'var(--body-font-family,Inter,"Noto Sans SC",sans-serif)',
  },
} as const;
