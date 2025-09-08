"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  getWordsByWordbookId,
  type Word,
} from "@/lib/firestore-service";

interface WordListProps {
  wordbookId: string;
}

// 簡單的單字列表顯示元件
export function WordList({ wordbookId }: WordListProps) {
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    getWordsByWordbookId(user.uid, wordbookId)
      .then((data) => {
        data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        setWords(data);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "讀取失敗");
      })
      .finally(() => setLoading(false));
  }, [user?.uid, wordbookId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">載入中...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }

  if (!words.length) {
    return <div className="text-sm text-muted-foreground">尚無單字</div>;
  }

  return (
    <ul className="space-y-2">
      {words.map((w) => (
        <li key={w.id} className="flex gap-2">
          <span className="font-medium">{w.word}</span>
          <span className="text-muted-foreground">- {w.translation}</span>
        </li>
      ))}
    </ul>
  );
}

