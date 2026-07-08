import React from "react";

import { redBlueComparisonTheme } from "../theme/tokens.ts";
import IconText from "./IconText.tsx";
import StableInlineRow from "./StableInlineRow.tsx";

export type EntityLegendItem = {
  label: string;
  color?: string;
};

type EntityLegendProps = {
  items: EntityLegendItem[];
};

const defaultColors = [
  redBlueComparisonTheme.colors.sideA,
  redBlueComparisonTheme.colors.sideB,
  redBlueComparisonTheme.colors.comparison,
];

const EntityLegend = ({ items }: EntityLegendProps) => {
  return (
    <div
      className="flex items-center justify-center rounded-full px-[40px]"
      style={{
        height: 50,
        gap: 34,
        backgroundColor: redBlueComparisonTheme.alpha.surface(0.92),
        border: redBlueComparisonTheme.border.subtle,
        boxShadow: redBlueComparisonTheme.shadow.soft,
      }}
    >
      {items.map((item, index) => (
        <StableInlineRow
          key={`${item.label}-${index}`}
          height={24}
          pptxInlineComposition="icon-text"
        >
          <IconText
            icon={
              <div
                className="h-[16px] w-[16px] rounded-full"
                style={{ backgroundColor: item.color ?? defaultColors[index % defaultColors.length] }}
              />
            }
            label={item.label.toUpperCase()}
            height={24}
            iconSize={16}
            gap={12}
            fontSize={16}
            fontWeight={900}
            textColor={redBlueComparisonTheme.colors.textPrimary}
          />
        </StableInlineRow>
      ))}
    </div>
  );
};

export default EntityLegend;
