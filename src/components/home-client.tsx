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
import { useAuth } from "@/components/auth-provider";
import "@/i18n/i18n-client";
import { signOut } from "firebase/auth";

// ✅ 單字本清單元件
import WordbookList from "@/components/wordbooks/wordbook-list";

export default function HomeClient() {
  const { t } = useTranslation();
  const { user, loading, auth } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const handleAuthSuccess = () => setIsAuthOpen(false);
  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {user ? (
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold">歡迎，{user.email}！</p>
            <Button onClick={handleLogout} variant="outline">
              登出
            </Button>
          </div>

          {/* ✅ 單字本清單（讀取 / 新增 / 改名 / 刪除） */}
          <WordbookList />
        </div>
      ) : (
        <div className="flex min-h-[60vh] items-center justify-center gap-4">
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
              <AuthForm onSuccess={handleAuthSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
