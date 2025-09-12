"use client";

import { FormEvent, use, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { signOut } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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

type Direction = "word" | "translation";

type Step = "dictating" | "finished" | "noWords";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawWords(
  all: Word[],
  count: number,
  mode: Mode,
  direction: Direction
): Word[] {
  let words = [...all];
  if (direction === "word") {
    words = words.filter((w) => w.translation);
  } else {
    words = words.filter((w) => w.word);
  }
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

function computeMastery(current: number, correct: boolean): number {
  if (correct) {
    return current >= 90 ? current + 1 : current + 10;
  }
  return Math.max(0, current - 25);
}

export default function DictationSessionPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { auth } = useAuth();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const count = Number(searchParams?.get("count") ?? 5);
  const mode = (searchParams?.get("mode") as Mode) ?? "random";
  const direction = (searchParams?.get("direction") as Direction) ?? "word";
  const [mounted, setMounted] = useState(false);
  const [words, setWords] = useState<Word[]>([]);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [sessionWords, setSessionWords] = useState<Word[]>([]);
  const [srsStates, setSrsStates] = useState<Record<string, SrsState>>({});
  const [posTags, setPosTags] = useState<PartOfSpeechTag[]>([]);
  const [step, setStep] = useState<Step>("dictating");
  const [index, setIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [input, setInput] = useState("");
  const [correct, setCorrect] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const loadKey = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
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
      let drawn = drawWords(all, count, mode, direction);
      if (drawn.length === 0 && mode.startsWith("only")) {
        setStep("noWords");
        setSessionWords([]);
        setUsedIds(new Set());
        setIndex(0);
        setShowDetails(false);
        return;
      }
      if (drawn.length === 0) {
        drawn = drawWords(all, count, "random", direction);
      }
      setSessionWords(drawn);
      setUsedIds(new Set(drawn.map((w) => w.id)));
      setIndex(0);
      setShowDetails(false);
      setInput("");
      setStep("dictating");
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.currentUser?.uid, wordbookId]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const startSession = () => {
    let available = words.filter((w) => !usedIds.has(w.id));
    let newUsed = new Set(usedIds);
    if (available.length === 0) {
      available = [...words];
      newUsed = new Set();
    }
    let drawn = drawWords(available, count, mode, direction);
    if (drawn.length === 0 && mode.startsWith("only")) {
      setSessionWords([]);
      setStep("noWords");
      return;
    }
    if (drawn.length === 0) {
      drawn = drawWords(words, count, "random", direction);
      newUsed = new Set(drawn.map((w) => w.id));
    } else {
      drawn.forEach((w) => newUsed.add(w.id));
    }
    setSessionWords(drawn);
    setUsedIds(newUsed);
    setIndex(0);
    setShowDetails(false);
    setInput("");
    setStep("dictating");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isComposing) return;
    const word = sessionWords[index];
    const answer =
      direction === "word" ? word.translation ?? "" : word.word ?? "";
    const isCorrect =
      input.trim().toLowerCase() === answer.trim().toLowerCase();
    setCorrect(isCorrect);
    if (!auth.currentUser) return;
    const newMastery = computeMastery(word.mastery, isCorrect);
    const now = Timestamp.now();
    const newCount = (word.studyCount || 0) + 1;
    await updateWord(auth.currentUser.uid, wordbookId, word.id, {
      mastery: newMastery,
      reviewDate: now,
      studyCount: newCount,
    });
    const state = srsStates[word.id];
    if (state) {
      const updated = await applySrsAnswer(
        auth.currentUser.uid,
        wordbookId,
        { ...word, mastery: newMastery, reviewDate: now },
        state,
        isCorrect ? 3 : 0,
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
    setShowDetails(true);
  };

  const next = useCallback(() => {
    if (index + 1 >= sessionWords.length) {
      setStep("finished");
    } else {
      setIndex(index + 1);
      setShowDetails(false);
      setInput("");
      setCorrect(null);
    }
  }, [index, sessionWords.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && showDetails) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showDetails, next]);

  useEffect(() => {
    if (step === "dictating") {
      const el = inputRef.current;
      if (el) {
        el.blur();
        setTimeout(() => el.focus(), 0);
      }
    }
  }, [index, step]);

  const repeatSet = () => {
    setIndex(0);
    setShowDetails(false);
    setInput("");
    setCorrect(null);
    setStep("dictating");
  };

  const nextSet = () => {
    startSession();
  };

  const progressPercent =
    sessionWords.length > 0
      ? ((index + (showDetails ? 1 : 0)) / sessionWords.length) * 100
      : 0;
  const progressColor = `hsl(${(progressPercent / 100) * 120}, 70%, 50%)`;

  const currentWord = sessionWords[index];
  const prompt = direction === "word" ? currentWord?.word : currentWord?.translation;
  const answerText =
    direction === "word" ? currentWord?.translation ?? "" : currentWord?.word ?? "";
  const answerChars = Array.from(answerText);

  const highlight = (text: string) => {
    const target = prompt || "";
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
          <Button variant="outline" onClick={handleLogout}>
            <span suppressHydrationWarning>
              {mounted ? t("logout") : ""}
            </span>
          </Button>
        </div>
      </div>
      <h1 className="text-center text-3xl font-bold sm:text-4xl">
        <span suppressHydrationWarning>
          {mounted ? t("studyPage.dictation") : ""}
        </span>
      </h1>

      {step === "dictating" && sessionWords.length > 0 && (
        <div className="max-w-md mx-auto space-y-4">
          <p className="text-center text-base text-muted-foreground">
            {t("dictation.progress", { current: index + 1, total: sessionWords.length })}
          </p>
          <div className="h-3 bg-muted rounded">
            <div
              className="h-3 rounded"
              style={{ width: `${progressPercent}%`, backgroundColor: progressColor }}
            />
          </div>
          <div className="border rounded p-6 space-y-4 text-center">
            <div className="text-3xl font-bold mb-12">{prompt}</div>
            {!showDetails ? (
              <form onSubmit={submit} className="space-y-4">
                <div
                  className="relative flex justify-center gap-2 text-2xl"
                  onClick={() => inputRef.current?.focus()}
                >
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isComposing) {
                        e.preventDefault();
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0"
                    autoComplete="off"
                  />
                  {answerChars.map((ch, i) =>
                    ch === " " ? (
                      <span key={i} className="w-4" />
                    ) : (
                      <span
                        key={i}
                        className="w-8 border-b-4 border-black text-center"
                      >
                        {input[i] ?? ""}
                      </span>
                    )
                  )}
                </div>
              </form>
            ) : (
              <div className="space-y-2 text-left text-lg">
                <div
                  className={`text-2xl font-bold text-center ${
                    correct ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {correct ? t("dictation.correct") : t("dictation.wrong")}
                </div>
                <div className="text-xl font-bold">
                  {t("wordList.word")}: {highlight(currentWord.word || "")}
                </div>
                <div className="text-xl font-bold text-red-600">
                  {t("wordList.translation")}: {highlight(currentWord.translation || "")}
                </div>
                <div>
                  {t("wordList.pinyin")}: {highlight(currentWord.pinyin || "")}
                </div>
                {currentWord.partOfSpeech.length > 0 && (
                  <div>
                    {t("wordList.partOfSpeech")}: {currentWord.partOfSpeech
                      .map((id) => posTags.find((p) => p.id === id)?.name)
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
                <div className="whitespace-pre-line">
                  {t("wordList.example")}:{" "}
                  {highlight(currentWord.exampleSentence || "")}
                </div>
                <div className="whitespace-pre-line">
                  {t("wordList.exampleTranslation")}:{" "}
                  {highlight(currentWord.exampleTranslation || "")}
                </div>
              </div>
            )}
            {showDetails && (
              <Button className="w-full text-base" onClick={next}>
                {t("dictation.next")}
              </Button>
            )}
          </div>
        </div>
      )}

      {step === "noWords" && (
        <div className="max-w-md mx-auto space-y-4 text-center">
          <p>{t(`recite.noWords.${mode}`)}</p>
          <Link href={`/wordbooks/${wordbookId}/study/dictation`} className="w-full">
            <Button className="w-full" variant="outline">
              {t("dictation.finish")}
            </Button>
          </Link>
        </div>
      )}

      {step === "finished" && (
        <div className="max-w-md mx-auto space-y-4 text-center">
          <p>
            {t("dictation.progress", {
              current: sessionWords.length,
              total: sessionWords.length,
            })}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={repeatSet}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {t("dictation.again")}
            </Button>
            <Button onClick={nextSet}>{t("dictation.nextSet", { count })}</Button>
            <Link href={`/wordbooks/${wordbookId}/study`} className="w-full">
              <Button className="w-full" variant="outline">
                {t("dictation.finish")}
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

