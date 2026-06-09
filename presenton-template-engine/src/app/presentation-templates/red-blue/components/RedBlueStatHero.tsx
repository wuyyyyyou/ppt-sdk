import React from "react";

import { redBlueTheme } from "../theme/tokens.ts";

type RedBlueStatHeroProps = {
  statistic: string;
  subtitle?: string;
  description?: string;
};

const RedBlueStatHero = ({ statistic, subtitle, description }: RedBlueStatHeroProps) => {
  return (
    <div className="relative flex h-full w-full items-center justify-center text-center">
      <div
        className="absolute h-[560px] w-[560px] rounded-full"
        style={{ border: `2px solid ${redBlueTheme.colors.purpleSoft}` }}
      />
      <div
        className="absolute h-[390px] w-[390px] rounded-full"
        style={{ backgroundColor: redBlueTheme.colors.purpleTint }}
      />
      <div className="relative z-10 max-w-[820px]">
        <div
          className="text-[112px] font-black leading-none"
          style={{ color: redBlueTheme.colors.purple, fontFamily: redBlueTheme.fonts.heading }}
        >
          {statistic}
        </div>
        {subtitle ? (
          <div className="mt-[24px] text-[30px] font-black" style={{ color: redBlueTheme.colors.backgroundText }}>
            {subtitle}
          </div>
        ) : null}
        {description ? (
          <div className="mx-auto mt-[18px] max-w-[680px] text-[20px] font-medium leading-[30px]" style={{ color: redBlueTheme.colors.mutedText }}>
            {description}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default RedBlueStatHero;
