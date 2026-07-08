import React from "react";

import { redBlueComparisonTheme } from "../theme/tokens.ts";

type ComparisonHeroTitleProps = {
  leftTitle: string;
  connector: string;
  rightTitle: string;
  width?: number;
  height?: number;
  fontSize?: number;
  connectorColor?: string;
  separatorColor?: string;
  separatorWidth?: number;
  separatorHeight?: number;
};

const ComparisonHeroTitle = ({
  leftTitle,
  connector,
  rightTitle,
  width = 900,
  height = 104,
  fontSize = 88,
  connectorColor = redBlueComparisonTheme.colors.comparison,
  separatorColor = redBlueComparisonTheme.colors.comparison,
  separatorWidth = 86,
  separatorHeight = 6,
}: ComparisonHeroTitleProps) => {
  return (
    <div className="flex flex-col items-center" style={{ width }}>
      <div
        className="flex items-center justify-center whitespace-nowrap font-black leading-none"
        style={{
          width,
          height,
          fontSize,
          color: redBlueComparisonTheme.colors.textPrimary,
          fontFamily: redBlueComparisonTheme.fonts.heading,
        }}
      >
        <div className="flex h-full flex-none items-center justify-center leading-none">
          {leftTitle}
        </div>
        <div
          className="flex h-full flex-none items-center justify-center px-[24px] leading-none"
          style={{ color: connectorColor }}
        >
          {connector}
        </div>
        <div className="flex h-full flex-none items-center justify-center leading-none">
          {rightTitle}
        </div>
      </div>

      <div
        className="mt-[28px] rounded-full"
        style={{
          width: separatorWidth,
          height: separatorHeight,
          backgroundColor: separatorColor,
        }}
      />
    </div>
  );
};

export default ComparisonHeroTitle;
