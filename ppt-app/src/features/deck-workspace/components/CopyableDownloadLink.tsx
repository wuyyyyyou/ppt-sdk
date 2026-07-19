import { Check, ClipboardCopy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CopyableDownloadLinkProps {
  href: string;
  inputLabel: string;
  copyLabel: string;
  copiedMessage: string;
  copyHint: string;
}

export function CopyableDownloadLink({
  href,
  inputLabel,
  copyLabel,
  copiedMessage,
  copyHint,
}: CopyableDownloadLinkProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [href]);

  async function copyDownloadLink() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(href);
      } else if (!document.execCommand("copy")) {
        return;
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="download-link-control">
      <div className="download-link-row">
        <input
          ref={inputRef}
          className="download-link-input"
          aria-label={inputLabel}
          readOnly
          value={href}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          className="download-link-copy-btn"
          type="button"
          title={copyLabel}
          aria-label={copyLabel}
          onClick={() => {
            void copyDownloadLink();
          }}
        >
          {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
        </button>
      </div>
      <div className="download-link-hint">
        {copied ? copiedMessage : copyHint}
      </div>
    </div>
  );
}
