"use client";

import Link from "next/link";
import { useEffect, useState, use as usePromise } from "react";
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
  const { wordbookId } = usePromise(params);
  const { user, auth } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    getWordbook(user.uid, wordbookId).then((wb) => setName(wb?.name || ""));
  }, [user, wordbookId]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted-foreground">
          &larr; {t("backToList")}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="outline" onClick={handleLogout}>
            {t("logout")}
          </Button>
        </div>
      </div>
      <h1 className="text-2xl font-bold">{name}</h1>
      <WordList wordbookId={wordbookId} />
    </div>
  );
}
