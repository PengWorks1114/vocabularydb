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

// ⬇️ 引入 Firestore 服務
import { createWordbook } from "@/lib/firestore-service";

export default function HomeClient() {
  const { t } = useTranslation();
  const { user, loading, auth } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // 建立單字本時的 loading 狀態
  const [creating, setCreating] = useState(false);

  const handleAuthSuccess = () => setIsAuthOpen(false);
  const handleLogout = async () => {
    await signOut(auth);
  };

  // 手動建立測試用單字本
  const handleCreateWordbook = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const wb = await createWordbook(
        user.uid,
        "測試本 " + new Date().toLocaleTimeString()
      );
      console.log("✅ 手動建立成功：", wb);
    } catch (e) {
      console.error("❌ 手動建立失敗：", e);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-24 gap-4">
      {user ? (
        <>
          <p className="text-xl font-bold">歡迎，{user.email}！</p>
          <div className="flex gap-2">
            <Button onClick={handleLogout} variant="outline">
              登出
            </Button>
            {/* 測試建立單字本的按鈕 */}
            <Button onClick={handleCreateWordbook} disabled={creating}>
              {creating ? "建立中..." : "建立測試用單字本"}
            </Button>
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
