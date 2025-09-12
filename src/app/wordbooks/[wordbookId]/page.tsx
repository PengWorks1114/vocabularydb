"use client";

import { use, useEffect, useState } from "react";
import { WordList } from "@/components/words/word-list";
import { useAuth } from "@/components/auth-provider";
import { getWordbook, type Wordbook } from "@/lib/firestore-service";
import { useQuery } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
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
  const { data: wb } = useQuery<Wordbook | null>({
    queryKey: ["wordbook", user?.uid, wordbookId],
    queryFn: () => getWordbook(user!.uid, wordbookId),
    enabled: !!user?.uid,
  });
  useEffect(() => {
    setName(wb?.name || "");
  }, [wb]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="p-2 sm:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <BackButton labelKey="backToList" />
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
