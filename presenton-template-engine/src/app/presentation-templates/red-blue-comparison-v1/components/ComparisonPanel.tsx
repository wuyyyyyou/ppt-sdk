import React, { type ReactNode } from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

export type ComparisonPanelSection = {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  tone?: RedBlueTone;
};

type ComparisonPanelProps = {
  heading?: ReactNode;
  sections: ComparisonPanelSection[];
  tone?: RedBlueTone;
  headerIcon?: ReactNode;
  density?: "normal" | "compact";
  sectionLayout?: "natural" | "fill";
  className?: string;
};

const ComparisonPanel = ({
  heading,
  sections,
  tone = "purple",
  headerIcon,
  density = "normal",
  sectionLayout = "natural",
  className,
}: ComparisonPanelProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];
  const isCompact = density === "compact";
  const shouldFill = sectionLayout === "fill";

  return (
    <div
      className={["flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderColor: toneValue.border,
        backgroundColor: redBlueComparisonTheme.colors.card,
        boxShadow: redBlueComparisonTheme.shadow.card,
      }}
    >
      {heading ? (
        <div
          className="flex flex-none items-center gap-[10px] px-[16px]"
          style={{
            height: isCompact ? 40 : 46,
            color: redBlueComparisonTheme.colors.primaryText,
            backgroundColor: toneValue.color,
          }}
        >
          {headerIcon ? <div className="flex h-[20px] w-[20px] flex-none items-center justify-center">{headerIcon}</div> : null}
          <div className="min-w-0 truncate text-[15px] font-black">{heading}</div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col p-[16px]">
        {sections.map((section, index) => {
          const sectionTone = redBlueComparisonTheme.tone[section.tone ?? tone];
          return (
            <React.Fragment key={index}>
              <div
                className="flex min-h-0 gap-[12px]"
                style={{
                  flex: shouldFill ? "1 1 0" : undefined,
                  alignItems: shouldFill ? "center" : "flex-start",
                }}
              >
                {section.badge ? (
                  <div
                    className="mt-[2px] flex h-[22px] min-w-[28px] flex-none items-center justify-center rounded-[5px] px-[7px] text-[11px] font-black leading-none"
                    style={{ color: sectionTone.color, backgroundColor: sectionTone.tint }}
                  >
                    {section.badge}
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="overflow-hidden text-[15px] font-black leading-[1.25]" style={{ maxHeight: 38, color: redBlueComparisonTheme.colors.backgroundText }}>
                    {section.title}
                  </div>
                  {section.description ? (
                    <div className="mt-[5px] overflow-hidden text-[12px] font-medium leading-[1.42]" style={{ maxHeight: 36, color: redBlueComparisonTheme.colors.mutedText }}>
                      {section.description}
                    </div>
                  ) : null}
                </div>
              </div>
              {index < sections.length - 1 ? (
                <div className="my-[12px] h-px flex-none" style={{ backgroundColor: redBlueComparisonTheme.colors.stroke }} />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ComparisonPanel;
