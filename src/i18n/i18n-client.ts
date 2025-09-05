import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    debug: true,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    resources: {
      en: {
        translation: {
          welcome: "Welcome",
          login: "Login",
          home: "Home",
        },
      },
      "zh-Hant": {
        translation: {
          welcome: "歡迎",
          login: "登入",
          home: "首頁",
        },
      },
      ja: {
        translation: {
          welcome: "ようこそ",
          login: "ログイン",
          home: "ホーム",
        },
      },
    },
  });

export default i18n;
