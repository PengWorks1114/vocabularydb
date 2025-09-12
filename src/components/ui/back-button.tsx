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
    const dest = `/${segments.join("/")}`;
    router.push(dest === "" ? "/" : dest);
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
