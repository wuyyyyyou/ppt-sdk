import React, { type ReactNode } from "react";

export interface NarrativeListItemProps {
  icon?: ReactNode;
  title: string;
  description: string;
  aside?: ReactNode;
  showDivider?: boolean;
}

export default function NarrativeListItem({
  icon,
  title,
  description,
  aside,
  showDivider = true,
}: NarrativeListItemProps) {
  return (
    <div style={{ position: "relative", display: "flex", gap: 16, minHeight: 78, paddingBottom: 14 }}>
      <span style={{ display: "flex", width: 42, height: 42, flex: "0 0 auto", alignItems: "center", justifyContent: "center", borderRadius: 999, color: "#2563eb", background: "#eff6ff" }}>
        {icon}
      </span>
      <div style={{ position: "relative", minWidth: 0, flex: 1, paddingRight: aside ? 84 : 0 }}>
        <div style={{ marginBottom: 5, fontSize: 18, fontWeight: 700, color: "#172033" }}>{title}</div>
        <div data-validation-role="multi-line-body-text" style={{ maxHeight: 44, overflow: "hidden", fontSize: 14, lineHeight: "22px", color: "#475569" }}>
          {description}
        </div>
        {aside ? <div style={{ position: "absolute", right: 0, top: 0 }}>{aside}</div> : null}
      </div>
      {showDivider ? (
        <span style={{ position: "absolute", right: 0, bottom: 0, left: 58, height: 1, background: "#e2e8f0" }} />
      ) : null}
    </div>
  );
}
