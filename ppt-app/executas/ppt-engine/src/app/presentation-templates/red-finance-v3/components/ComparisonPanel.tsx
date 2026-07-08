import React, { type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.ts";
import IconText from "./IconText.tsx";

export type ComparisonPanelSection = {
  badge: string;
  badgeColor?: string;
  title: string;
  description: string;
};

type ComparisonPanelProps = {
  title?: string;
  icon?: ReactNode;
  sections: ComparisonPanelSection[];
  headerBackgroundColor?: string;
  headerTextColor?: string;
  dividerColor?: string;
  className?: string;
  density?: "normal" | "compact";
  sectionLayout?: "natural" | "fill";
};

const ComparisonPanel = ({
  title,
  icon,
  sections,
  headerBackgroundColor = redFinanceTheme.colors.panel,
  headerTextColor = redFinanceTheme.colors.textPrimary,
  dividerColor = redFinanceTheme.colors.stroke,
  className,
  density = "normal",
  sectionLayout = "natural",
}: ComparisonPanelProps) => {
  const isCompact = density === "compact";
  const shouldFillSections = sectionLayout === "fill";
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
        backgroundColor: redFinanceTheme.colors.surface,
        borderColor: redFinanceTheme.colors.stroke,
        boxShadow: redFinanceTheme.shadows.card,
      }}
    >
      {title ? (
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
      ) : null}

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
            <div
              className="flex gap-[10px]"
              style={{
                flex: shouldFillSections ? "1 1 0" : undefined,
                minHeight: shouldFillSections ? 0 : undefined,
                alignItems: shouldFillSections ? "center" : "flex-start",
              }}
            >
              <div
                className="mt-[3px] flex flex-none items-center justify-center rounded-[2px] text-[10px] font-bold leading-none"
                style={{
                  width: badgeWidth,
                  height: badgeHeight,
                  color: redFinanceTheme.colors.accentText,
                  backgroundColor:
                    section.badgeColor ?? redFinanceTheme.colors.accent,
                }}
              >
                {section.badge}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="mb-[2px] font-bold leading-[1.25]"
                  style={{
                    fontSize: titleFontSize,
                    color: redFinanceTheme.colors.textPrimary,
                  }}
                >
                  {section.title}
                </div>
                <div
                  style={{
                    fontSize: descriptionFontSize,
                    lineHeight: 1.42,
                    color: redFinanceTheme.colors.textMuted,
                  }}
                >
                  {section.description}
                </div>
              </div>
            </div>

            {index < sections.length - 1 ? (
              <div
                className="h-px flex-none"
                style={{
                  marginTop: shouldFillSections ? 0 : 12,
                  marginBottom: shouldFillSections ? 0 : 12,
                  backgroundColor: dividerColor,
                }}
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ComparisonPanel;
