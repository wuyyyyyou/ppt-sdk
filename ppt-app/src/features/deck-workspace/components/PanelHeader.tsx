import { Home, Settings } from "lucide-react";
import { LocaleSwitch } from "./LocaleSwitch";
import type { Locale, Messages } from "../../../i18n/messages";

interface PanelHeaderProps {
  t: Messages;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  status: string;
  onLibrary: () => void;
  navigationDisabled?: boolean;
  onHome: () => void;
}

export function PanelHeader(props: PanelHeaderProps) {
  const {
    t,
    locale,
    setLocale,
    status,
    onLibrary,
    navigationDisabled = false,
    onHome,
  } = props;

  return (
    <header className="panel-header">
      <div className="header-left">
        <button
          data-performance-id="navigation.home"
          className="header-home-btn"
          type="button"
          onClick={onHome}
          title={t.myWork.home}
          aria-label={t.myWork.home}
          disabled={navigationDisabled}
        >
          <Home size={18} aria-hidden="true" />
        </button>
        {status ? <div className="status-pill">{status}</div> : null}
      </div>
      <div className="header-controls">
        <button
          data-performance-id="navigation.settings"
          className="control-btn text"
          onClick={onLibrary}
          title={t.controls.library}
          disabled={navigationDisabled}
        >
          <Settings size={14} aria-hidden="true" />
          {t.controls.library}
        </button>
        <LocaleSwitch locale={locale} setLocale={setLocale} />
      </div>
    </header>
  );
}
