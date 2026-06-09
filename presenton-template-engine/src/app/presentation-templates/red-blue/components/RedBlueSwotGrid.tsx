import React from "react";

import { redBlueTheme } from "../theme/tokens.ts";

type SwotItem = {
  title: string;
  bullets: string[];
  style: "strengths" | "weaknesses" | "opportunities" | "threats";
};

type RedBlueSwotGridProps = {
  items: SwotItem[];
};

const styleMap = {
  strengths: { color: "#2E86DE", label: "Strengths" },
  weaknesses: { color: "#FF4757", label: "Weaknesses" },
  opportunities: { color: "#20BF6B", label: "Opportunities" },
  threats: { color: "#F39C12", label: "Threats" },
};

const RedBlueSwotGrid = ({ items }: RedBlueSwotGridProps) => {
  return (
    <div className="grid h-full grid-cols-2 gap-[18px]">
      {items.map((item) => {
        const style = styleMap[item.style];
        return (
          <div
            key={item.title}
            className="relative overflow-hidden rounded-[18px] bg-white p-[24px]"
            style={{
              borderTop: `7px solid ${style.color}`,
              boxShadow: `0 8px 24px ${redBlueTheme.colors.shadow}`,
            }}
          >
            <div className="absolute right-[18px] top-[10px] text-[72px] font-black" style={{ color: style.color, opacity: 0.08 }}>
              {style.label.slice(0, 1)}
            </div>
            <div className="text-[24px] font-black" style={{ color: style.color, fontFamily: redBlueTheme.fonts.heading }}>
              {item.title}
            </div>
            <ul className="mt-[18px] grid gap-[10px]">
              {item.bullets.slice(0, 5).map((bullet) => (
                <li key={bullet} className="flex gap-[10px] text-[16px] font-semibold leading-[22px]" style={{ color: redBlueTheme.colors.backgroundText }}>
                  <span className="mt-[7px] h-[7px] w-[7px] rounded-full" style={{ backgroundColor: style.color }} />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default RedBlueSwotGrid;
