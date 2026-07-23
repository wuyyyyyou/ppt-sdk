import { AlertTriangle, Info, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ConfirmationDialogRequest } from "../types";

interface ConfirmationDialogProps {
  request: ConfirmationDialogRequest | null;
  onResolve: (confirmed: boolean) => void;
}

export function ConfirmationDialog({ request, onResolve }: ConfirmationDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    confirmButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onResolve(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onResolve, request]);

  if (!request) return null;

  const Icon = request.tone === "danger" || request.tone === "warning" ? AlertTriangle : Info;

  return (
    <div
      className={`app-confirmation-modal ${request.tone}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-confirmation-title"
      aria-describedby="app-confirmation-body"
      onClick={() => request.dismissible !== false && onResolve(false)}
    >
      <section className={`app-confirmation-card ${request.tone}`} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="app-confirmation-close"
          aria-label={request.closeLabel}
          onClick={() => onResolve(false)}
        >
          <X size={16} />
        </button>
        <div className="app-confirmation-icon"><Icon size={22} /></div>
        <div className="app-confirmation-copy">
          <h2 id="app-confirmation-title">{request.title}</h2>
          <p id="app-confirmation-body">{request.body}</p>
        </div>
        <footer className="app-confirmation-actions">
          {request.cancelLabel ? (
            <button type="button" className="secondary-btn" onClick={() => onResolve(false)}>
              {request.cancelLabel}
            </button>
          ) : null}
          <button
            ref={confirmButtonRef}
            type="button"
            className={request.tone === "danger" ? "danger-btn" : "primary-btn"}
            onClick={() => onResolve(true)}
          >
            {request.confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
