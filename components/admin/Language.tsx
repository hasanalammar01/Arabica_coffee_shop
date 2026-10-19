"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { ADMIN_LANGUAGE_COOKIE, translateAdminMessage } from "@/lib/admin/language";

type AdminLanguage = {
  lang: Lang;
  locale: string;
  setLang: (lang: Lang) => void;
  t: (english: string, arabic: string) => string;
  localizeError: (message: string) => string;
};

const LanguageContext = createContext<AdminLanguage | null>(null);

export function AdminLanguageProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLanguage] = useState(initialLang);
  const setLang = useCallback((next: Lang) => {
    setLanguage(next);
    document.cookie = `${ADMIN_LANGUAGE_COOKIE}=${next}; Path=/admin; Max-Age=31536000; SameSite=Lax`;
  }, []);
  const t = useCallback((english: string, arabic: string) => (lang === "ar" ? arabic : english), [lang]);
  const localizeError = useCallback((message: string) => translateAdminMessage(message, lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const value = useMemo(
    () => ({ lang, locale: lang === "ar" ? "ar-LB" : "en-GB", setLang, t, localizeError }),
    [lang, setLang, t, localizeError],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAdminLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("Admin components require AdminLanguageProvider.");
  return value;
}

/** Switches in place so open screens, selections and unsaved edits are preserved. */
export function LanguageSwitch() {
  const { lang, setLang, t } = useAdminLanguage();
  return (
    <button
      type="button"
      className="language-switch"
      lang={lang === "en" ? "ar" : "en"}
      dir="auto"
      aria-label={t("Switch admin to Arabic", "تغيير لغة لوحة الإدارة إلى الإنجليزية")}
      title={t("Switch admin to Arabic", "تغيير لغة لوحة الإدارة إلى الإنجليزية")}
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
    >
      {lang === "en" ? "العربية" : "English"}
    </button>
  );
}
