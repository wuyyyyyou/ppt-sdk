import React from "react";

import { redBlueTheme } from "../theme/tokens.ts";

type RedBlueCoverBackdropProps = {
  variant?: "comparison" | "section" | "thank-you";
};

const RedBlueCoverBackdrop = ({ variant = "comparison" }: RedBlueCoverBackdropProps) => {
  const quiet = variant === "thank-you";
  return (
    <>
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(#DFE6E9 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: quiet ? 0.16 : 0.3,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: variant === "section" ? 320 : 400,
          height: variant === "section" ? 320 : 400,
          left: -100,
          top: -100,
          backgroundColor: quiet ? "rgba(80,56,166,0.05)" : redBlueTheme.colors.redTint,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: variant === "section" ? 380 : 450,
          height: variant === "section" ? 380 : 450,
          right: -120,
          bottom: -150,
          backgroundColor: quiet ? "rgba(80,56,166,0.08)" : redBlueTheme.colors.blueTint,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 600,
          height: 600,
          left: 340,
          top: 60,
          border: "2px solid rgba(200,200,200,0.22)",
        }}
      />
    </>
  );
};

export default RedBlueCoverBackdrop;
