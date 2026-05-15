import { Edit3 } from "lucide-react";
import { localDecks } from "../../../data/mockDeck";
import { formatMessage, type Messages } from "../../../i18n/messages";
import { PageHeader } from "./PageHeader";

interface LibraryPageProps {
  t: Messages;
  onBack: () => void;
  onOpen: (name: string) => void;
  onReveal: () => void;
}

export function LibraryPage({ t, onBack, onOpen, onReveal }: LibraryPageProps) {
  return (
    <section className="page active library-page">
      <PageHeader title={t.library.title} onBack={onBack} t={t} />

      <div className="workspace-row">
        <div>
          <strong>{t.library.workspace}</strong>
          <span>{t.library.workspacePath}</span>
        </div>
        <button className="secondary-btn compact" onClick={onReveal}>
          {t.controls.revealInFinder}
        </button>
      </div>

      <div className="local-deck-list">
        {localDecks.map((deck) => {
          const edited =
            deck.editedLabelKey === "today"
              ? t.library.lastEditedToday
              : deck.editedLabelKey === "yesterday"
                ? t.library.lastEditedYesterday
                : formatMessage(t.library.lastEditedDate, {
                    date: deck.editedDate ?? ""
                  });
          return (
            <article key={deck.name} className="local-deck-row">
              <button onClick={() => onOpen(deck.name)}>
                <strong>{deck.name}</strong>
                <span>
                  {edited} · {deck.slides} slides
                </span>
              </button>
              <button className="primary-btn compact" onClick={() => onOpen(deck.name)}>
                {t.controls.open}
              </button>
            </article>
          );
        })}
      </div>

      <div className="preferences-box">
        <div className="pref-header">
          <strong>{t.library.preferences}</strong>
          <button className="secondary-btn compact">
            <Edit3 size={12} />
            {t.controls.edit}
          </button>
        </div>
        <PreferenceRow label={t.preferences.aspectRatio} value="16:9" />
        <PreferenceRow label={t.preferences.defaultLanguage} value={t.languageName} />
        <PreferenceRow label={t.preferences.textDensity} value="Balanced" />
        <PreferenceRow label={t.preferences.visualTone} value="Product UI" />
        <PreferenceRow label={t.preferences.typography} value="Clean Sans" />
      </div>
    </section>
  );
}

function PreferenceRow(props: { label: string; value: string }) {
  return (
    <div className="pref-row">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
