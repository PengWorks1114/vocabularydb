"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  bulkImportWords,
  getPartOfSpeechTags,
  type PartOfSpeechTag,
} from "@/lib/firestore-service";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { useTranslation } from "react-i18next";
import { signOut } from "firebase/auth";

interface PageProps {
  params: Promise<{ wordbookId: string }>;
}

export default function ImportPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { user, auth } = useAuth();
  const { t } = useTranslation();
  const [csv, setCsv] = useState("");
  const [mounted, setMounted] = useState(false);
  const [posTags, setPosTags] = useState<PartOfSpeechTag[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    getPartOfSpeechTags(user.uid)
      .then(setPosTags)
      .catch((e) => console.error(e));
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleImport = async () => {
    if (!user) return;
    try {
      const lines = csv
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l);
      const items = [] as Parameters<typeof bulkImportWords>[2];
      for (const line of lines) {
        const parts = line.split(",");
        const [word, pinyin, translation, partOfSpeech, exampleSentence, exampleTranslation, synonym, antonym, usageFrequency, mastery, note] = parts.map((p) => p.trim());
        if (!word) continue;
        const relatedWords =
          (synonym || antonym)
            ? {
                ...(synonym && { same: synonym }),
                ...(antonym && { opposite: antonym }),
              }
            : undefined;
        items.push({
          word,
          pinyin: pinyin || "",
          translation: translation || "",
          partOfSpeech: partOfSpeech ? partOfSpeech.split(";").map((s) => s.trim()).filter(Boolean) : [],
          exampleSentence: exampleSentence || "",
          exampleTranslation: exampleTranslation || "",
          ...(relatedWords ? { relatedWords } : {}),
          usageFrequency: usageFrequency ? Number(usageFrequency) : 0,
          mastery: mastery ? Number(mastery) : 0,
          note: note || "",
          favorite: false,
        });
      }
      if (items.length) {
        await bulkImportWords(user.uid, wordbookId, items);
      }
      setCsv("");
      alert(t("wordList.importSuccess"));
    } catch (e) {
      console.error(e);
      alert(t("wordList.importFailed"));
    }
  };

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <BackButton labelKey="backToList" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="outline" onClick={handleLogout}>
            <span suppressHydrationWarning>{mounted ? t("logout") : ""}</span>
          </Button>
        </div>
      </div>
      <h1 className="text-xl font-bold">{t("wordList.bulkImport")}</h1>
      <div>
        <div className="mb-2 text-sm whitespace-pre-wrap">
          {t("wordList.bulkImportExample")}
        </div>
        {!!posTags.length && (
          <div className="mb-2 text-sm whitespace-pre-wrap">
            {t("wordList.partOfSpeechCodes") +
              "\n" +
              posTags.map((tag) => `  ${tag.name}: ${tag.id}`).join("\n")}
          </div>
        )}
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          className="w-full h-64 rounded border p-2"
        />
      </div>
      <Button onClick={handleImport} className="bg-blue-500 text-white hover:bg-blue-600">
        {t("wordList.import")}
      </Button>
    </div>
  );
}
