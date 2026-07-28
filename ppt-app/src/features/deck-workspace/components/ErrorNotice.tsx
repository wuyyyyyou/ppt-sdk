import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import type { Messages } from "../../../i18n/messages";

interface ErrorNoticeProps {
  t: Messages;
  summary: string;
  detail?: string;
  tone?: "inline" | "block";
  actions?: ReactNode;
}

/**
 * Shows a readable summary of a backend failure and keeps the raw transport
 * message behind a disclosure, so support can still read it without exposing
 * RPC envelopes by default.
 */
export function ErrorNotice({ t, summary, detail, tone = "inline", actions }: ErrorNoticeProps) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();

  return (
    <div className={`error-notice ${tone}`} role="alert">
      <span className="error-notice-icon" aria-hidden="true"><AlertTriangle size={16} /></span>
      <div className="error-notice-body">
        <p className="error-notice-summary">{summary}</p>
        {detail ? (
          <>
            <button
              type="button"
              className="error-notice-toggle"
              aria-expanded={expanded}
              aria-controls={detailId}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? t.errors.hideDetails : t.errors.showDetails}
              {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            </button>
            {expanded ? (
              <pre className="error-notice-detail" id={detailId} aria-label={t.errors.detailsLabel}>
                {detail}
              </pre>
            ) : null}
          </>
        ) : null}
      </div>
      {actions ? <div className="error-notice-actions">{actions}</div> : null}
    </div>
  );
}
