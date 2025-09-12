"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import "@/i18n/i18n-client";
import {
  getDueSrsWords,
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

export default function SrsPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { user } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("setup");
  const [count, setCount] = useState(10);
  const [includeAll, setIncludeAll] = useState(false);
  const [queue, setQueue] = useState<{ word: Word; state: SrsState }[]>([]);
  const [total, setTotal] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const start = async () => {
    if (!user) return;
    let items: { word: Word; state: SrsState }[] = [];
    if (includeAll) {
      const words = await getWordsByWordbookId(user.uid, wordbookId);
      const states = await getAllSrsStates(user.uid, wordbookId, words);
      items = words.map((w) => ({ word: w, state: states[w.id] }));
    } else {
      items = await getDueSrsWords(user.uid, wordbookId);
    }
    if (count > 0) items = items.slice(0, count);
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
          <Link
            href={`/wordbooks/${wordbookId}/srs/stats`}
            className="flex-1 text-center border rounded px-4 py-2"
          >
            {t("srs.stats.title")}
          </Link>
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
            <div className="grid grid-cols-2 gap-2 pt-4">
              <Button variant="outline" onClick={() => handleAnswer(0)}>
                {t("srs.buttons.wrong")}
              </Button>
              <Button variant="outline" onClick={() => handleAnswer(1)}>
                {t("srs.buttons.hard")}
              </Button>
              <Button variant="outline" onClick={() => handleAnswer(2)}>
                {t("srs.buttons.good")}
              </Button>
              <Button variant="outline" onClick={() => handleAnswer(3)}>
                {t("srs.buttons.easy")}
              </Button>
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

