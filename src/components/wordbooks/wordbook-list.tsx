"use client";

import { useEffect, useRef, useState } from "react";
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
  getTrashedWordbooksByUserId,
  createWordbook,
  deleteWordbook,
  trashWordbook,
  updateWordbookName,
  type Wordbook,
} from "@/lib/firestore-service";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function WordbookList({ trashed = false }: { trashed?: boolean }) {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create new wordbook
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Rename
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Wordbook | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Delete or trash
  const [deleteTarget, setDeleteTarget] = useState<Wordbook | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = trashed
        ? await getTrashedWordbooksByUserId(user.uid)
        : await getWordbooksByUserId(user.uid);
      data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      setWordbooks(data);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  const loadKey = useRef<string>();
  useEffect(() => {
    if (!user?.uid) return;
    const key = `${user.uid}-${trashed}`;
    if (loadKey.current === key) return;
    loadKey.current = key;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, trashed]);

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
      if (trashed) {
        await deleteWordbook(user.uid, deleteTarget.id);
      } else {
        await trashWordbook(user.uid, deleteTarget.id);
      }
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
      {!trashed && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("wordbookList.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder={t("wordbookList.namePlaceholder")}
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
                  {creating
                    ? t("wordbookList.creating")
                    : t("wordbookList.create")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />
        </>
      )}

      <div className="space-y-3">
        {loading && (
          <div className="text-sm text-muted-foreground">
            {t("wordbookList.loading")}
          </div>
        )}
        {error && <div className="text-sm text-red-500">{error}</div>}
        {!loading && !wordbooks.length && (
          <div className="text-sm text-muted-foreground">
            {trashed ? t("trash.empty") : t("wordbookList.empty")}
          </div>
        )}

        {wordbooks.map((wb) => (
          <Card key={wb.id}>
            <CardHeader>
              <CardTitle>{wb.name}</CardTitle>
            </CardHeader>
            <CardFooter className="flex gap-2 justify-end">
              <Button asChild variant="secondary">
                <Link href={`/wordbooks/${wb.id}`}>{t("wordbookList.view")}</Link>
              </Button>

              <Dialog
                open={renameOpen && renameTarget?.id === wb.id}
                onOpenChange={(o) => {
                  if (!o) setRenameOpen(false);
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => openRename(wb)}>
                    {t("wordbookList.rename")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("wordbookList.renameTitle")}</DialogTitle>
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
                      {t("wordbookList.cancel")}
                    </Button>
                    <Button
                      onClick={handleRename}
                      disabled={renaming || !renameValue.trim()}
                    >
                      {renaming
                        ? t("wordbookList.saving")
                        : t("wordbookList.save")}
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
                    {t("wordbookList.delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("wordbookList.confirmDelete", { name: wb.name })}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
                      {t("wordbookList.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting
                        ? t("wordbookList.deleting")
                        : t("wordbookList.delete")}
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
