"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useAuth } from "@/components/auth-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export default function DictationSettingsPage({ params }: PageProps) {
  const { wordbookId } = use(params);
  const { auth } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<Mode>("random");
  const [direction, setDirection] = useState<Direction>("word");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const start = () => {
    router.push(
      `/wordbooks/${wordbookId}/study/dictation/session?count=${count}&mode=${mode}&direction=${direction}`
    );
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/wordbooks/${wordbookId}/study`}
          className="text-sm text-muted-foreground"
          suppressHydrationWarning
        >
          &larr; {mounted ? t("backToStudy") : ""}
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
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center">
            <span suppressHydrationWarning>
              {mounted ? t("dictation.settingsTitle") : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="count-select">{t("recite.count")}</Label>
            <Select
              value={String(count)}
              onValueChange={(value) => setCount(Number(value))}
            >
              <SelectTrigger id="count-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20, 30].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mode-select">{t("recite.mode")}</Label>
            <Select
              value={mode}
              onValueChange={(value) => setMode(value as Mode)}
            >
              <SelectTrigger id="mode-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
                  <SelectItem key={m} value={m}>
                    {t(`recite.modes.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="direction-select">{t("dictation.direction")}</Label>
            <Select
              value={direction}
              onValueChange={(value) => setDirection(value as Direction)}
            >
              <SelectTrigger id="direction-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  ["word", "translation"] as Direction[]
                ).map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`dictation.directions.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={start}>
            {t("dictation.start")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
