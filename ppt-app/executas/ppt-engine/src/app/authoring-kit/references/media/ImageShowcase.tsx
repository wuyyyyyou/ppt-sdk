import React, { useEffect, useState } from "react";

export interface ImageShowcaseReferenceProps {
  url?: string;
  alt: string;
  title?: string;
  caption?: string;
  source?: string;
  fit?: "cover" | "contain";
  titleMaxLines?: number;
  captionMaxLines?: number;
  sourceMaxLines?: number;
}

function maxHeight(fontSize: number, lineHeight: number, lines: number) {
  return fontSize * lineHeight * Math.max(1, lines);
}

export default function ImageShowcaseReference({
  url,
  alt,
  title,
  caption,
  source,
  fit = "cover",
  titleMaxLines = 2,
  captionMaxLines = 2,
  sourceMaxLines = 1,
}: ImageShowcaseReferenceProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = url?.trim();
  const hasImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  useEffect(() => setFailedUrl(null), [imageUrl]);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, flexDirection: "column", overflow: "hidden", padding: 18, border: "1px solid #d7dce5", borderRadius: 12, background: "#ffffff", boxShadow: "0 4px 16px rgba(15,23,42,0.07)" }}>
      {title ? <div style={{ maxHeight: maxHeight(18, 1.25, titleMaxLines), marginBottom: 12, overflow: "hidden", fontSize: 18, lineHeight: 1.25, fontWeight: 700, color: "#172033" }}>{title}</div> : null}
      <div style={{ display: "flex", minHeight: 0, flex: 1, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#f1f5f9" }}>
        {hasImage ? (
          <img src={imageUrl} alt={alt} style={{ display: "block", width: "100%", height: "100%", objectFit: fit }} onError={() => setFailedUrl(imageUrl ?? null)} />
        ) : (
          <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
            <div style={{ marginBottom: 8, fontSize: 28 }}>▧</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{imageUrl ? "图片加载失败" : "请添加图片地址"}</div>
          </div>
        )}
      </div>
      {caption ? <div data-validation-role="multi-line-body-text" style={{ maxHeight: maxHeight(13, 1.4, captionMaxLines), marginTop: 12, overflow: "hidden", fontSize: 13, lineHeight: 1.4, color: "#475569" }}>{caption}</div> : null}
      {source ? <div style={{ maxHeight: maxHeight(11, 1.3, sourceMaxLines), marginTop: 7, overflow: "hidden", fontSize: 11, lineHeight: 1.3, color: "#64748b" }}>{source}</div> : null}
    </div>
  );
}
