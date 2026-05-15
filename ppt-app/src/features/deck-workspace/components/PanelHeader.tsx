import { BookOpen, Minus, PanelTop, X } from "lucide-react";
import type { Locale, Messages } from "../../../i18n/messages";

interface PanelHeaderProps {
  t: Messages;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  status: string;
  onLibrary: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export function PanelHeader(props: PanelHeaderProps) {
  const { t, locale, setLocale, status, onLibrary, onMinimize, onClose } = props;

  return (
    <header className="panel-header">
      <div className="header-left">
        <PanelTop size={18} />
        <div className="app-title">{t.appName}</div>
        {status ? <div className="status-pill">{status}</div> : null}
      </div>
      <div className="header-controls">
        <button className="control-btn text" onClick={onLibrary} title={t.controls.library}>
          <BookOpen size={14} />
          {t.controls.library}
        </button>
        <div className="lang-switch" aria-label="Language">
          <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>
            EN
          </button>
          <button className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")}>
            中
          </button>
        </div>
        <button className="control-btn" onClick={onMinimize} title={t.controls.minimize}>
          <Minus size={14} />
        </button>
        <button className="control-btn" onClick={onClose} title={t.controls.close}>
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
