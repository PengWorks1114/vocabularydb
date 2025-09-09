"use client";

import { useTranslation } from "react-i18next";
import "@/i18n/i18n-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <Select value={i18n.language} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder={t("languageSwitcher.placeholder")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="zh-Hant">{t("languages.zh-Hant")}</SelectItem>
        <SelectItem value="ja">{t("languages.ja")}</SelectItem>
        <SelectItem value="en">{t("languages.en")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
