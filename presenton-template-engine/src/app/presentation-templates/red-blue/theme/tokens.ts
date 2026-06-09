export const redBlueTheme = {
  colors: {
    background: "var(--background-color,#FFFFFF)",
    backgroundText: "var(--background-text,#2D3436)",
    card: "var(--card-color,#FFFFFF)",
    panel: "var(--panel-color,#F8F9FA)",
    stroke: "var(--stroke,#E5E7EB)",
    softStroke: "var(--stroke-soft,#EEF1F5)",
    mutedText: "var(--text-muted,#636E72)",
    subtleText: "var(--text-subtle,#7F8C8D)",
    china: "var(--primary-color,#FF4757)",
    chinaText: "var(--primary-text,#FFFFFF)",
    japan: "var(--secondary-color,var(--graph-1,#2E86DE))",
    korea: "var(--graph-2,#1E5AA8)",
    koreaRed: "var(--graph-3,#E84118)",
    purple: "var(--accent-color,#5038A6)",
    purpleSoft: "var(--accent-soft,#DDD8F7)",
    purpleTint: "var(--accent-tint,rgba(80,56,166,0.08))",
    redTint: "var(--red-tint,rgba(255,71,87,0.08))",
    blueTint: "var(--blue-tint,rgba(46,134,222,0.08))",
    shadow: "var(--shadow-color,rgba(15,23,42,0.08))",
  },
  fonts: {
    body: 'var(--body-font-family,Inter),"Noto Sans SC","Microsoft YaHei","PingFang SC",Arial,sans-serif',
    heading: 'var(--heading-font-family,Montserrat),Inter,"Noto Sans SC","Microsoft YaHei","PingFang SC",Arial,sans-serif',
  },
} as const;

export type RedBlueTone = "china" | "japan" | "korea" | "purple" | "neutral";

export function getToneColor(tone: RedBlueTone = "neutral") {
  switch (tone) {
    case "china":
      return redBlueTheme.colors.china;
    case "japan":
      return redBlueTheme.colors.japan;
    case "korea":
      return redBlueTheme.colors.korea;
    case "purple":
      return redBlueTheme.colors.purple;
    default:
      return redBlueTheme.colors.mutedText;
  }
}
