import { Sparkles } from "lucide-react";
import type { Messages } from "../../../i18n/messages";
import type { PageReviewSettings } from "../reviewSettings";

export interface BriefPageProps {
  t: Messages;
  prompt: string;
  setPrompt: (value: string) => void;
  loading: string;
  pageReviewSettings: PageReviewSettings;
  setStrictReviewMode: (enabled: boolean) => Promise<void>;
  workspaceSettingsSaving: boolean;
  generateDeck: () => Promise<void>;
}

export function BriefPage({
  t,
  prompt,
  setPrompt,
  loading,
  pageReviewSettings,
  setStrictReviewMode,
  workspaceSettingsSaving,
  generateDeck,
}: BriefPageProps) {
  const busy = loading !== "none";
  return (
    <section className="brief-page">
      <div className="brief-hero">
        <h1>{t.brief.title}</h1>
      </div>

      <div className="brief-composer">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t.brief.placeholder}
          disabled={busy}
        />
        <label className="strict-review-toggle">
          <input
            type="checkbox"
            checked={pageReviewSettings.visualReviewEnabled}
            disabled={workspaceSettingsSaving || busy}
            onChange={(event) => void setStrictReviewMode(event.target.checked)}
          />
          <span>{t.brief.strictReviewMode}</span>
        </label>
        <button
          className="primary-btn brief-generate-btn"
          disabled={busy || !prompt.trim()}
          onClick={() => void generateDeck()}
        >
          <Sparkles size={18} />
          {busy ? t.status.creatingDeck : t.controls.createDeck}
        </button>
      </div>
    </section>
  );
}

export function ThinkingStatusText({ text, active = false, showOrb = false }: { text: string; active?: boolean; showOrb?: boolean }) {
  return <span className={`thinking-status-text ${active ? "active" : ""}`}>{showOrb ? <i /> : null}{text}</span>;
}
