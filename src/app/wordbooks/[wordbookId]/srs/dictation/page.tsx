"use client";

import Link from "next/link";
import {
  FormEvent,
  use,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { signOut } from "firebase/auth";
import { useTranslation } from "react-i18next";
import "@/i18n/i18n-client";
import { useAuth } from "@/components/auth-provider";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import {
  applySrsAnswer,
  getAllSrsStates,
  getDueSrsWords,
  getPartOfSpeechTags,
  getWordsByWordbookId,
  type PartOfSpeechTag,
  type SrsState,
  type Word,
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
  | "reviewRecent"
  | "reviewOld"
  | "onlyUnknown"
  | "onlyImpression"
  | "onlyFamiliar"
  | "onlyMemorized"
  | "onlyFavorite";

type Direction = "word" | "translation";

type Step = "setup" | "dictating" | "finished" | "noWords";

type QueueItem = { word: Word; state: SrsState };

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
      words = words.filter((w) => (w.mastery || 0) < 25);
      break;
    case "onlyImpression":
      words = words.filter(
        (w) => (w.mastery || 0) >= 25 && (w.mastery || 0) < 50
      );
      break;
    case "onlyFamiliar":
      words = words.filter(
        (w) => (w.mastery || 0) >= 50 && (w.mastery || 0) < 90
      );
      break;
    case "onlyMemorized":
      words = words.filter((w) => (w.mastery || 0) >= 90);
      break;
    case "onlyFavorite":
      words = words.filter((w) => w.favorite);
      break;
  }

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
        (a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
      );
      break;
    case "old":
      words.sort(
        (a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)
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

export default function SrsDictationPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { auth, user } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("setup");
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<Mode>("random");
  const [direction, setDirection] = useState<Direction>("word");
  const [includeAll, setIncludeAll] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentItem, setCurrentItem] = useState<QueueItem | null>(null);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<
    { word: Word; correct: boolean; prompt: string; answer: string } | null
  >(null);
  const [posTags, setPosTags] = useState<PartOfSpeechTag[]>([]);
  const [allPairs, setAllPairs] = useState<QueueItem[] | null>(null);
  const [lastWords, setLastWords] = useState<Word[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const answerInputId = useId();
  const inputHintId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadPairs = async (): Promise<QueueItem[]> => {
    if (!user) return [];
    if (includeAll) {
      let stored = allPairs;
      if (!stored) {
        const words = await getWordsByWordbookId(user.uid, wordbookId);
        const states = await getAllSrsStates(user.uid, wordbookId, words);
        stored = words.map((w) => ({ word: w, state: states[w.id] }));
        setAllPairs(stored);
      }
      return stored ?? [];
    }
    return getDueSrsWords(user.uid, wordbookId);
  };

  const start = async () => {
    if (!user) return;
    const pairs = await loadPairs();
    if (posTags.length === 0) {
      const tags = await getPartOfSpeechTags(user.uid);
      setPosTags(tags);
    }
    const words = pairs.map((p) => p.word);
    let selected = drawWords(words, count, mode, direction);
    if (selected.length === 0 && mode.startsWith("only")) {
      setQueue([]);
      setCurrentItem(null);
      setTotal(0);
      setCompleted(0);
      setResult(null);
      setShowDetails(false);
      setStep("noWords");
      return;
    }
    if (selected.length === 0) {
      selected = drawWords(words, count, "random", direction);
    }
    const map = new Map(pairs.map((p) => [p.word.id, p] as const));
    const items = selected
      .map((w) => map.get(w.id))
      .filter(Boolean) as QueueItem[];
    if (items.length === 0) {
      setQueue([]);
      setCurrentItem(null);
      setTotal(0);
      setCompleted(0);
      setResult(null);
      setShowDetails(false);
      setStep("noWords");
      return;
    }
    setQueue(items.slice(1));
    setCurrentItem(items[0] ?? null);
    setTotal(items.length);
    setCompleted(0);
    setShowDetails(false);
    setResult(null);
    setInput("");
    setStep("dictating");
    setLastWords(items.map((item) => item.word));
  };

  const repeatSet = async () => {
    if (!user) return;
    if (lastWords.length === 0) {
      setQueue([]);
      setCurrentItem(null);
      setResult(null);
      setShowDetails(false);
      setInput("");
      setTotal(0);
      setCompleted(0);
      setStep("noWords");
      return;
    }
    const states = await getAllSrsStates(user.uid, wordbookId, lastWords);
    const items = lastWords
      .map((w) => ({ word: w, state: states[w.id] }))
      .filter((item) =>
        direction === "word" ? item.word.translation : item.word.word
      );
    if (items.length === 0) {
      setQueue([]);
      setCurrentItem(null);
      setTotal(0);
      setCompleted(0);
      setResult(null);
      setShowDetails(false);
      setStep("noWords");
      return;
    }
    setQueue(items.slice(1));
    setCurrentItem(items[0] ?? null);
    setTotal(items.length);
    setCompleted(0);
    setShowDetails(false);
    setResult(null);
    setInput("");
    setStep("dictating");
  };

  const nextSet = () => {
    void start();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isComposing) return;
    if (!user || !currentItem) return;
    const prompt =
      direction === "word"
        ? currentItem.word.word || ""
        : currentItem.word.translation || "";
    const answer =
      direction === "word"
        ? currentItem.word.translation || ""
        : currentItem.word.word || "";
    const normalizedInput = input.trim().toLowerCase();
    const normalizedAnswer = answer.trim().toLowerCase();
    const isCorrect = normalizedInput === normalizedAnswer;
    const newState = await applySrsAnswer(
      user.uid,
      wordbookId,
      currentItem.word,
      currentItem.state,
      isCorrect ? 3 : 0,
      true,
      "dictation"
    );
    if (!isCorrect) {
      setQueue((prev) => [...prev, { word: currentItem.word, state: newState }]);
    } else {
      setCompleted((prev) => prev + 1);
    }
    setShowDetails(true);
    setResult({ word: currentItem.word, correct: isCorrect, prompt, answer });
    setInput("");
    if (includeAll) {
      setAllPairs((prev) =>
        prev
          ? prev.map((item) =>
              item.word.id === currentItem.word.id
                ? { word: currentItem.word, state: newState }
                : item
            )
          : prev
      );
    }
    setLastWords((prev) =>
      prev.map((w) => (w.id === currentItem.word.id ? currentItem.word : w))
    );
  };

  const next = useCallback(() => {
    if (queue.length === 0) {
      setCurrentItem(null);
      setShowDetails(false);
      setResult(null);
      setInput("");
      setStep("finished");
    } else {
      const [nextItem, ...rest] = queue;
      setCurrentItem(nextItem);
      setQueue(rest);
      setShowDetails(false);
      setResult(null);
      setInput("");
      setTimeout(() => {
        const el = inputRef.current;
        if (el) el.focus();
      }, 0);
    }
  }, [queue, inputRef]);

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
    if (step === "dictating" && !showDetails) {
      const el = inputRef.current;
      if (el) {
        el.blur();
        setTimeout(() => el.focus(), 0);
      }
    }
  }, [step, showDetails, currentItem?.word.id, inputRef]);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  const progressPercent = total > 0 ? (completed / total) * 100 : 0;
  const progressColor = `hsl(${(progressPercent / 100) * 120}, 70%, 50%)`;
  const currentPrompt =
    direction === "word"
      ? currentItem?.word.word || ""
      : currentItem?.word.translation || "";
  const currentAnswer =
    direction === "word"
      ? currentItem?.word.translation || ""
      : currentItem?.word.word || "";
  const answerChars = Array.from(currentAnswer);
  const displayedPrompt = showDetails && result ? result.prompt : currentPrompt;

  const highlight = (text: string, target: string) => {
    if (!text || !target) return text;
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

  if (step === "setup") {
    return (
      <div className="p-4 space-y-4 max-w-sm mx-auto">
        <div className="flex items-center justify-between">
          <BackButton href={`/wordbooks/${wordbookId}/srs`} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="outline" onClick={handleLogout} disabled={!auth}>
              {t("logout")}
            </Button>
          </div>
        </div>
        <h1 className="text-xl font-semibold">
          {t("srs.dictationMode.settingsTitle")}
        </h1>
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
          <label className="block text-sm">
            {t("srs.dictationMode.direction")}
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
              className="mt-1 w-full border rounded p-2"
            >
              <option value="word">{t("dictation.directions.word")}</option>
              <option value="translation">
                {t("dictation.directions.translation")}
              </option>
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
          <Button onClick={() => void start()} className="flex-1">
            {t("srs.dictationMode.start")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "noWords") {
    return (
      <div className="p-4 space-y-4 max-w-sm mx-auto text-center">
        <div className="flex items-center justify-between">
          <BackButton href={`/wordbooks/${wordbookId}/srs`} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="outline" onClick={handleLogout} disabled={!auth}>
              {t("logout")}
            </Button>
          </div>
        </div>
        <p>{t("srs.dictationMode.noWords")}</p>
        <Button onClick={() => setStep("setup")}>{t("srs.back")}</Button>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/wordbooks/${wordbookId}/srs`}>
            {t("srs.backToMenu")}
          </Link>
        </Button>
      </div>
    );
  }

  if (step === "finished") {
    return (
      <div className="p-4 space-y-4 max-w-sm mx-auto text-center">
        <div className="flex items-center justify-between">
          <BackButton href={`/wordbooks/${wordbookId}/srs`} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="outline" onClick={handleLogout} disabled={!auth}>
              {t("logout")}
            </Button>
          </div>
        </div>
        <p>{t("srs.dictationMode.progress", { current: total, total })}</p>
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => void repeatSet()}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {t("dictation.again")}
          </Button>
          <Button onClick={nextSet}>{t("dictation.nextSet", { count })}</Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/wordbooks/${wordbookId}/srs`}>
              {t("srs.backToMenu")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/wordbooks/${wordbookId}`}>
              {t("backToWordbook")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 text-base">
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setShowDetails(false);
            setResult(null);
            setStep("setup");
          }}
          className="text-sm text-muted-foreground"
        >
          &larr; {t("srs.back")}
        </button>
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
          {mounted ? t("srs.modes.dictation") : ""}
        </span>
      </h1>
      <div className="max-w-md mx-auto space-y-4">
        <p className="text-center text-base text-muted-foreground">
          {t("srs.dictationMode.progress", { current: completed, total })}
        </p>
        <div className="h-3 bg-muted rounded">
          <div
            className="h-3 rounded"
            style={{ width: `${progressPercent}%`, backgroundColor: progressColor }}
          />
        </div>
        <div className="border rounded p-6 space-y-4 text-center">
          <div className="text-3xl font-bold mb-12">{displayedPrompt}</div>
          {!showDetails ? (
            <form onSubmit={submit} className="space-y-3">
              <label
                htmlFor={answerInputId}
                className="relative flex flex-wrap justify-center gap-3 rounded-2xl border-2 border-dashed border-muted-foreground/60 bg-muted/30 px-6 py-6 text-2xl font-semibold text-muted-foreground transition focus-within:border-primary focus-within:bg-background focus-within:text-foreground focus-within:shadow-sm cursor-text"
              >
                <span className="sr-only">{t("dictation.answerLabel")}</span>
                <input
                  id={answerInputId}
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isComposing) {
                      e.preventDefault();
                    }
                  }}
                  className="absolute inset-0 h-full w-full cursor-text opacity-0"
                  autoComplete="off"
                  aria-describedby={inputHintId}
                  aria-label={t("dictation.answerLabel")}
                />
                {input.length === 0 && (
                  <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 text-base font-normal text-muted-foreground/75">
                    {t("dictation.inputPlaceholder")}
                  </span>
                )}
                {answerChars.map((ch, i) =>
                  ch === " " ? (
                    <span
                      key={i}
                      aria-hidden="true"
                      className="inline-flex h-12 w-6 sm:w-8"
                    />
                  ) : (
                    <span
                      key={i}
                      aria-hidden="true"
                      className="inline-flex h-12 w-10 items-end justify-center border-b-4 border-muted-foreground text-3xl text-foreground sm:w-12"
                    >
                      {input[i] ?? ""}
                    </span>
                  )
                )}
              </label>
              <p id={inputHintId} className="text-sm text-muted-foreground">
                {t("dictation.inputHint")}
              </p>
            </form>
          ) : (
            result && (
              <div className="space-y-2 text-left text-lg">
                <div
                  className={`text-2xl font-bold text-center ${
                    result.correct ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {result.correct ? t("dictation.correct") : t("dictation.wrong")}
                </div>
                <div className="text-xl font-bold">
                  {t("wordList.word")}: {highlight(result.word.word || "", result.prompt)}
                </div>
                <div className="text-xl font-bold text-red-600">
                  {t("wordList.translation")}: {highlight(result.word.translation || "", result.prompt)}
                </div>
                <div>
                  {t("wordList.pinyin")}: {highlight(result.word.pinyin || "", result.prompt)}
                </div>
                {result.word.partOfSpeech.length > 0 && (
                  <div>
                    {t("wordList.partOfSpeech")}: {result.word.partOfSpeech
                      .map((id) => posTags.find((p) => p.id === id)?.name)
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
                <div className="whitespace-pre-line">
                  {t("wordList.example")}: {highlight(result.word.exampleSentence || "", result.prompt)}
                </div>
                <div className="whitespace-pre-line text-sm text-muted-foreground">
                  {t("wordList.exampleTranslation")}: {highlight(
                    result.word.exampleTranslation || "",
                    result.prompt
                  )}
                </div>
              </div>
            )
          )}
          {showDetails && (
            <Button className="w-full text-base" onClick={next}>
              {t("dictation.next")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
