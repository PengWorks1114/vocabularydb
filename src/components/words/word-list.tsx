"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  getWordsByWordbookId,
  createWord,
  updateWord,
  deleteWord,
  type Word,
} from "@/lib/firestore-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

interface WordListProps {
  wordbookId: string;
}

// 單字管理元件：顯示、建立、編輯、刪除
export function WordList({ wordbookId }: WordListProps) {
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新增
  const [creating, setCreating] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newPartOfSpeech, setNewPartOfSpeech] = useState("");
  const [newExampleSentence, setNewExampleSentence] = useState("");
  const [newExampleTranslation, setNewExampleTranslation] = useState("");
  const [newMastery, setNewMastery] = useState(0);
  const [newNote, setNewNote] = useState("");
  const [newFavorite, setNewFavorite] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // 編輯
  const [editTarget, setEditTarget] = useState<Word | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [editPartOfSpeech, setEditPartOfSpeech] = useState("");
  const [editExampleSentence, setEditExampleSentence] = useState("");
  const [editExampleTranslation, setEditExampleTranslation] = useState("");
  const [editMastery, setEditMastery] = useState(0);
  const [editNote, setEditNote] = useState("");
  const [editFavorite, setEditFavorite] = useState(false);
  const [updating, setUpdating] = useState(false);

  // 刪除
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWordsByWordbookId(user.uid, wordbookId);
      data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      setWords(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, wordbookId]);

  const resetCreateForm = () => {
    setNewWord("");
    setNewTranslation("");
    setNewPartOfSpeech("");
    setNewExampleSentence("");
    setNewExampleTranslation("");
    setNewMastery(0);
    setNewNote("");
    setNewFavorite(false);
  };

  const handleCreate = async () => {
    if (!user || !newWord.trim()) return;
    setCreating(true);
    try {
      await createWord(user.uid, wordbookId, {
        word: newWord.trim(),
        translation: newTranslation.trim(),
        partOfSpeech: newPartOfSpeech
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        exampleSentence: newExampleSentence.trim(),
        exampleTranslation: newExampleTranslation.trim(),
        mastery: Number(newMastery) || 0,
        note: newNote.trim(),
        favorite: newFavorite,
      });
      resetCreateForm();
      setCreateOpen(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (w: Word) => {
    setEditTarget(w);
    setEditWord(w.word);
    setEditTranslation(w.translation);
    setEditPartOfSpeech(w.partOfSpeech.join(", "));
    setEditExampleSentence(w.exampleSentence);
    setEditExampleTranslation(w.exampleTranslation);
    setEditMastery(w.mastery);
    setEditNote(w.note);
    setEditFavorite(w.favorite);
  };

  const handleUpdate = async () => {
    if (!user || !editTarget) return;
    setUpdating(true);
    try {
      await updateWord(user.uid, wordbookId, editTarget.id, {
        word: editWord.trim(),
        translation: editTranslation.trim(),
        partOfSpeech: editPartOfSpeech
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        exampleSentence: editExampleSentence.trim(),
        exampleTranslation: editExampleTranslation.trim(),
        mastery: Number(editMastery) || 0,
        note: editNote.trim(),
        favorite: editFavorite,
      });
      setEditTarget(null);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (wordId: string) => {
    if (!user) return;
    setDeletingId(wordId);
    try {
      await deleteWord(user.uid, wordbookId, wordId);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">載入中...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <Dialog open={createOpen} onOpenChange={(o) => {
        setCreateOpen(o);
        if (!o) resetCreateForm();
      }}>
        <DialogTrigger asChild>
          <Button>新增單字</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增單字</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="單字"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            className="mb-2"
          />
          <Input
            placeholder="翻譯"
            value={newTranslation}
            onChange={(e) => setNewTranslation(e.target.value)}
            className="mb-2"
          />
          <Input
            placeholder="詞性（以逗號分隔）"
            value={newPartOfSpeech}
            onChange={(e) => setNewPartOfSpeech(e.target.value)}
            className="mb-2"
          />
          <Input
            placeholder="例句"
            value={newExampleSentence}
            onChange={(e) => setNewExampleSentence(e.target.value)}
            className="mb-2"
          />
          <Input
            placeholder="例句翻譯"
            value={newExampleTranslation}
            onChange={(e) => setNewExampleTranslation(e.target.value)}
            className="mb-2"
          />
          <Input
            placeholder="備註"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="mb-2"
          />
          <Input
            type="number"
            placeholder="掌握度 (0-100)"
            value={newMastery}
            onChange={(e) => setNewMastery(Number(e.target.value))}
            className="mb-2"
          />
          <div className="flex items-center space-x-2">
            <input
              id="newFavorite"
              type="checkbox"
              className="h-4 w-4"
              checked={newFavorite}
              onChange={(e) => setNewFavorite(e.target.checked)}
            />
            <Label htmlFor="newFavorite">收藏</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newWord.trim()}>
              {creating ? "新增中..." : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!words.length ? (
        <div className="text-sm text-muted-foreground">尚無單字</div>
      ) : (
        <ul className="space-y-2">
          {words.map((w) => (
            <li key={w.id} className="flex items-center gap-2">
              <span className="font-medium">{w.word}</span>
              <span className="text-muted-foreground">- {w.translation}</span>

              <Dialog
                open={editTarget?.id === w.id}
                onOpenChange={(o) => {
                  if (!o) setEditTarget(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => openEdit(w)}>
                    編輯
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>編輯單字</DialogTitle>
                  </DialogHeader>
                  <Input
                    autoFocus
                    value={editWord}
                    onChange={(e) => setEditWord(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    value={editTranslation}
                    onChange={(e) => setEditTranslation(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    placeholder="詞性（以逗號分隔）"
                    value={editPartOfSpeech}
                    onChange={(e) => setEditPartOfSpeech(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    placeholder="例句"
                    value={editExampleSentence}
                    onChange={(e) => setEditExampleSentence(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    placeholder="例句翻譯"
                    value={editExampleTranslation}
                    onChange={(e) => setEditExampleTranslation(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    placeholder="備註"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    type="number"
                    placeholder="掌握度 (0-100)"
                    value={editMastery}
                    onChange={(e) => setEditMastery(Number(e.target.value))}
                    className="mb-2"
                  />
                  <div className="flex items-center space-x-2 mb-2">
                    <input
                      id="editFavorite"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={editFavorite}
                      onChange={(e) => setEditFavorite(e.target.checked)}
                    />
                    <Label htmlFor="editFavorite">收藏</Label>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setEditTarget(null)}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleUpdate}
                      disabled={updating || !editWord.trim()}
                    >
                      {updating ? "儲存中..." : "儲存"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    刪除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>確定要刪除「{w.word}」嗎？</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={() => setDeletingId(null)}
                    >
                      取消
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(w.id)}
                      disabled={deletingId === w.id}
                    >
                      {deletingId === w.id ? "刪除中..." : "刪除"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

