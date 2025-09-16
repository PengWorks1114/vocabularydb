"use client";

import { use, useEffect, useRef, useState } from "react";
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
  const [range, setRange] = useState(30);
  const [selected, setSelected] = useState<Word | null>(null);
  const [posTags, setPosTags] = useState<PartOfSpeechTag[]>([]);

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
    if (logs.length === 0) return;
    const labels = Array.from({ length: range }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (range - 1 - i));
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    const reviewCounts = Array(range).fill(0);
    const masterySums = Array(range).fill(0);
    const masteryCounts = Array(range).fill(0);
    logs.forEach((l) => {
      const diff = Math.floor((Date.now() - l.ts.toMillis()) / 86400000);
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

    const dailyCanvas = document.getElementById("dailyChart") as HTMLCanvasElement | null;
    if (dailyCanvas) {
      dailyChartRef.current?.destroy();
      dailyChartRef.current = new Chart(dailyCanvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: `${t("srs.stats.avgMastery")} (${t("srs.stats.masteryUnit")})`,
              data: masteryAvg,
              borderColor: "#3b82f6",
              fill: false,
              yAxisID: "y1",
            },
            {
              label: `${t("srs.stats.dailyCount")} (${t("srs.stats.countUnit")})`,
              data: reviewCounts,
              borderColor: "#10b981",
              fill: false,
              yAxisID: "y",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              position: "left",
              title: { display: true, text: t("srs.stats.countUnit") },
            },
            y1: {
              position: "right",
              grid: { drawOnChartArea: false },
              title: { display: true, text: t("srs.stats.masteryUnit") },
              min: 0,
              max: 100,
            },
          },
        },
      });
    }

    const distCanvas = document.getElementById("distChart") as HTMLCanvasElement | null;
    if (distCanvas) {
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
    }
  }, [logs, range, t]);

  const topWeakMap: Record<string, { id: string; word: string; errors: number }> = {};
  logs.forEach((l) => {
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
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="range-select">
            {t("srs.stats.range")}
          </label>
          <select
            id="range-select"
            className="border p-1 rounded"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            {[7, 30, 90, 180, 365].map((r) => (
              <option key={r} value={r}>
                {t("srs.stats.days", { count: r })}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full h-64">
          <canvas id="dailyChart" className="w-full h-full" />
        </div>
        <p className="text-center text-sm">
          {t("srs.stats.pieTitle", { count: words.length })}
        </p>
        <div className="w-64 h-64 mx-auto">
          <canvas id="distChart" className="w-full h-full" />
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

