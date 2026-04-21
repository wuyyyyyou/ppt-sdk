import React from "react";
import type { ReactNode } from "react";

type AnimeCanvasProps = {
  children: ReactNode;
  background?: string;
};

const AnimeCanvas = ({
  children,
  background = "var(--background-color,#070711)",
}: AnimeCanvasProps) => {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Orbitron:wght@500;700;800&family=Oswald:wght@500;700&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden"
        style={{
          backgroundColor: background,
          color: "var(--background-text,#FFFFFF)",
          fontFamily:
            'var(--body-font-family,"Noto Sans SC","Segoe UI",sans-serif)',
        }}
      >
        {children}
      </div>
    </>
  );
};

export default AnimeCanvas;
