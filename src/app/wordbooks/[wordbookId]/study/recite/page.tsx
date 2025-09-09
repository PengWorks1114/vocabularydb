"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useAuth } from "@/components/auth-provider";

interface PageProps {
  params: Promise<{ wordbookId: string }>;
}

type Mode =
  | "random"
  | "masteryLow"
  | "masteryHigh"
  | "freqLow"
  | "freqHigh"
  | "recent"
  | "old"
  | "onlyUnknown"
  | "onlyImpression"
  | "onlyFamiliar"
  | "onlyMemorized"
  | "onlyFavorite";

export default function ReciteSettingsPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { auth } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<Mode>("random");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const start = () => {
    router.push(
      `/wordbooks/${wordbookId}/study/recite/session?count=${count}&mode=${mode}`
    );
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/wordbooks/${wordbookId}/study`}
          className="text-sm text-muted-foreground"
          suppressHydrationWarning
        >
          &larr; {mounted ? t("backToStudy") : ""}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="outline" onClick={handleLogout}>
            <span suppressHydrationWarning>
              {mounted ? t("logout") : ""}
            </span>
          </Button>
        </div>
      </div>
      <h1 className="text-center text-2xl font-bold">
        <span suppressHydrationWarning>
          {mounted ? t("recite.settingsTitle") : ""}
        </span>
      </h1>
      <div className="max-w-md mx-auto space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            {t("recite.count")}
          </label>
          <select
            className="w-full border rounded p-2"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {[5, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            {t("recite.mode")}
          </label>
          <select
            className="w-full border rounded p-2"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            {(
              [
                "random",
                "masteryLow",
                "masteryHigh",
                "freqLow",
                "freqHigh",
                "recent",
                "old",
                "onlyUnknown",
                "onlyImpression",
                "onlyFamiliar",
                "onlyMemorized",
                "onlyFavorite",
              ] as Mode[]
            ).map((m) => (
              <option key={m} value={m}>
                {t(`recite.modes.${m}`)}
              </option>
            ))}
          </select>
        </div>
        <Button className="w-full" onClick={start}>
          {t("recite.start")}
        </Button>
      </div>
    </div>
  );
}

