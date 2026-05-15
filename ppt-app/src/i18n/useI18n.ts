import { useMemo, useState } from "react";
import { Locale, messages } from "./messages";

const STORAGE_KEY = "ppt-app-locale";

function readInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh") {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(() => readInitialLocale());

  function setLocale(nextLocale: Locale) {
    localStorage.setItem(STORAGE_KEY, nextLocale);
    setLocaleState(nextLocale);
  }

  return useMemo(
    () => ({
      locale,
      setLocale,
      t: messages[locale]
    }),
    [locale]
  );
}
