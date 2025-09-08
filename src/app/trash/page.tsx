"use client";

import WordbookList from "@/components/wordbooks/wordbook-list";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useTranslation } from "react-i18next";
import { clearTrashedWordbooks } from "@/lib/firestore-service";
import { useState } from "react";

export default function TrashPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const handleClear = async () => {
    if (!user) return;
    setClearing(true);
    try {
      await clearTrashedWordbooks(user.uid);
      setRefresh((r) => r + 1);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("trash.title")}</h1>
        <Button
          variant="destructive"
          onClick={handleClear}
          disabled={clearing}
        >
          {clearing ? t("trash.clearing") : t("trash.clear")}
        </Button>
      </div>
      <WordbookList key={refresh} trashed />
    </div>
  );
}
