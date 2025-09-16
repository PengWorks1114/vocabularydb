"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { signOut } from "firebase/auth";
import "@/i18n/i18n-client";
import {
  getWordsByWordbookId,
  getAllSrsStates,
  getReviewLogs,
  getPartOfSpeechTags,
  type Word,
  type SrsState,
  type ReviewLog,
  type PartOfSpeechTag,
} from "@/lib/firestore-service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Chart } from "chart.js/auto";
import type { ChartDataset } from "chart.js";

interface PageProps {
  params: Promise<{ wordbookId: string }>;
}

export default function SrsStatsPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { user, auth } = useAuth();
  const { t } = useTranslation();
  const [words, setWords] = useState<Word[]>([]);
  const [states, setStates] = useState<Record<string, SrsState>>({});
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [modeFilter, setModeFilter] = useState<"all" | "flashcards" | "dictation">(
    "all"
  );
  const [range, setRange] = useState(30);
  const [metricView, setMetricView] =
    useState<"both" | "counts" | "mastery">("both");
  const [selected, setSelected] = useState<Word | null>(null);
  const [posTags, setPosTags] = useState<PartOfSpeechTag[]>([]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const logMode = l.mode ?? "flashcards";
      return modeFilter === "all" || logMode === modeFilter;
    });
  }, [logs, modeFilter]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const w = await getWordsByWordbookId(user.uid, wordbookId);
      const s = await getAllSrsStates(user.uid, wordbookId, w);
      const l = await getReviewLogs(user.uid, wordbookId, 365);
      const tags = await getPartOfSpeechTags(user.uid);
      setWords(w);
      setStates(s);
      setLogs(l);
      setPosTags(tags);
    };
    load();
  }, [user, wordbookId]);
  const dailyChartRef = useRef<Chart | null>(null);
  const distChartRef = useRef<Chart | null>(null);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  useEffect(() => {
    const dailyCanvas = document.getElementById("dailyChart") as HTMLCanvasElement | null;
    if (!dailyCanvas) return;

    const labels = Array.from({ length: range }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (range - 1 - i));
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    const reviewCounts = Array(range).fill(0);
    const masterySums = Array(range).fill(0);
    const masteryCounts = Array(range).fill(0);
    const now = Date.now();
    filteredLogs.forEach((l) => {
      const diff = Math.floor((now - l.ts.toMillis()) / 86400000);
      if (diff >= 0 && diff < range) {
        const idx = range - 1 - diff;
        reviewCounts[idx]++;
        const m = Math.min(100, l.mastery);
        masterySums[idx] += m;
        masteryCounts[idx]++;
      }
    });
    const masteryAvg = masterySums.map((sum, i) =>
      masteryCounts[i] ? sum / masteryCounts[i] : 0
    );

    const showCounts = metricView === "both" || metricView === "counts";
    const showMastery = metricView === "both" || metricView === "mastery";
    const datasets: ChartDataset<"bar" | "line", number[]>[] = [];

    if (showCounts) {
      datasets.push({
        type: "bar",
        label: `${t("srs.stats.dailyCount")} (${t("srs.stats.countUnit")})`,
        data: reviewCounts,
        backgroundColor: "rgba(16, 185, 129, 0.6)",
        borderColor: "#10b981",
        borderWidth: 1,
        yAxisID: "y",
      });
    }

    if (showMastery) {
      datasets.push({
        type: "line",
        label: `${t("srs.stats.avgMastery")} (${t("srs.stats.masteryUnit")})`,
        data: masteryAvg,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        fill: false,
        tension: 0.3,
        yAxisID: "y1",
      });
    }

    const chartType = showCounts && !showMastery ? "bar" : "line";

    dailyChartRef.current?.destroy();
    dailyChartRef.current = new Chart(dailyCanvas, {
      type: chartType,
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            display: showCounts,
            beginAtZero: true,
            position: "left",
            title: { display: showCounts, text: t("srs.stats.countUnit") },
          },
          y1: {
            display: showMastery,
            position: showCounts ? "right" : "left",
            grid: { drawOnChartArea: !showCounts },
            title: { display: showMastery, text: t("srs.stats.masteryUnit") },
            min: 0,
            max: 100,
          },
        },
      },
    });
  }, [filteredLogs, range, t, metricView]);

  useEffect(() => {
    const distCanvas = document.getElementById("distChart") as HTMLCanvasElement | null;
    if (!distCanvas) return;

    let u = 0,
      i = 0,
      f = 0,
      m = 0;
    words.forEach((w) => {
      const score = Math.min(100, w.mastery);
      if (score >= 90) m++;
      else if (score >= 50) f++;
      else if (score >= 25) i++;
      else u++;
    });

    distChartRef.current?.destroy();
    distChartRef.current = new Chart(distCanvas, {
      type: "pie",
      data: {
        labels: [
          t("srs.stats.dist.unknown"),
          t("srs.stats.dist.impression"),
          t("srs.stats.dist.familiar"),
          t("srs.stats.dist.memorized"),
        ],
        datasets: [
          {
            label: t("srs.stats.wordUnit"),
            data: [u, i, f, m],
            backgroundColor: [
              "#ef4444",
              "#f59e0b",
              "#3b82f6",
              "#10b981",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed} ${t("srs.stats.wordUnit")}`,
            },
          },
        },
      },
    });
  }, [words, t]);

  useEffect(
    () => () => {
      dailyChartRef.current?.destroy();
      distChartRef.current?.destroy();
    },
    []
  );

  const topWeakMap: Record<string, { id: string; word: string; errors: number }> = {};
  filteredLogs.forEach((l) => {
    if (l.quality < 2) {
      const w = words.find((w) => w.id === l.wordId);
      if (!w) return;
      topWeakMap[l.wordId] = {
        id: l.wordId,
        word: w.word,
        errors: (topWeakMap[l.wordId]?.errors || 0) + 1,
      };
    }
  });
  const topWeak = Object.values(topWeakMap)
    .sort((a, b) => b.errors - a.errors)
    .slice(0, 10);

  const now = Date.now();
  const todayLogs = filteredLogs.filter(
    (l) => Math.floor((now - l.ts.toMillis()) / 86400000) === 0
  );
  const todayReviewCount = todayLogs.length;
  const todayWrongCount = todayLogs.filter((l) => l.quality === 0).length;
  const accuracyPercent = todayReviewCount
    ? Math.round(
        ((todayReviewCount - todayWrongCount) / todayReviewCount) * 100
      )
    : 0;
  const accuracyBarWidth = Math.max(0, Math.min(accuracyPercent, 100));
  const accuracyColor =
    todayReviewCount === 0
      ? "#94a3b8"
      : accuracyBarWidth >= 80
      ? "#22c55e"
      : accuracyBarWidth >= 50
      ? "#f59e0b"
      : "#ef4444";

  return (
    <div className="p-4 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <BackButton href={`/wordbooks/${wordbookId}`} />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="outline" onClick={handleLogout} disabled={!auth}>
            {t("logout")}
          </Button>
        </div>
      </div>
      <h1 className="text-xl font-semibold">{t("srs.stats.title")}</h1>
      <div className="space-y-6">
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="text-lg font-semibold">{t("srs.stats.todayTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("srs.stats.todaySummary", {
              count: todayReviewCount,
              wrong: todayWrongCount,
              accuracy: accuracyPercent,
            })}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{t("srs.stats.accuracyLabel")}</span>
              <span>{accuracyPercent}%</span>
            </div>
            <div className="h-2 w-full rounded bg-muted">
              <div
                className="h-2 rounded"
                style={{
                  width: `${accuracyBarWidth}%`,
                  backgroundColor: accuracyColor,
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm" htmlFor="range-select">
            {t("srs.stats.range")}
            <select
              id="range-select"
              className="border rounded p-1"
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
            >
              {[7, 30, 90, 180, 365].map((r) => (
                <option key={r} value={r}>
                  {t("srs.stats.days", { count: r })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm" htmlFor="metric-select">
            {t("srs.stats.metric")}
            <select
              id="metric-select"
              className="border rounded p-1"
              value={metricView}
              onChange={(e) =>
                setMetricView(e.target.value as "both" | "counts" | "mastery")
              }
            >
              <option value="both">{t("srs.stats.metricOptions.both")}</option>
              <option value="counts">{t("srs.stats.metricOptions.counts")}</option>
              <option value="mastery">{t("srs.stats.metricOptions.mastery")}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm" htmlFor="mode-select">
            {t("srs.stats.modeFilter")}
            <select
              id="mode-select"
              className="border rounded p-1"
              value={modeFilter}
              onChange={(e) =>
                setModeFilter(
                  e.target.value as "all" | "flashcards" | "dictation"
                )
              }
            >
              <option value="all">{t("srs.stats.modeOptions.all")}</option>
              <option value="flashcards">
                {t("srs.stats.modeOptions.flashcards")}
              </option>
              <option value="dictation">
                {t("srs.stats.modeOptions.dictation")}
              </option>
            </select>
          </label>
        </div>
        <div className="h-64 w-full">
          <canvas id="dailyChart" className="h-full w-full" />
        </div>
        <p className="text-center text-sm">
          {t("srs.stats.pieTitle", { count: words.length })}
        </p>
        <div className="mx-auto h-64 w-64">
          <canvas id="distChart" className="h-full w-full" />
        </div>
      </div>
      <div>
        <h2 className="font-semibold mb-2">{t("srs.stats.topWeak")}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="pb-1">{t("wordList.word")}</th>
              <th className="pb-1">{t("srs.stats.errors")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {topWeak.map((w) => (
              <tr key={w.id} className="border-t last:border-b">
                <td className="py-1">{w.word}</td>
                <td className="py-1 text-center">{w.errors}</td>
                <td className="py-1 text-right">
                  <button
                    onClick={() =>
                      setSelected(words.find((wd) => wd.id === w.id) || null)
                    }
                    className="text-blue-500 text-sm"
                  >
                    {t("srs.stats.reviewNow")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.word}</DialogTitle>
              </DialogHeader>
              {selected.pinyin && (
                <div className="text-muted-foreground">{selected.pinyin}</div>
              )}
              {selected.partOfSpeech.length > 0 && (
                <div>
                  {t("wordList.partOfSpeech")}: {selected.partOfSpeech
                    .map((id) => posTags.find((p) => p.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
              <div className="text-red-600">{selected.translation}</div>
              <div className="whitespace-pre-line">
                {selected.exampleSentence}
              </div>
              <div className="whitespace-pre-line text-sm text-muted-foreground">
                {selected.exampleTranslation}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

