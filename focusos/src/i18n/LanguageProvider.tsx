"use client";

import * as React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "./index";
import {
  applyDocumentLanguage,
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  normalizeLanguage,
  persistLanguage,
  type SupportedLanguage,
} from "./language";
import { userApi } from "@/services/user.api";
import { useUserStore } from "@/stores/user.store";
import { syncLanguageToExtension } from "@/lib/extension/bridge";

type LanguageContextValue = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  isSaving: boolean;
  syncError: string;
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const userPreferences = useUserStore((state) => state.preferences);
  const updatePreferencesInStore = useUserStore((state) => state.updatePreferencesLocal);
  const [language, setLanguageState] = React.useState<SupportedLanguage>(
    normalizeLanguage(i18n.language || DEFAULT_LANGUAGE)
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [syncError, setSyncError] = React.useState("");

  React.useEffect(() => {
    function handleLanguageChanged(nextLanguage: string) {
      setLanguageState(normalizeLanguage(nextLanguage));
    }

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, []);

  const applyLanguagePreference = React.useCallback(async (nextLanguage: SupportedLanguage) => {
    await i18n.changeLanguage(nextLanguage);
    applyDocumentLanguage(nextLanguage);
    persistLanguage(nextLanguage);
    void syncLanguageToExtension(nextLanguage);
  }, []);

  React.useEffect(() => {
    const initialClientLanguage = getStoredLanguage();
    if (!initialClientLanguage) return;
    if (initialClientLanguage !== normalizeLanguage(i18n.language)) {
      void applyLanguagePreference(initialClientLanguage);
    }
  }, [applyLanguagePreference]);

  React.useEffect(() => {
    const backendLanguage = userPreferences?.language;
    if (!backendLanguage) return;
    const normalized = normalizeLanguage(backendLanguage);
    if (normalized !== language) {
      void applyLanguagePreference(normalized);
    }
  }, [applyLanguagePreference, language, userPreferences?.language]);

  const setLanguage = React.useCallback(
    async (nextLanguage: SupportedLanguage) => {
      const normalized = normalizeLanguage(nextLanguage);
      setSyncError("");
      await applyLanguagePreference(normalized);
      updatePreferencesInStore({ language: normalized });

      setIsSaving(true);
      try {
        const updatedPreferences = await userApi.updatePreferences({ language: normalized });
        updatePreferencesInStore(updatedPreferences);
      } catch {
        setSyncError(i18n.t("settings:language.saveFailed"));
      } finally {
        setIsSaving(false);
      }
    },
    [applyLanguagePreference, updatePreferencesInStore]
  );

  const value = React.useMemo(
    () => ({ language, setLanguage, isSaving, syncError }),
    [isSaving, language, setLanguage, syncError]
  );

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </I18nextProvider>
  );
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
