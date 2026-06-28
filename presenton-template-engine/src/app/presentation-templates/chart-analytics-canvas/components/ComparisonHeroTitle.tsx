import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import ComparisonDivider from "./ComparisonDivider.tsx";

type ComparisonHeroTitleProps = {
  primary: string;
  secondary: string;
  dividerLabel: string;
};

const ComparisonHeroTitle = ({ primary, secondary, dividerLabel }: ComparisonHeroTitleProps) => {
  return (
    <div className="flex flex-col items-center" style={{ fontFamily: chartAnalyticsTheme.fonts.display }}>
      <div className="flex h-[112px] items-center justify-center whitespace-nowrap text-[130px] font-black leading-none tracking-normal text-white drop-shadow-2xl">
        {primary}
      </div>
      <div className="my-[17px]">
        <ComparisonDivider label={dividerLabel} />
      </div>
      <div className="flex h-[112px] items-center justify-center whitespace-nowrap text-[130px] font-black leading-none tracking-normal text-white drop-shadow-2xl">
        {secondary}
      </div>
    </div>
  );
};

export default ComparisonHeroTitle;
