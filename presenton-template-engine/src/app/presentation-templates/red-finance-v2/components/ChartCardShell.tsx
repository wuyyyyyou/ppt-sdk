import React, { type ReactNode } from "react";

type ChartCardShellProps = {
  title: string;
  subtitle?: string;
  rightMeta?: string;
  children: ReactNode;
  className?: string;
};

const ChartCardShell = ({
  title,
  subtitle,
  rightMeta,
  children,
  className,
}: ChartCardShellProps) => (
  <div
    data-pptx-export="screenshot"
    data-chart-like="true"
    className={`flex h-full flex-col rounded-[8px] border bg-[#FAFAFA] p-[20px] ${className ?? ""}`.trim()}
    style={{
      borderColor: "var(--stroke,#E5E7EB)",
      boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
    }}
  >
    <div className="mb-[15px] flex items-start justify-between gap-[16px]">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-[10px]">
          <div
            className="h-[18px] w-[3px] rounded-full"
            style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
          />
          <h3
            className="min-w-0 truncate text-[16px] font-bold"
            style={{ color: "var(--background-text,#212121)" }}
          >
            {title}
          </h3>
        </div>
        {subtitle ? (
          <div
            className="mt-[6px] pl-[13px] text-[12px]"
            style={{ color: "var(--text-muted,#616161)" }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {rightMeta ? (
        <div
          className="flex-none rounded-[4px] border px-[8px] py-[2px] text-[12px]"
          style={{
            borderColor: "var(--stroke,#E5E7EB)",
            color: "#616161",
            backgroundColor: "#FFFFFF",
          }}
        >
          {rightMeta}
        </div>
      ) : null}
    </div>

    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      data-validation-ignore="true"
    >
      {children}
    </div>
  </div>
);

export default ChartCardShell;
