"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n/i18n-client";

interface BackButtonProps {
  labelKey?: string;
}

export function BackButton({ labelKey = "backToPrevious" }: BackButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-muted-foreground"
      suppressHydrationWarning
    >
      &larr; {mounted ? t(labelKey) : ""}
    </button>
  );
}
