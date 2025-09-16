"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { signOut } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { BackButton } from "@/components/ui/back-button";
import { useAuth } from "@/components/auth-provider";
import {
  getWordsByWordbookId,
  updateWord,
  Word,
  getAllSrsStates,
  applySrsAnswer,
  type SrsState,
  getPartOfSpeechTags,
  type PartOfSpeechTag,
} from "@/lib/firestore-service";
import { Timestamp } from "firebase/firestore";

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
  | "reviewRecent"
  | "reviewOld"
  | "onlyUnknown"
  | "onlyImpression"
  | "onlyFamiliar"
  | "onlyMemorized"
  | "onlyFavorite";

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
      words = words.filter((w) => w.mastery >= 50 && w.mastery < 90);
      break;
    case "onlyMemorized":
      words = words.filter((w) => w.mastery >= 90);
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
  const getRegion = (value: number): Answer => {
    if (value >= 90) return "memorized";
    if (value >= 50) return "familiar";
    if (value >= 25) return "impression";
    return "unknown";
  };

  const currentRegion = getRegion(current);

  switch (choice) {
    case "unknown":
      return currentRegion === "unknown" ? current : 0;
    case "impression":
      return currentRegion === "impression" ? current + 5 : 25;
    case "familiar":
      return currentRegion === "familiar" ? current + 10 : 50;
    case "memorized":
      return currentRegion === "memorized" ? current + 1 : 90;
  }
}

type Answer = "unknown" | "impression" | "familiar" | "memorized";
type Step = "reciting" | "finished" | "noWords";

