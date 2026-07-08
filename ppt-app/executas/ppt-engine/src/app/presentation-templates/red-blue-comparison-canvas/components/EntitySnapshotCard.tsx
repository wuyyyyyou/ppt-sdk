import React from "react";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";
import CardAccentRail from "./CardAccentRail.tsx";

export type EntitySnapshotIconName =
  | "flag"
  | "circle"
  | "hourglass"
  | "city"
  | "building"
  | "heart"
  | "trend-down"
  | "trend-up"
  | "users"
  | "globe";

export type EntitySnapshotKpi = {
  label: string;
  value: string;
  icon: EntitySnapshotIconName;
};

export type EntitySnapshotHero = {
  label: string;
  value: string;
  statusLabel?: string;
  statusIcon?: EntitySnapshotIconName;
  statusTone?: ComparisonTone | "warning" | "success";
};

type EntitySnapshotCardProps = {
  entityName: string;
  tone: ComparisonTone;
  entityIcon?: EntitySnapshotIconName;
  hero: EntitySnapshotHero;
  kpis: EntitySnapshotKpi[];
};

const iconPath = {
  flag: (
    <>
      <path d="M5 20V4" />
      <path d="M5 5h12l-2 4 2 4H5" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="7" />,
  hourglass: (
    <>
      <path d="M7 4h10" />
      <path d="M7 20h10" />
      <path d="M8 4c0 5 8 5 8 10s-8 5-8 10" />
      <path d="M16 4c0 5-8 5-8 10s8 5 8 10" />
    </>
  ),
  city: (
    <>
      <path d="M4 20h16" />
      <path d="M6 20V8h6v12" />
      <path d="M14 20V4h4v16" />
      <path d="M8 11h2" />
      <path d="M8 15h2" />
      <path d="M15.5 8h1" />
      <path d="M15.5 12h1" />
    </>
  ),
  building: (
    <>
      <path d="M5 20V5h14v15" />
      <path d="M9 20v-5h6v5" />
      <path d="M8 8h2" />
      <path d="M14 8h2" />
      <path d="M8 12h2" />
      <path d="M14 12h2" />
    </>
  ),
  heart: (
    <path d="M20 8.5c0 5.2-8 9.5-8 9.5s-8-4.3-8-9.5A4.5 4.5 0 0 1 12 5a4.5 4.5 0 0 1 8 3.5Z" />
  ),
  "trend-down": (
    <>
      <path d="m4 7 6 6 4-4 6 6" />
      <path d="M20 10v5h-5" />
    </>
  ),
  "trend-up": (
    <>
      <path d="m4 17 6-6 4 4 6-6" />
      <path d="M15 9h5v5" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-2a4 4 0 0 0-8 0v2" />
      <circle cx="12" cy="8" r="4" />
      <path d="M22 20v-2a4 4 0 0 0-3-3.8" />
      <path d="M16 4.2a4 4 0 0 1 0 7.6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </>
  ),
} satisfies Record<EntitySnapshotIconName, React.ReactNode>;

const toneColor = (tone: ComparisonTone | "warning" | "success") => {
  if (tone === "warning") {
    return redBlueComparisonTheme.colors.statusWarning;
  }
  if (tone === "success") {
    return redBlueComparisonTheme.colors.statusSuccess;
  }
  return redBlueComparisonTheme.tone[tone].color;
};

const EntitySnapshotIcon = ({
  name,
  size = 20,
}: {
  name: EntitySnapshotIconName;
  size?: number;
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
  >
    {iconPath[name]}
  </svg>
);

const EntitySnapshotCard = ({
  entityName,
  tone,
  entityIcon = "circle",
  hero,
  kpis,
}: EntitySnapshotCardProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];
  const statusTone = hero.statusTone ?? "warning";
  const statusColor = toneColor(statusTone);

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden border px-[30px] pb-[28px] pt-[30px]"
      style={{
        borderRadius: 20,
        backgroundColor: redBlueComparisonTheme.colors.card,
        borderColor: redBlueComparisonTheme.colors.neutralBorder,
        boxShadow: redBlueComparisonTheme.shadow.panel,
      }}
    >
      <CardAccentRail position="top" color={toneValue.color} size={8} />

      <div className="relative z-10 mb-[24px] flex h-[34px] flex-none items-center gap-[12px]">
        <div className="flex h-[26px] w-[26px] flex-none items-center justify-center" style={{ color: toneValue.color }}>
          <EntitySnapshotIcon name={entityIcon} size={24} />
        </div>
        <div
          className="min-w-0 break-words text-[28px] font-black uppercase leading-none"
          style={{ color: toneValue.color, fontFamily: redBlueComparisonTheme.fonts.heading }}
        >
          {entityName}
        </div>
      </div>

      <div
        className="relative z-10 mb-[24px] flex h-[126px] flex-none items-center justify-between gap-[18px] rounded-[16px] px-[20px]"
        style={{ backgroundColor: redBlueComparisonTheme.colors.neutralTint }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="mb-[7px] break-words text-[14px] font-black uppercase leading-none"
            style={{ color: redBlueComparisonTheme.colors.textMuted }}
          >
            {hero.label}
          </div>
          <div
            className="break-words text-[48px] font-black leading-none"
            style={{ color: toneValue.color, fontFamily: redBlueComparisonTheme.fonts.heading }}
          >
            {hero.value}
          </div>
        </div>
        {hero.statusLabel ? (
          <div className="flex w-[112px] flex-none flex-col items-end justify-center text-right">
            <div
              className="mb-[8px] max-w-full break-words text-[12px] font-black uppercase leading-none"
              style={{ color: statusColor }}
            >
              {hero.statusLabel}
            </div>
            <div className="flex h-[28px] w-[28px] items-center justify-center" style={{ color: statusColor }}>
              <EntitySnapshotIcon name={hero.statusIcon ?? "trend-down"} size={26} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-[16px]">
        {kpis.slice(0, 4).map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="flex h-[67px] flex-none items-center justify-between gap-[16px] rounded-[12px] border px-[16px]"
            style={{
              backgroundColor: redBlueComparisonTheme.colors.card,
              borderColor: redBlueComparisonTheme.colors.neutralBorder,
            }}
          >
            <div className="flex min-w-0 items-center gap-[12px]">
              <div
                className="flex h-[36px] w-[36px] flex-none items-center justify-center rounded-[8px]"
                style={{ backgroundColor: toneValue.tint, color: toneValue.color }}
              >
                <EntitySnapshotIcon name={item.icon} size={18} />
              </div>
              <div
                className="min-w-0 break-words text-[14px] font-bold leading-none"
                style={{ color: redBlueComparisonTheme.colors.textMuted }}
              >
                {item.label}
              </div>
            </div>
            <div
              className="max-w-[120px] flex-none break-words text-right text-[24px] font-black leading-none"
              style={{ color: redBlueComparisonTheme.colors.textPrimary, fontFamily: redBlueComparisonTheme.fonts.heading }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EntitySnapshotCard;
