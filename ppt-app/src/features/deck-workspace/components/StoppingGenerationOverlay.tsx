import { LoaderCircle, Sparkles } from "lucide-react";
import type { Messages } from "../../../i18n/messages";

interface StoppingGenerationOverlayProps {
  t: Messages;
}

export function StoppingGenerationOverlay({ t }: StoppingGenerationOverlayProps) {
  return (
    <div
      className="stopping-generation-overlay"
      role="status"
      aria-live="polite"
      aria-label={t.generating.stoppingTitle}
    >
      <section className="stopping-generation-card">
        <div className="stopping-generation-orb" aria-hidden="true">
          <Sparkles size={28} />
          <LoaderCircle className="stopping-generation-spinner" size={76} />
        </div>
        <h2>{t.generating.stoppingTitle}</h2>
        <p>{t.generating.stoppingDescription}</p>
      </section>
    </div>
  );
}
