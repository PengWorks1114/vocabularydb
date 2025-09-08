"use client";

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
      escapeValue: false,
    },
    resources: {
      en: {
        translation: {
          welcome: "Welcome",
          login: "Login",
          home: "Home",
          colors: {
            gray: "Gray",
            brown: "Brown",
            orange: "Orange",
            yellow: "Yellow",
            green: "Green",
            blue: "Blue",
            purple: "Purple",
            pink: "Pink",
            red: "Red",
          },
        },
      },
      "zh-Hant": {
        translation: {
          welcome: "歡迎",
          login: "登入",
          home: "首頁",
          colors: {
            gray: "灰色",
            brown: "棕色",
            orange: "橘色",
            yellow: "黃色",
            green: "綠色",
            blue: "藍色",
            purple: "紫色",
            pink: "粉色",
            red: "紅色",
          },
        },
      },
      ja: {
        translation: {
          welcome: "ようこそ",
          login: "ログイン",
          home: "ホーム",
          colors: {
            gray: "グレー",
            brown: "ブラウン",
            orange: "オレンジ",
            yellow: "イエロー",
            green: "グリーン",
            blue: "ブルー",
            purple: "パープル",
            pink: "ピンク",
            red: "レッド",
          },
        },
      },
    },
  });

export default i18n;
