import React, { type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.js";
import IconText from "./IconText.js";

export type ComparisonPanelSection = {
  badge: string;
  badgeColor?: string;
  title: string;
  description: string;
};

type ComparisonPanelProps = {
  title: string;
  icon?: ReactNode;
  sections: ComparisonPanelSection[];
  headerBackgroundColor?: string;
  headerTextColor?: string;
  dividerColor?: string;
  className?: string;
  density?: "normal" | "compact";
};

const ComparisonPanel = ({
  title,
  icon,
  sections,
  headerBackgroundColor = redFinanceTheme.colors.backgroundText,
  headerTextColor = "#FFFFFF",
  dividerColor = "#EEEEEE",
  className,
  density = "normal",
}: ComparisonPanelProps) => {
  const isCompact = density === "compact";
  const headerHeight = isCompact ? 40 : 42;
  const contentPaddingX = isCompact ? 14 : 15;
  const contentPaddingY = isCompact ? 12 : 14;
  const badgeHeight = isCompact ? 15 : 16;
  const badgeWidth = isCompact ? 22 : 24;
  const titleFontSize = isCompact ? 12 : 13;
  const descriptionFontSize = 12;

  return (
    <div
      className={["flex h-full flex-col overflow-hidden rounded-[10px] border", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: "#FFFFFF",
        borderColor: redFinanceTheme.colors.stroke,
        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
      }}
    >
      <div
        className="flex flex-none items-center gap-[10px] px-[14px]"
        style={{
          height: headerHeight,
          backgroundColor: headerBackgroundColor,
          color: headerTextColor,
        }}
      >
        <IconText
          icon={icon ?? <></>}
          label={title}
          height={headerHeight}
          iconSize={18}
          gap={10}
          fontSize={14}
          fontWeight={700}
          textColor={headerTextColor}
        />
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{
          paddingLeft: contentPaddingX,
          paddingRight: contentPaddingX,
          paddingTop: contentPaddingY,
          paddingBottom: contentPaddingY,
        }}
      >
        {sections.map((section, index) => (
          <React.Fragment key={`${section.badge}-${section.title}-${index}`}>
            <div className="flex items-start gap-[10px]">
              <div
                className="mt-[3px] flex flex-none items-center justify-center rounded-[2px] text-[10px] font-bold leading-none text-white"
                style={{
                  width: badgeWidth,
                  height: badgeHeight,
                  backgroundColor:
                    section.badgeColor ?? redFinanceTheme.colors.primary,
                }}
              >
                {section.badge}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="mb-[2px] font-bold leading-[1.25]"
                  style={{
                    fontSize: titleFontSize,
                    color: redFinanceTheme.colors.backgroundText,
                  }}
                >
                  {section.title}
                </div>
                <div
                  style={{
                    fontSize: descriptionFontSize,
                    lineHeight: 1.42,
                    color: redFinanceTheme.colors.mutedText,
                  }}
                >
                  {section.description}
                </div>
              </div>
            </div>

            {index < sections.length - 1 ? (
              <div
                className="my-[12px] h-px flex-none"
                style={{ backgroundColor: dividerColor }}
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ComparisonPanel;
