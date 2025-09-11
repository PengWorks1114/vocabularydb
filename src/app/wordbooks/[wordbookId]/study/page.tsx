"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getWordsByWordbookId } from "@/lib/firestore-service";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { CircleProgress } from "@/components/ui/circle-progress";

interface PageProps {
  params: Promise<{ wordbookId: string }>;
}

export default function StudyPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { user, auth } = useAuth();
  const { t } = useTranslation();
  const [overallMastery, setOverallMastery] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  const loadKey = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.uid) return;
    const key = `${user.uid}-${wordbookId}`;
    if (loadKey.current === key) return;
    loadKey.current = key;
    getWordsByWordbookId(user.uid, wordbookId).then((words) => {
      setWordCount(words.length);
      const mastery =
        words.length > 0
          ?
              (words.reduce(
                (sum, w) => sum + Math.min(w.mastery || 0, 100),
                0
              ) /
                words.length) *
              10
          : 0;
      setOverallMastery(mastery);
    });
  }, [user?.uid, wordbookId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const masteryColor = `hsl(${(overallMastery / 1000) * 120}, 80%, 45%)`;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/wordbooks/${wordbookId}`}
          className="text-sm text-muted-foreground"
          suppressHydrationWarning
        >
          &larr; {mounted ? t("backToList") : ""}
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

      <div className="flex flex-col items-center gap-6">
        <CircleProgress value={overallMastery / 10} />
        <div>{t("studyPage.totalWords", { count: wordCount })}</div>
        <div className="flex items-center gap-2">
          <span>{t("wordList.overallMastery")}</span>
          <div className="h-2 w-40 rounded bg-gray-200">
            <div
              className="h-2 rounded"
              style={{ width: `${overallMastery / 10}%`, backgroundColor: masteryColor }}
            />
          </div>
          <span>{(overallMastery / 10).toFixed(1)}%</span>
        </div>
        <div className="flex gap-4 mt-4">
          <Button
            asChild
            className="bg-orange-500 text-black hover:bg-orange-600"
          >
            <Link href={`/wordbooks/${wordbookId}/study/recite`}>
              {t("studyPage.recite")}
            </Link>
          </Button>
          <Button
            asChild
            className="bg-green-500 text-black hover:bg-green-600"
          >
            <Link href={`/wordbooks/${wordbookId}/study/dictation`}>
              {t("studyPage.dictation")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
