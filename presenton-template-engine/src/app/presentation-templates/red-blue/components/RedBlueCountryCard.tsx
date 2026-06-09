import React, { type ReactNode } from "react";

import { getToneColor, type RedBlueTone, redBlueTheme } from "../theme/tokens.ts";

type KpiItem = {
  label: string;
  value: string;
  icon?: ReactNode;
};

type RedBlueCountryCardProps = {
  name: string;
  heroValue: string;
  heroLabel: string;
  kpis: KpiItem[];
  tone: RedBlueTone;
};

const RedBlueCountryCard = ({
  name,
  heroValue,
  heroLabel,
  kpis,
  tone,
}: RedBlueCountryCardProps) => {
  const color = getToneColor(tone);
  return (
    <div
      className="overflow-hidden rounded-[20px] bg-white"
      style={{ boxShadow: `0 10px 30px ${redBlueTheme.colors.shadow}` }}
    >
      <div className="h-[10px]" style={{ backgroundColor: color }} />
      <div className="p-[26px]">
        <div className="flex items-center justify-between">
          <div className="text-[26px] font-black" style={{ color, fontFamily: redBlueTheme.fonts.heading }}>
            {name}
          </div>
          <div className="h-[16px] w-[16px] rounded-full" style={{ backgroundColor: color }} />
        </div>
        <div className="mt-[20px] rounded-[16px] p-[20px] text-center" style={{ backgroundColor: `${color}12` }}>
          <div className="text-[48px] font-black leading-none" style={{ color, fontFamily: redBlueTheme.fonts.heading }}>
            {heroValue}
          </div>
          <div className="mt-[8px] text-[13px] font-extrabold uppercase tracking-[0.5px]" style={{ color }}>
            {heroLabel}
          </div>
        </div>
        <div className="mt-[20px] grid gap-[12px]">
          {kpis.map((item) => (
            <div key={item.label} className="flex items-center gap-[12px]">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ backgroundColor: `${color}14`, color }}>
                {item.icon ?? "•"}
              </div>
              <div className="flex-1">
                <div className="text-[16px] font-black" style={{ color: redBlueTheme.colors.backgroundText }}>
                  {item.value}
                </div>
                <div className="text-[12px] font-semibold" style={{ color: redBlueTheme.colors.mutedText }}>
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RedBlueCountryCard;
