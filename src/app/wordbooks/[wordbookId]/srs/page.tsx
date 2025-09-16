"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth-provider";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

interface PageProps {
  params: Promise<{ wordbookId: string }>;
}

export default function SrsModeSelectPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { auth } = useAuth();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  return (
    <div className="p-4 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <BackButton href={`/wordbooks/${wordbookId}`} />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="outline" onClick={handleLogout} disabled={!auth}>
            <span suppressHydrationWarning>
              {mounted ? t("logout") : ""}
            </span>
          </Button>
        </div>
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">
          <span suppressHydrationWarning>
            {mounted ? t("srs.title") : ""}
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("srs.modeSelect.description")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border p-4 text-left">
          <h2 className="text-lg font-semibold">{t("srs.modes.flashcards")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("srs.modeSelect.flashcardsDescription")}
          </p>
          <Button asChild>
            <Link href={`/wordbooks/${wordbookId}/srs/flashcards`}>
              {t("srs.modeSelect.flashcardsButton")}
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border p-4 text-left">
          <h2 className="text-lg font-semibold">{t("srs.modes.dictation")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("srs.modeSelect.dictationDescription")}
          </p>
          <Button asChild>
            <Link href={`/wordbooks/${wordbookId}/srs/dictation`}>
              {t("srs.modeSelect.dictationButton")}
            </Link>
          </Button>
        </div>
      </div>
      <div className="text-center">
        <Button asChild variant="outline">
          <Link href={`/wordbooks/${wordbookId}/srs/stats`}>
            {t("srs.stats.title")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
