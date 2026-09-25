import * as Localization from "expo-localization";
import Storage from "expo-sqlite/kv-store";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

// Add a locale: drop <lang>.json next to en.json (same keys) and register it here.
const resources = {
  en: { translation: en },
};

const stored = Storage.getItemSync("app.language");
const device = Localization.getLocales()[0]?.languageCode;
const lng = (stored ?? device ?? "") in resources ? (stored ?? device)! : "en";

// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: "en",
  compatibilityJSON: "v4",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  returnNull: false,
});

i18n.on("languageChanged", (next) => {
  Storage.setItemAsync("app.language", next);
});

export default i18n;
