import React, { type ReactNode } from "react";

type ChartPanelCardProps = {
  title: string;
  tag?: string;
  children: ReactNode;
};

const ChartPanelCard = ({
  title,
  tag,
  children,
}: ChartPanelCardProps) => (
  <div
    data-pptx-export="screenshot"
    data-chart-like="true"
    className="flex h-full flex-col rounded-[8px] border p-[20px]"
    style={{
      backgroundColor: "#FAFAFA",
      borderColor: "var(--stroke,#E5E7EB)",
    }}
  >
    <div className="mb-[15px] flex items-center justify-between gap-[16px]">
      <div className="flex min-w-0 items-center gap-[10px]">
        <div
          className="h-[18px] w-[3px] rounded-full"
          style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
        />
        <h3
          className="text-[16px] font-bold"
          style={{ color: "var(--background-text,#212121)" }}
        >
          {title}
        </h3>
      </div>
      {tag ? (
        <div
          className="flex-none rounded-[4px] border px-[8px] py-[2px] text-[12px]"
          style={{
            borderColor: "var(--stroke,#E5E7EB)",
            color: "#616161",
            backgroundColor: "#FFFFFF",
          }}
        >
          {tag}
        </div>
      ) : null}
    </div>

    <div className="flex flex-1 flex-col overflow-hidden" data-validation-ignore="true">
      {children}
    </div>
  </div>
);

export default ChartPanelCard;
