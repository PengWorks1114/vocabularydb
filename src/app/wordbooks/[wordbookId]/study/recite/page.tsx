"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useAuth } from "@/components/auth-provider";
import {
  getWordsByWordbookId,
  updateWord,
  Word,
} from "@/lib/firestore-service";

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

type Step = "settings" | "reciting" | "finished";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawWords(all: Word[], count: number, mode: Mode): Word[] {
  let words = [...all];
  switch (mode) {
    case "onlyUnknown":
      words = words.filter((w) => w.mastery < 25);
      break;
    case "onlyImpression":
      words = words.filter((w) => w.mastery >= 25 && w.mastery < 50);
      break;
    case "onlyFamiliar":
      words = words.filter((w) => w.mastery >= 50 && w.mastery < 75);
      break;
    case "onlyMemorized":
      words = words.filter((w) => w.mastery >= 75);
      break;
    case "onlyFavorite":
      words = words.filter((w) => w.favorite);
      break;
  }

  switch (mode) {
    case "masteryLow":
      words.sort((a, b) => a.mastery - b.mastery);
      break;
    case "masteryHigh":
      words.sort((a, b) => b.mastery - a.mastery);
      break;
    case "freqLow":
      words.sort((a, b) => a.usageFrequency - b.usageFrequency);
      break;
    case "freqHigh":
      words.sort((a, b) => b.usageFrequency - a.usageFrequency);
      break;
    case "recent":
      words.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      break;
    case "old":
      words.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
      break;
    default:
      words = shuffle(words);
  }

  if (
    mode === "onlyUnknown" ||
    mode === "onlyImpression" ||
    mode === "onlyFamiliar" ||
    mode === "onlyMemorized" ||
    mode === "onlyFavorite"
  ) {
    words = shuffle(words);
  }

  return words.slice(0, count);
}

function computeMastery(current: number, choice: Answer): number {
  switch (choice) {
    case "unknown":
      return 0;
    case "memorized":
      return 100;
    case "impression":
      return Math.round(current + (40 - current) * 0.3);
    case "familiar":
      return Math.round(current + (70 - current) * 0.3);
  }
}

type Answer = "unknown" | "impression" | "familiar" | "memorized";

export default function RecitePage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { auth } = useAuth();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [words, setWords] = useState<Word[]>([]);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [sessionWords, setSessionWords] = useState<Word[]>([]);
  const [step, setStep] = useState<Step>("settings");
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<Mode>("random");
  const [index, setIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (auth.currentUser) {
        const all = await getWordsByWordbookId(
          auth.currentUser.uid,
          wordbookId
        );
        setWords(all);
      }
    };
    load();
  }, [auth.currentUser, wordbookId]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const startSession = () => {
    const available = words.filter((w) => !usedIds.has(w.id));
    const drawn = drawWords(available, count, mode);
    setSessionWords(drawn);
    setUsedIds(
      new Set([...Array.from(usedIds), ...drawn.map((w) => w.id)])
    );
    setIndex(0);
    setShowDetails(false);
    setStep("reciting");
  };

  const handleAnswer = async (choice: Answer) => {
    const word = sessionWords[index];
    if (!auth.currentUser) return;
    const newMastery = computeMastery(word.mastery, choice);
    await updateWord(auth.currentUser.uid, wordbookId, word.id, {
      mastery: newMastery,
    });
    setSessionWords((prev) => {
      const copy = [...prev];
      copy[index] = { ...word, mastery: newMastery };
      return copy;
    });
    setShowDetails(true);
  };

  const next = () => {
    if (index + 1 >= sessionWords.length) {
      setStep("finished");
    } else {
      setIndex(index + 1);
      setShowDetails(false);
    }
  };

  const repeatSet = () => {
    setIndex(0);
    setShowDetails(false);
    setStep("reciting");
  };

  const nextSet = () => {
    startSession();
  };

  const progressPercent =
    sessionWords.length > 0
      ? ((index + (showDetails ? 1 : 0)) / sessionWords.length) * 100
      : 0;

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
          {mounted ? t("studyPage.recite") : ""}
        </span>
      </h1>

      {step === "settings" && (
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
          <Button className="w-full" onClick={startSession}>
            {t("recite.start")}
          </Button>
        </div>
      )}

      {step === "reciting" && sessionWords.length > 0 && (
        <div className="max-w-md mx-auto space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            {t("recite.progress", {
              current: index + 1,
              total: sessionWords.length,
            })}
          </p>
          <div className="border rounded p-6 space-y-4 text-center">
            <div className="text-2xl font-bold">
              {sessionWords[index].word}
            </div>
            {showDetails && (
              <div className="space-y-2 text-left">
                <div>
                  {t("wordList.translation")}: {sessionWords[index].translation}
                </div>
                <div>
                  {t("wordList.pinyin")}: {sessionWords[index].pinyin}
                </div>
                <div>
                  {t("wordList.example")}: {sessionWords[index].exampleSentence}
                </div>
                <div>
                  {t("wordList.exampleTranslation")}:
                  {" "}
                  {sessionWords[index].exampleTranslation}
                </div>
              </div>
            )}
            {!showDetails ? (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handleAnswer("unknown")}>
                  {t("wordList.masteryLevels.unknown")}
                </Button>
                <Button onClick={() => handleAnswer("impression")}>
                  {t("wordList.masteryLevels.impression")}
                </Button>
                <Button onClick={() => handleAnswer("familiar")}>
                  {t("wordList.masteryLevels.familiar")}
                </Button>
                <Button onClick={() => handleAnswer("memorized")}>
                  {t("wordList.masteryLevels.memorized")}
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={next}>
                {t("recite.next")}
              </Button>
            )}
          </div>
          <div className="h-2 bg-muted rounded">
            <div
              className="h-2 bg-primary rounded"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {step === "finished" && (
        <div className="max-w-md mx-auto space-y-4 text-center">
          <p>
            {t("recite.progress", {
              current: sessionWords.length,
              total: sessionWords.length,
            })}
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={repeatSet}>{t("recite.again")}</Button>
            <Button onClick={nextSet}>{t("recite.nextSet", { count })}</Button>
            <Link href={`/wordbooks/${wordbookId}/study`} className="w-full">
              <Button className="w-full" variant="outline">
                {t("recite.finish")}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

