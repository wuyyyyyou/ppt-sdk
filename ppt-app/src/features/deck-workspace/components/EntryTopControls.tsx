import { Settings } from "lucide-react";
import { LocaleSwitch } from "./LocaleSwitch";
import type { Locale, Messages } from "../../../i18n/messages";

interface EntryTopControlsProps {
  t: Messages;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  onSettings: () => void;
}

/**
 * The entry pages have no panel header, so the two global controls sit in the
 * top right of the content column instead of the sidebar.
 */
export function EntryTopControls({ t, locale, setLocale, onSettings }: EntryTopControlsProps) {
  return (
    <div className="entry-topbar">
      <button type="button" className="control-btn text" onClick={onSettings} title={t.controls.library}>
        <Settings size={14} aria-hidden="true" />
        {t.controls.library}
      </button>
      <LocaleSwitch locale={locale} setLocale={setLocale} />
    </div>
  );
}
