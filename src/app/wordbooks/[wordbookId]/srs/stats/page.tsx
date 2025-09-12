"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useTranslation } from "react-i18next";
import "@/i18n/i18n-client";
import {
  getWordsByWordbookId,
  getAllSrsStates,
  type Word,
  type SrsState,
} from "@/lib/firestore-service";
import { Chart } from "chart.js/auto";

interface PageProps {
  params: Promise<{ wordbookId: string }>;
}

export default function SrsStatsPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { user } = useAuth();
  const { t } = useTranslation();
  const [words, setWords] = useState<Word[]>([]);
  const [states, setStates] = useState<Record<string, SrsState>>({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const w = await getWordsByWordbookId(user.uid, wordbookId);
      const s = await getAllSrsStates(user.uid, wordbookId, w);
      setWords(w);
      setStates(s);
    };
    load();
  }, [user, wordbookId]);
  const dailyChartRef = useRef<Chart | null>(null);
  const distChartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (words.length === 0) return;
    const labels = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    const reviewCounts = Array(30).fill(0);
    const masterySums = Array(30).fill(0);
    const masteryCounts = Array(30).fill(0);
    words.forEach((w) => {
      if (!w.reviewDate) return;
      const diff = Math.floor(
        (Date.now() - w.reviewDate.toMillis()) / 86400000
      );
      if (diff >= 0 && diff < 30) {
        const idx = 29 - diff;
        reviewCounts[idx]++;
        const m = Math.min(100, w.mastery);
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
              label: t("srs.stats.avgMastery"),
              data: masteryAvg,
              borderColor: "#3b82f6",
              fill: false,
            },
            {
              label: t("srs.stats.dailyCount"),
              data: reviewCounts,
              borderColor: "#10b981",
              fill: false,
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
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
        options: { responsive: true, maintainAspectRatio: false },
      });
    }
  }, [words, t]);

  const topWeak = Object.entries(states)
    .sort((a, b) => b[1].lapses - a[1].lapses)
    .slice(0, 10)
    .map(([id, state]) => ({
      word: words.find((w) => w.id === id)?.word || "",
      lapses: state.lapses,
    }));

  return (
    <div className="p-4 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold">{t("srs.stats.title")}</h1>
      <Link href={`/wordbooks/${wordbookId}/srs`} className="text-blue-500">
        {t("backToStudy")}
      </Link>
      <div className="space-y-6">
        <div className="w-full h-64">
          <canvas id="dailyChart" className="w-full h-full" />
        </div>
        <div className="w-64 h-64 mx-auto">
          <canvas id="distChart" className="w-full h-full" />
        </div>
      </div>
      <div>
        <h2 className="font-semibold mb-2">{t("srs.stats.topWeak")}</h2>
        <ul className="list-disc pl-4 space-y-1">
          {topWeak.map((w) => (
            <li key={w.word} className="flex items-center justify-between">
              <span>{w.word}</span>
              <span>{w.lapses}</span>
              <Link
                href={`/wordbooks/${wordbookId}/srs`}
                className="text-blue-500 text-sm ml-2"
              >
                {t("srs.stats.reviewNow")}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

