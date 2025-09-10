"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { WordList } from "@/components/words/word-list";
import { useAuth } from "@/components/auth-provider";
import { getWordbook } from "@/lib/firestore-service";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { useTranslation } from "react-i18next";

interface PageProps {
  params: Promise<{ wordbookId: string }>;
}

export default function WordbookPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { user, auth } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [mounted, setMounted] = useState(false);

  const loadKey = useRef<string>();
  useEffect(() => {
    if (!user?.uid) return;
    const key = `${user.uid}-${wordbookId}`;
    if (loadKey.current === key) return;
    loadKey.current = key;
    getWordbook(user.uid, wordbookId).then((wb) => setName(wb?.name || ""));
  }, [user?.uid, wordbookId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-muted-foreground"
          suppressHydrationWarning
        >
          &larr; {mounted ? t("backToList") : ""}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="outline" onClick={handleLogout}>
            <span suppressHydrationWarning>
              {mounted ? t("logout") : ""}
            </span>
          </Button>
        </div>
      </div>
      <h1 className="text-2xl font-bold">{name}</h1>
      <WordList wordbookId={wordbookId} />
    </div>
  );
}
