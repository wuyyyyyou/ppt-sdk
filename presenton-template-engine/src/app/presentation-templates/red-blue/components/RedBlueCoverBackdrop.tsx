import React from "react";

import { redBlueTheme } from "../theme/tokens.ts";

type RedBlueCoverBackdropProps = {
  variant?: "comparison" | "section" | "section-title" | "thank-you";
};

const RedBlueCoverBackdrop = ({ variant = "comparison" }: RedBlueCoverBackdropProps) => {
  const quiet = variant === "thank-you";
  if (variant === "section-title") {
    return (
      <>
        <div
          className="absolute rounded-full"
          style={{
            width: 450,
            height: 450,
            left: -80,
            top: -120,
            backgroundColor: "rgba(80,56,166,0.05)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 300,
            height: 300,
            right: -50,
            bottom: -80,
            backgroundColor: "rgba(255,71,87,0.1)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 180,
            height: 180,
            left: 100,
            bottom: 120,
            backgroundColor: "rgba(255,71,87,0.08)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 120,
            height: 120,
            right: 150,
            top: 100,
            backgroundColor: "rgba(80,56,166,0.08)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 600,
            height: 600,
            left: 340,
            top: 60,
            border: "2px solid rgba(80,56,166,0.1)",
          }}
        />
      </>
    );
  }

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
