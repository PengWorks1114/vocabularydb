"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AuthForm } from "@/components/auth-form";
import "@/i18n/i18n-client";

export default function Home() {
  const { t } = useTranslation();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center p-24 gap-4">
      <Button>{t("welcome")}</Button>
      <LanguageSwitcher />

      <Dialog open={isAuthOpen} onOpenChange={setIsAuthOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{t("login")}</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("login")}</DialogTitle>
            <DialogDescription>
              Log in to your account or create a new one.
            </DialogDescription>
          </DialogHeader>
          <AuthForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}
