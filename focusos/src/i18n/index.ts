import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LANGUAGE, applyDocumentLanguage } from "./language";

import commonEn from "./locales/en/common.json";
import authEn from "./locales/en/auth.json";
import dashboardEn from "./locales/en/dashboard.json";
import focusEn from "./locales/en/focus.json";
import documentsEn from "./locales/en/documents.json";
import analyticsEn from "./locales/en/analytics.json";
import onboardingEn from "./locales/en/onboarding.json";
import settingsEn from "./locales/en/settings.json";
import notificationsEn from "./locales/en/notifications.json";
import validationEn from "./locales/en/validation.json";
import commonVi from "./locales/vi/common.json";
import authVi from "./locales/vi/auth.json";
import dashboardVi from "./locales/vi/dashboard.json";
import focusVi from "./locales/vi/focus.json";
import documentsVi from "./locales/vi/documents.json";
import analyticsVi from "./locales/vi/analytics.json";
import onboardingVi from "./locales/vi/onboarding.json";
import settingsVi from "./locales/vi/settings.json";
import notificationsVi from "./locales/vi/notifications.json";
import validationVi from "./locales/vi/validation.json";

const initialLanguage = DEFAULT_LANGUAGE;
applyDocumentLanguage(initialLanguage);

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: commonEn,
      auth: authEn,
      dashboard: dashboardEn,
      focus: focusEn,
      documents: documentsEn,
      analytics: analyticsEn,
      onboarding: onboardingEn,
      settings: settingsEn,
      notifications: notificationsEn,
      validation: validationEn,
    },
    vi: {
      common: commonVi,
      auth: authVi,
      dashboard: dashboardVi,
      focus: focusVi,
      documents: documentsVi,
      analytics: analyticsVi,
      onboarding: onboardingVi,
      settings: settingsVi,
      notifications: notificationsVi,
      validation: validationVi,
    },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  defaultNS: "common",
  ns: [
    "common",
    "auth",
    "dashboard",
    "focus",
    "documents",
    "analytics",
    "onboarding",
    "settings",
    "notifications",
    "validation",
  ],
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

i18n.on("languageChanged", (language) => {
  applyDocumentLanguage(language === "en" ? "en" : "vi");
});

export default i18n;
