import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zhHans from "./locales/zh-Hans.json";

const resources = {
  en: { translation: en },
  "zh-Hans": { translation: zhHans },
};

export const supportedLocales = Object.keys(resources);

export async function initI18n() {
  if (!i18n.isInitialized) {
    await i18n
      .use(initReactI18next)
      .init({
        resources,
        fallbackLng: "en",
        lng: detectLocale(),
        interpolation: {
          escapeValue: false,
        },
      });
  }
  return i18n;
}

export function detectLocale() {
  const locales = Localization.getLocales();
  for (const locale of locales) {
    if (supportedLocales.includes(locale.languageTag)) {
      return locale.languageTag;
    }
    if (locale.languageCode === "zh") {
      return "zh-Hans";
    }
  }
  return "en";
}

export default i18n;
