import type { Locale } from "../../../i18n/messages";

interface LocaleSwitchProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export function LocaleSwitch({ locale, setLocale }: LocaleSwitchProps) {
  return (
    <div className="lang-switch" aria-label="Language">
      <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>
        EN
      </button>
      <button className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")}>
        中
      </button>
    </div>
  );
}
