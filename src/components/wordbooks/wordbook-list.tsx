"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function WordbookList() {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Create new wordbook
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Rename
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Wordbook | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Wordbook | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    data: wordbooks = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<Wordbook[]>({
    queryKey: ["wordbooks", user?.uid],
    queryFn: () => getWordbooksByUserId(user!.uid),
    enabled: !!user?.uid,
  });
  const sortedWordbooks = useMemo(
    () =>
      wordbooks
        .slice()
        .sort((a: Wordbook, b: Wordbook) => b.createdAt.toMillis() - a.createdAt.toMillis()),
    [wordbooks]
  );

  const loadKey = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.uid) return;
    const key = `${user.uid}`;
    if (loadKey.current === key) return;
    loadKey.current = key;
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      await createWordbook(user.uid, newName.trim());
      setNewName("");
      await refetch();
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
      await refetch();
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
      await refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{t("wordbookList.title")}</h2>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">
          {t("wordbookList.loading")}
        </div>
      )}
      {error ? <div className="text-sm text-red-500">{String(error)}</div> : null}
      {!loading && !sortedWordbooks.length && (
        <div className="text-sm text-muted-foreground">
          {t("wordbookList.empty")}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="aspect-square flex flex-col">
          <CardHeader>
            <CardTitle>{t("wordbookList.create")}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center gap-3">
            <Input
              placeholder={t("wordbookList.namePlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </CardContent>
          <CardFooter className="mt-auto flex w-full">
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? t("wordbookList.creating") : t("wordbookList.create")}
            </Button>
          </CardFooter>
        </Card>

        {sortedWordbooks.map((wb: Wordbook) => (
          <Card key={wb.id} className="aspect-square flex flex-col">
            <CardHeader className="flex-1 flex items-start">
              <CardTitle className="line-clamp-3 text-lg">{wb.name}</CardTitle>
            </CardHeader>
            <CardFooter className="mt-auto flex flex-col gap-2">
              <Button
                asChild
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                <Link href={`/wordbooks/${wb.id}`}>
                  {t("wordbookList.view")}
                </Link>
              </Button>

              <div className="grid grid-cols-2 gap-2 w-full">
                <Dialog
                  open={renameOpen && renameTarget?.id === wb.id}
                  onOpenChange={(o) => {
                    if (!o) setRenameOpen(false);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => openRename(wb)}
                    >
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
                      className="w-full"
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
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
