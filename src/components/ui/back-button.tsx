"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n/i18n-client";

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const goBack = () => {
    const segments = pathname.split("/").filter(Boolean);
    segments.pop();
    if (segments.length === 0 || (segments.length === 1 && segments[0] === "wordbooks")) {
      router.push("/");
      return;
    }
    router.push(`/${segments.join("/")}`);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="text-sm text-muted-foreground"
      suppressHydrationWarning
    >
      &larr; {mounted ? t("backToPrevious") : ""}
    </button>
  );
}
