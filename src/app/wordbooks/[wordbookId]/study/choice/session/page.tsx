"use client";

import Link from "next/link";
import {
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
import { CheckCircle, XCircle } from "lucide-react";

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

type Step = "quizzing" | "finished" | "noWords";

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
  if (current >= 90) {
    return correct ? current + 1 : Math.max(0, current - 15);
  }
  return correct ? current + 5 : Math.max(0, current - 5);
}

export default function ChoiceSessionPage({ params }: PageProps) {
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
  const [step, setStep] = useState<Step>("quizzing");
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState<Word[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const loadKey = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadWords = useCallback(async () => {
    if (!auth.currentUser) return;
    const key = `${auth.currentUser.uid}-${wordbookId}`;
    if (loadKey.current === key) return;
    loadKey.current = key;
    const all = await getWordsByWordbookId(auth.currentUser.uid, wordbookId);
    setWords(all);
    const states = await getAllSrsStates(auth.currentUser.uid, wordbookId, all);
    setSrsStates(states);
    const tags = await getPartOfSpeechTags(auth.currentUser.uid);
    setPosTags(tags);
    const drawn = drawWords(all, count, mode, direction);
    setSessionWords(drawn);
    setUsedIds(new Set(drawn.map((w) => w.id)));
    if (drawn.length === 0) setStep("noWords");
    else setOptions(makeOptions(drawn, 0));
  }, [auth.currentUser, wordbookId, count, mode, direction]);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  const makeOptions = (list: Word[], idx: number): Word[] => {
    const current = list[idx];
    const others = list.filter((_, i) => i !== idx);
    const choices = shuffle(others).slice(0, 3);
    return shuffle([...choices, current]);
  };

  const handleSelect = async (choice: Word) => {
    if (!auth.currentUser) return;
    const word = sessionWords[index];
    const isCorrect = choice.id === word.id;
    setCorrect(isCorrect);
    const newMastery = computeMastery(word.mastery || 0, isCorrect);
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
    setShowResult(true);
  };

  const next = useCallback(() => {
    if (index + 1 >= sessionWords.length) {
      setStep("finished");
    } else {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      setOptions(makeOptions(sessionWords, nextIndex));
      setShowResult(false);
      setCorrect(null);
    }
  }, [index, sessionWords]);

  const repeatSet = () => {
    setIndex(0);
    setOptions(makeOptions(sessionWords, 0));
    setShowResult(false);
    setCorrect(null);
    setStep("quizzing");
  };

  const nextSet = async () => {
    if (!auth.currentUser) return;
    const remaining = words.filter((w) => !usedIds.has(w.id));
    if (remaining.length === 0) {
      setStep("finished");
      return;
    }
    const nextWords = drawWords(remaining, count, mode, direction);
    const newUsed = new Set(usedIds);
    nextWords.forEach((w) => newUsed.add(w.id));
    setUsedIds(newUsed);
    setSessionWords(nextWords);
    setIndex(0);
    setOptions(makeOptions(nextWords, 0));
    setShowResult(false);
    setCorrect(null);
    setStep("quizzing");
  };

  const progressPercent =
    sessionWords.length > 0
      ? ((index + (showResult ? 1 : 0)) / sessionWords.length) * 100
      : 0;
  const progressColor = `hsl(${(progressPercent / 100) * 120}, 70%, 50%)`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && showResult) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showResult, next]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <BackButton labelKey="recite.settingsTitle" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="outline" onClick={handleLogout}>
            <span suppressHydrationWarning>
              {mounted ? t("logout") : ""}
            </span>
          </Button>
        </div>
      </div>

      {step === "quizzing" && sessionWords.length > 0 && (
        <div className="max-w-md mx-auto space-y-4">
          <p className="text-center text-base text-muted-foreground">
            {t("recite.progress", {
              current: index + 1,
              total: sessionWords.length,
            })}
          </p>
          <div className="h-3 bg-muted rounded">
            <div
              className="h-3 rounded"
              style={{ width: `${progressPercent}%`, backgroundColor: progressColor }}
            />
          </div>
          <div className="border rounded p-6 space-y-4 text-center">
            <div className="text-3xl font-bold">
              {direction === "word"
                ? sessionWords[index].translation
                : sessionWords[index].word}
            </div>
            {!showResult ? (
              <div className="grid grid-cols-2 gap-2 mt-12">
                {options.map((o) => (
                  <Button
                    key={o.id}
                    variant="outline"
                    className="w-full bg-white border-gray-300 hover:bg-gray-100 text-base truncate"
                    onClick={() => handleSelect(o)}
                  >
                    {direction === "word" ? o.word : o.translation}
                  </Button>
                ))}
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  {correct ? (
                    <CheckCircle className="h-16 w-16 text-green-500" />
                  ) : (
                    <XCircle className="h-16 w-16 text-red-500" />
                  )}
                </div>
                <div className="text-2xl font-bold">
                  {correct
                    ? t("dictation.correct")
                    : t("dictation.wrong")}
                </div>
                <div className="space-y-2 text-left text-lg mt-4">
                  <div className="text-3xl font-bold text-red-600">
                    {direction === "word"
                      ? sessionWords[index].word
                      : sessionWords[index].translation}
                  </div>
                  <div>
                    {t("wordList.pinyin")}: {sessionWords[index].pinyin}
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
                    {t("wordList.example")}:
                    {" "}
                    {sessionWords[index].exampleSentence}
                  </div>
                  <div className="whitespace-pre-line">
                    {t("wordList.exampleTranslation")}:
                    {" "}
                    {sessionWords[index].exampleTranslation}
                  </div>
                </div>
                <Button className="w-full text-base" onClick={next}>
                  {t("recite.next")}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {step === "noWords" && (
        <div className="max-w-md mx-auto space-y-4 text-center">
          <p>{t(`recite.noWords.${mode}`)}</p>
          <Link
            href={`/wordbooks/${wordbookId}/study/recite`}
            className="w-full"
          >
            <Button className="w-full">{t("recite.finish")}</Button>
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