export default function ReciteSessionPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { auth, user } = useAuth();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const count = Number(searchParams?.get("count") ?? 5);
  const mode = (searchParams?.get("mode") as Mode) ?? "random";
  const [mounted, setMounted] = useState(false);
  const [words, setWords] = useState<Word[]>([]);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [sessionWords, setSessionWords] = useState<Word[]>([]);
  const [srsStates, setSrsStates] = useState<Record<string, SrsState>>({});
  const [posTags, setPosTags] = useState<PartOfSpeechTag[]>([]);
  const [step, setStep] = useState<Step>("reciting");
  const [index, setIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const loadKey = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    const key = `${uid}-${wordbookId}`;
    if (loadKey.current === key) return;
    loadKey.current = key;
    const load = async () => {
      const all = await getWordsByWordbookId(uid, wordbookId);
      setWords(all);
      const states = await getAllSrsStates(uid, wordbookId, all);
      setSrsStates(states);
      const tags = await getPartOfSpeechTags(uid);
      setPosTags(tags);
      let drawn = drawWords(all, count, mode);
      if (drawn.length === 0 && mode.startsWith("only")) {
        setSessionWords([]);
        setUsedIds(new Set());
        setIndex(0);
        setShowDetails(false);
        setStep("noWords");
        return;
      }
      if (drawn.length === 0) {
        drawn = drawWords(all, count, "random");
      }
      setSessionWords(drawn);
      setUsedIds(new Set(drawn.map((w) => w.id)));
      setIndex(0);
      setShowDetails(false);
      setStep("reciting");
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, wordbookId]);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  const startSession = () => {
    let available = words.filter((w) => !usedIds.has(w.id));
    let newUsed = new Set(usedIds);
    if (available.length === 0) {
      available = [...words];
      newUsed = new Set();
    }
    let drawn = drawWords(available, count, mode);
    if (drawn.length === 0 && mode.startsWith("only")) {
      setSessionWords([]);
      setStep("noWords");
      return;
    }
    if (drawn.length === 0) {
      drawn = drawWords(words, count, "random");
      newUsed = new Set(drawn.map((w) => w.id));
    } else {
      drawn.forEach((w) => newUsed.add(w.id));
    }
    setSessionWords(drawn);
    setUsedIds(newUsed);
    setIndex(0);
    setShowDetails(false);
    setStep("reciting");
  };

  const handleMastery = async (choice: Answer) => {
    const word = sessionWords[index];
    if (!user?.uid) return;
    const newMastery = computeMastery(word.mastery, choice);
    const now = Timestamp.now();
    const newCount = (word.studyCount || 0) + 1;
    await updateWord(user.uid, wordbookId, word.id, {
      mastery: newMastery,
      reviewDate: now,
      studyCount: newCount,
    });
    const qualityMap: Record<Answer, 0 | 1 | 2 | 3> = {
      unknown: 0,
      impression: 1,
      familiar: 2,
      memorized: 3,
    };
    const state = srsStates[word.id];
    if (state) {
      const updated = await applySrsAnswer(
        user.uid,
        wordbookId,
        { ...word, mastery: newMastery, reviewDate: now },
        state,
        qualityMap[choice],
        false
      );
      setSrsStates((prev) => ({ ...prev, [word.id]: updated }));
    }
    setSessionWords((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...word,
        mastery: newMastery,
        reviewDate: now,
        studyCount: newCount,
      };
      return copy;
    });
    setWords((prev) => {
      const copy = [...prev];
      const i = copy.findIndex((w) => w.id === word.id);
      if (i !== -1)
        copy[i] = {
          ...word,
          mastery: newMastery,
          reviewDate: now,
          studyCount: newCount,
        };
      return copy;
    });
    next();
  };

  const next = useCallback(() => {
    if (index + 1 >= sessionWords.length) {
      setStep("finished");
    } else {
      setIndex(index + 1);
      setShowDetails(false);
    }
  }, [index, sessionWords.length]);

  const showAnswer = () => setShowDetails(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !showDetails) {
        e.preventDefault();
        setShowDetails(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showDetails]);

  const repeatSet = () => {
    setIndex(0);
    setShowDetails(false);
    setStep("reciting");
  };

  const nextSet = () => {
    startSession();
  };

  const completedCount = Math.min(index, sessionWords.length);
  const progressPercent =
    sessionWords.length > 0
      ? (completedCount / sessionWords.length) * 100
      : 0;
  const progressColor = `hsl(${(progressPercent / 100) * 120}, 70%, 50%)`;

  const highlight = (text: string) => {
    const target = sessionWords[index]?.word || "";
    if (!target) return text;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === target.toLowerCase() ? (
        <mark key={i} className="bg-yellow-100">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 text-base">
      <div className="flex items-center justify-between">
        <BackButton />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="outline" onClick={handleLogout} disabled={!auth}>
            <span suppressHydrationWarning>
              {mounted ? t("logout") : ""}
            </span>
          </Button>
        </div>
      </div>
      <h1 className="text-center text-3xl font-bold sm:text-4xl">
        <span suppressHydrationWarning>
          {mounted ? t("studyPage.recite") : ""}
        </span>
      </h1>

      {step === "reciting" && sessionWords.length > 0 && (
        <div className="max-w-md mx-auto space-y-4">
          <p className="text-center text-base text-muted-foreground">
            {t("recite.progress", {
              current: completedCount,
              total: sessionWords.length,
            })}
          </p>
          <div className="h-3 bg-muted rounded">
            <div
              className="h-3 rounded"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: progressColor,
              }}
            />
          </div>
          <div className="border rounded p-6 space-y-4 text-center">
            <div className="text-3xl font-bold">
              {sessionWords[index].word}
            </div>
            {showDetails ? (
              <>
                <div className="space-y-2 text-left text-lg">
                  <div className="text-3xl font-bold text-red-600">
                    {t("wordList.translation")}: {highlight(sessionWords[index].translation || "")}
                  </div>
                  <div>
                    {t("wordList.pinyin")}: {highlight(sessionWords[index].pinyin || "")}
                  </div>
                  {sessionWords[index].partOfSpeech.length > 0 && (
                    <div>
                      {t("wordList.partOfSpeech")}: {sessionWords[index].partOfSpeech
                        .map((id) => posTags.find((p) => p.id === id)?.name)
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                  <div className="whitespace-pre-line">
                    {t("wordList.example")}:{" "}
                    {highlight(sessionWords[index].exampleSentence || "")}
                  </div>
                  <div className="whitespace-pre-line">
                    {t("wordList.exampleTranslation")}:{" "}
                    {highlight(sessionWords[index].exampleTranslation || "")}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <Button
                    size="sm"
                    className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 text-base"
                    onClick={() => handleMastery("unknown")}
                  >
                    {t("wordList.masteryLevels.unknown")}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 text-base"
                    onClick={() => handleMastery("impression")}
                  >
                    {t("wordList.masteryLevels.impression")}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 text-base"
                    onClick={() => handleMastery("familiar")}
                  >
                    {t("wordList.masteryLevels.familiar")}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 text-base"
                    onClick={() => handleMastery("memorized")}
                  >
                    {t("wordList.masteryLevels.memorized")}
                  </Button>
                </div>
                <div className="space-y-1">
                  <p className="text-center text-sm text-muted-foreground">
                    {t("recite.masteryTitle")}
                  </p>
                  <div className="grid grid-cols-4 gap-1 text-xs text-muted-foreground">
                    <p className="text-center">
                      {t("recite.hints.unknown")}
                    </p>
                    <p className="text-center">
                      {t("recite.hints.impression")}
                    </p>
                    <p className="text-center">
                      {t("recite.hints.familiar")}
                    </p>
                    <p className="text-center">
                      {t("recite.hints.memorized")}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <Button className="w-full text-base" onClick={showAnswer}>
                {t("recite.showAnswer")}
              </Button>
            )}
          </div>
        </div>
      )}

      {step === "noWords" && (
        <div className="max-w-md mx-auto space-y-4 text-center">
          <p>{t(`recite.noWords.${mode}`)}</p>
          <Link href={`/wordbooks/${wordbookId}/study/recite`} className="w-full">
            <Button className="w-full" variant="outline">
              {t("recite.finish")}
            </Button>
          </Link>
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
            <Button
              onClick={repeatSet}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {t("recite.again")}
            </Button>
            <Button onClick={nextSet}>{t("recite.nextSet", { count })}</Button>
            <Link href={`/wordbooks/${wordbookId}/study`} className="w-full">
              <Button className="w-full" variant="outline">
                {t("recite.finish")}
              </Button>
            </Link>
            <Link href={`/wordbooks/${wordbookId}`} className="w-full">
              <Button className="w-full" variant="outline">
                {t("backToWordbook")}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

