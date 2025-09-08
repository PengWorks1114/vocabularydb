"use client";

import { useEffect, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  getWordbooksByUserId,
  createWordbook,
  deleteWordbook,
  updateWordbookName,
  type Wordbook,
} from "@/lib/firestore-service";
import { useAuth } from "@/components/auth-provider";

// ✅ 用 dynamic 並把 default 明確轉成元件型別，避免 TS 認不出 default
import dynamic from "next/dynamic";

// 明確宣告 props 型別，供 dynamic Generic 使用
type WordListProps = { wordbookId: string };

// ✅ 用命名匯出避免 TS 找不到 default
const WordList = dynamic<WordListProps>(
  () => import("@/components/words/word-list").then((m) => m.WordList),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">載入單字清單…</p>
    ),
  }
);

export default function WordbookList() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 新增
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // 改名
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Wordbook | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // 刪除
  const [deleteTarget, setDeleteTarget] = useState<Wordbook | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWordbooksByUserId(user.uid);
      data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      setWordbooks(data);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      await createWordbook(user.uid, newName.trim());
      setNewName("");
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const openRename = (wb: Wordbook) => {
    setRenameTarget(wb);
    setRenameValue(wb.name);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    if (!user || !renameTarget) return;
    if (!renameValue.trim() || renameValue.trim() === renameTarget.name) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    try {
      await updateWordbookName(user.uid, renameTarget.id, renameValue.trim());
      setRenameOpen(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWordbook(user.uid, deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>我的單字本</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="輸入單字本名稱..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? "建立中..." : "新增"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-3">
        {loading && (
          <div className="text-sm text-muted-foreground">載入中...</div>
        )}
        {error && <div className="text-sm text-red-500">{error}</div>}
        {!loading && !wordbooks.length && (
          <div className="text-sm text-muted-foreground">
            目前沒有單字本，先新增一個吧！
          </div>
        )}

        {wordbooks.map((wb) => (
          <Card key={wb.id}>
            <CardHeader>
              <CardTitle>{wb.name}</CardTitle>
            </CardHeader>
            <CardFooter className="flex gap-2 justify-end">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">查看單字</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>單字列表 - {wb.name}</DialogTitle>
                  </DialogHeader>
                  <WordList wordbookId={wb.id} />
                </DialogContent>
              </Dialog>

              <Dialog
                open={renameOpen && renameTarget?.id === wb.id}
                onOpenChange={(o) => {
                  if (!o) setRenameOpen(false);
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => openRename(wb)}>
                    改名
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>重新命名</DialogTitle>
                  </DialogHeader>
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename();
                    }}
                  />
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setRenameOpen(false)}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleRename}
                      disabled={renaming || !renameValue.trim()}
                    >
                      {renaming ? "儲存中..." : "儲存"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteTarget(wb)}
                  >
                    刪除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      確定要刪除「
                      {deleteTarget?.id === wb.id ? wb.name : wb.name}」嗎？
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
                      取消
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "刪除中..." : "刪除"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
