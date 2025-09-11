"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  getDueSrsWords,
  applySrsAnswer,
  type Word,
  type SrsState,
} from "@/lib/firestore-service";

interface Params {
  params: { wordbookId: string };
}

export default function SrsPage({ params }: Params) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [queue, setQueue] = useState<{ word: Word; state: SrsState }[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    getDueSrsWords(user.uid, params.wordbookId).then((items) => {
      setQueue(items);
      setTotal(items.length);
    });
  }, [user, params.wordbookId]);

  if (!queue.length) {
    return (
      <div className="p-4 text-center space-y-4">
        <h1 className="text-xl font-semibold">{t("srs.done")}</h1>
        <Link href={`/wordbooks/${params.wordbookId}`} className="text-blue-500">
          {t("backToWordbook")}
        </Link>
      </div>
    );
  }

  const current = queue[0];
  const progress = total - queue.length + 1;
  const overdue = Math.max(
    0,
    Math.floor(
      (Date.now() - current.state.dueDate.toDate().getTime()) / 86400000
    )
  );

  const handle = async (q: 0 | 1 | 2 | 3) => {
    if (!user) return;
    const newState = await applySrsAnswer(
      user.uid,
      params.wordbookId,
      current.word,
      current.state,
      q
    );
    const rest = queue.slice(1);
    if (q <= 1) rest.push({ word: current.word, state: newState });
    setQueue(rest);
  };

  return (
    <div className="p-4 flex flex-col items-center gap-4">
      <h1 className="text-xl font-semibold">{t("srs.title")}</h1>
      <div className="text-sm">
        {t("srs.progress", { current: progress, total })}
      </div>
      {overdue > 0 && (
        <div className="text-red-600 text-sm">
          {t("srs.overdue", { days: overdue })}
        </div>
      )}
      <div className="mt-4 text-2xl font-bold">{current.word.word}</div>
      <div className="text-xl text-red-600">
        {current.word.translation}
      </div>
      <div className="grid grid-cols-4 gap-2 w-full max-w-md mt-6">
        <Button onClick={() => handle(0)}>{t("srs.buttons.wrong")}</Button>
        <Button onClick={() => handle(1)}>{t("srs.buttons.hard")}</Button>
        <Button onClick={() => handle(2)}>{t("srs.buttons.good")}</Button>
        <Button onClick={() => handle(3)}>{t("srs.buttons.easy")}</Button>
      </div>
    </div>
  );
}

