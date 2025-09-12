"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import "@/i18n/i18n-client";
import {
  applySrsAnswer,
  getWordsByWordbookId,
  getAllSrsStates,
  type Word,
  type SrsState,
} from "@/lib/firestore-service";

interface PageProps {
  params: Promise<{ wordbookId: string }>;
}

type Step = "setup" | "review" | "done";

type Mode =
  | "random"
  | "masteryLow"
  | "masteryHigh"
  | "freqLow"
  | "freqHigh"
  | "recent"
  | "old"
  | "reviewRecent"
  | "reviewOld"
  | "onlyUnknown"
  | "onlyImpression"
  | "onlyFamiliar"
  | "onlyMemorized"
  | "onlyFavorite";

function drawWords(all: Word[], count: number, mode: Mode): Word[] {
  let words = [...all];
  switch (mode) {
    case "masteryLow":
      words.sort((a, b) => (a.mastery || 0) - (b.mastery || 0));
      break;
    case "masteryHigh":
      words.sort((a, b) => (b.mastery || 0) - (a.mastery || 0));
      break;
    case "freqLow":
      words.sort((a, b) => (a.usageFrequency || 0) - (b.usageFrequency || 0));
      break;
    case "freqHigh":
      words.sort((a, b) => (b.usageFrequency || 0) - (a.usageFrequency || 0));
      break;
    case "recent":
      words.sort(
        (a, b) =>
          (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
      );
      break;
    case "old":
      words.sort(
        (a, b) =>
          (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)
      );
      break;
    case "reviewRecent":
      words.sort(
        (a, b) =>
          (b.reviewDate?.toMillis() || 0) - (a.reviewDate?.toMillis() || 0)
      );
      break;
    case "reviewOld":
      words.sort(
        (a, b) =>
          (a.reviewDate?.toMillis() || 0) - (b.reviewDate?.toMillis() || 0)
      );
      break;
    case "onlyUnknown":
      words = words.filter((w) => (w.mastery || 0) < 25);
      break;
    case "onlyImpression":
      words = words.filter((w) => (w.mastery || 0) >= 25 && (w.mastery || 0) < 50);
      break;
    case "onlyFamiliar":
      words = words.filter((w) => (w.mastery || 0) >= 50 && (w.mastery || 0) < 90);
      break;
    case "onlyMemorized":
      words = words.filter((w) => (w.mastery || 0) >= 90);
      break;
    case "onlyFavorite":
      words = words.filter((w) => w.favorite);
      break;
  }
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words.slice(0, count);
}

export default function SrsPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { user } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("setup");
  const [count, setCount] = useState(10);
  const [includeAll, setIncludeAll] = useState(false);
  const [mode, setMode] = useState<Mode>("random");
  const [queue, setQueue] = useState<{ word: Word; state: SrsState }[]>([]);
  const [total, setTotal] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const start = async () => {
    if (!user) return;
    const words = await getWordsByWordbookId(user.uid, wordbookId);
    const states = await getAllSrsStates(user.uid, wordbookId, words);
    let pairs = words.map((w) => ({ word: w, state: states[w.id] }));
    if (!includeAll) {
      const today = new Date();
      pairs = pairs.filter((p) => p.state.dueDate.toDate() <= today);
    }
    const selected = drawWords(
      pairs.map((p) => p.word),
      count,
      mode
    );
    const items = selected.map((w) => ({ word: w, state: states[w.id] }));
    setQueue(items);
    setTotal(items.length);
    setStep(items.length ? "review" : "done");
    setShowAnswer(false);
  };

  const current = queue[0];
  const progress = total - queue.length + 1;
  const progressPercent = (progress / total) * 100;
  const progressColor = `hsl(${(progressPercent / 100) * 120},70%,50%)`;
  const overdue = current
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - current.state.dueDate.toDate().getTime()) / 86400000
        )
      )
    : 0;

  const handleAnswer = async (q: 0 | 1 | 2 | 3) => {
    if (!user || !current) return;
    const newState = await applySrsAnswer(
      user.uid,
      wordbookId,
      current.word,
      current.state,
      q
    );
    const rest = queue.slice(1);
    if (q <= 1) rest.push({ word: current.word, state: newState });
    setQueue(rest);
    setShowAnswer(false);
    if (rest.length === 0) setStep("done");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && step === "review" && !showAnswer) {
        setShowAnswer(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, showAnswer]);

  if (step === "setup") {
    return (
      <div className="p-4 space-y-4 max-w-sm mx-auto">
        <h1 className="text-xl font-semibold">{t("srs.title")}</h1>
        <div className="space-y-2">
          <label className="block text-sm">
            {t("srs.count")}
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1 w-full border rounded p-2"
            />
          </label>
          <label className="block text-sm">
            {t("recite.mode")}
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="mt-1 w-full border rounded p-2"
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
                  "reviewRecent",
                  "reviewOld",
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
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeAll}
              onChange={(e) => setIncludeAll(e.target.checked)}
            />
            {t("srs.includeAll")}
          </label>
        </div>
        <div className="flex gap-2">
          <Button onClick={start} className="flex-1">
            {t("srs.start")}
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/wordbooks/${wordbookId}/srs/stats`}>
              {t("srs.stats.title")}
            </Link>
          </Button>
        </div>
        <Link href={`/wordbooks/${wordbookId}`} className="text-blue-500">
          {t("backToWordbook")}
        </Link>
      </div>
    );
  }

  if (step === "done" || !current) {
    return (
      <div className="p-4 text-center space-y-4">
        <h1 className="text-xl font-semibold">{t("srs.done")}</h1>
        <Button onClick={() => setStep("setup")}>{t("srs.back")}</Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <div className="flex items-center">
        <Link
          href={`/wordbooks/${wordbookId}/srs`}
          className="text-sm text-muted-foreground"
        >
          &larr; {t("srs.back")}
        </Link>
      </div>
      <p className="text-center text-base text-muted-foreground">
        {t("srs.progress", { current: progress, total })}
      </p>
      <div className="h-3 bg-muted rounded">
        <div
          className="h-3 rounded"
          style={{ width: `${progressPercent}%`, backgroundColor: progressColor }}
        />
      </div>
      <div className="border rounded p-6 space-y-4 text-center">
        <div className="text-3xl font-bold">{current.word.word}</div>
        {showAnswer ? (
          <>
            {overdue > 0 && (
              <div className="text-red-600 text-sm">
                {t("srs.overdue", { days: overdue })}
              </div>
            )}
            <div className="text-xl text-red-600">
              {current.word.translation}
            </div>
            <div className="whitespace-pre-line">
              {current.word.exampleSentence}
            </div>
            <div className="whitespace-pre-line text-sm text-muted-foreground">
              {current.word.exampleTranslation}
            </div>
            <div className="grid grid-cols-4 gap-1 pt-4">
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={() => handleAnswer(0)}
              >
                {t("srs.buttons.wrong")}
              </Button>
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => handleAnswer(1)}
              >
                {t("srs.buttons.hard")}
              </Button>
              <Button
                size="sm"
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                onClick={() => handleAnswer(2)}
              >
                {t("srs.buttons.good")}
              </Button>
              <Button
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={() => handleAnswer(3)}
              >
                {t("srs.buttons.easy")}
              </Button>
            </div>
            <div className="space-y-1">
              <p className="text-center text-sm text-muted-foreground">
                {t("recite.masteryTitle")}
              </p>
              <div className="grid grid-cols-4 gap-1 text-xs text-muted-foreground">
                <p className="text-center">{t("recite.hints.unknown")}</p>
                <p className="text-center">{t("recite.hints.impression")}</p>
                <p className="text-center">{t("recite.hints.familiar")}</p>
                <p className="text-center">{t("recite.hints.memorized")}</p>
              </div>
            </div>
          </>
        ) : (
          <Button onClick={() => setShowAnswer(true)}>
            {t("srs.showAnswer")}
          </Button>
        )}
      </div>
    </div>
  );
}

