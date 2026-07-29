import { AlertTriangle, Info, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ConfirmationDialogRequest } from "../types";

interface ConfirmationDialogProps {
  request: ConfirmationDialogRequest | null;
  onResolve: (confirmed: boolean) => void;
}

export function ConfirmationDialog({ request, onResolve }: ConfirmationDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const dismissible = request?.dismissible !== false;

  useEffect(() => {
    if (!request) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    confirmButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dismissible) return;
      event.preventDefault();
      onResolve(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      const returnFocusTarget = returnFocusRef.current;
      returnFocusRef.current = null;
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [dismissible, onResolve, request]);

  if (!request) return null;

  const Icon = request.tone === "danger" || request.tone === "warning" ? AlertTriangle : Info;

  return (
    <div
      className={`app-confirmation-modal ${request.tone}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClick={() => dismissible && onResolve(false)}
    >
      <section className={`app-confirmation-card ${request.tone}`} onClick={(event) => event.stopPropagation()}>
        {dismissible ? (
          <button
            data-performance-id="confirmation.close"
            type="button"
            className="app-confirmation-close"
            aria-label={request.closeLabel}
            title={request.closeLabel}
            onClick={() => onResolve(false)}
          >
            <X size={16} />
          </button>
        ) : null}
        <div className="app-confirmation-icon" aria-hidden="true"><Icon size={22} /></div>
        <div className="app-confirmation-copy">
          <h2 id={titleId}>{request.title}</h2>
          <p id={bodyId}>{request.body}</p>
        </div>
        <footer className="app-confirmation-actions">
          {request.cancelLabel ? (
            <button data-performance-id="confirmation.cancel" type="button" className="secondary-btn" onClick={() => onResolve(false)}>
              {request.cancelLabel}
            </button>
          ) : null}
          <button
            data-performance-id="confirmation.confirm"
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
