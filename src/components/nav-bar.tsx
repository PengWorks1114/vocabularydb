"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function NavBar() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="flex items-center gap-4 border-b px-4 py-2">
      <Link
        href="/"
        className="font-medium"
        suppressHydrationWarning
      >
        {mounted ? t("nav.wordbooks") : ""}
      </Link>
      <Link
        href="/trash"
        className="font-medium"
        suppressHydrationWarning
      >
        {mounted ? t("nav.trash") : ""}
      </Link>
    </nav>
  );
}
