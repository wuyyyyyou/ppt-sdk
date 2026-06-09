import React from "react";

import { redBlueTheme } from "../theme/tokens.ts";

type RedBlueSectionHeadingProps = {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
};

const RedBlueSectionHeading = ({
  title,
  subtitle,
  align = "left",
}: RedBlueSectionHeadingProps) => {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <div
        className="text-[42px] font-black leading-[50px]"
        style={{
          color: redBlueTheme.colors.backgroundText,
          fontFamily: redBlueTheme.fonts.heading,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          className="mt-[6px] text-[16px] font-semibold"
          style={{ color: redBlueTheme.colors.mutedText }}
        >
          {subtitle}
        </div>
      ) : null}
      <div
        className={align === "center" ? "mx-auto mt-[18px] h-[6px] w-[80px] rounded-full" : "mt-[16px] h-[5px] w-[88px] rounded-full"}
        style={{ backgroundColor: redBlueTheme.colors.purple }}
      />
    </div>
  );
};

export default RedBlueSectionHeading;
