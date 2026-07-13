import React, { type CSSProperties } from "react";

export function toFileUrl(absolutePath: string): string {
  if (absolutePath.startsWith("file://")) return absolutePath;
  const normalized = absolutePath.replace(/\\/g, "/");
  return encodeURI(`file://${normalized.startsWith("/") ? "" : "/"}${normalized}`);
}

type LocalImageProps = {
  absolutePath: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  fit?: "cover" | "contain";
};

const LocalImage = ({ absolutePath, alt, className, style, fit = "cover" }: LocalImageProps) => (
  <img
    src={toFileUrl(absolutePath)}
    alt={alt}
    className={className}
    style={{ display: "block", width: "100%", height: "100%", objectFit: fit, ...style }}
  />
);

export default LocalImage;
