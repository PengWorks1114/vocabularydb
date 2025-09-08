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
import { Star, ChevronUp, ChevronDown } from "lucide-react";

interface WordListProps {
  wordbookId: string;
}

// 單字管理元件：顯示、建立、編輯、刪除
export function WordList({ wordbookId }: WordListProps) {
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<"createdAt" | "mastery">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFavorites, setShowFavorites] = useState(false);

  const sortWords = (list: Word[]) => {
    return [...list].sort((a, b) => {
      const aVal =
        sortBy === "createdAt"
          ? a.createdAt?.toMillis() || 0
          : a.mastery || 0;
      const bVal =
        sortBy === "createdAt"
          ? b.createdAt?.toMillis() || 0
          : b.mastery || 0;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  };

  // 新增
  const [creating, setCreating] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newPinyin, setNewPinyin] = useState("");
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
  const [editPinyin, setEditPinyin] = useState("");
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

  const toggleSort = (column: "createdAt" | "mastery") => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  };

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWordsByWordbookId(user.uid, wordbookId);
      setWords(sortWords(data));
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

  useEffect(() => {
    setWords((prev) => sortWords(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir]);

  const resetCreateForm = () => {
    setNewWord("");
    setNewPinyin("");
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
      const created = await createWord(user.uid, wordbookId, {
        word: newWord.trim(),
        pinyin: newPinyin.trim(),
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
      setWords((prev) => sortWords([created, ...prev]));
      resetCreateForm();
      setCreateOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (w: Word) => {
    setEditTarget(w);
    setEditWord(w.word);
    setEditPinyin(w.pinyin || "");
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
      const updated = {
        word: editWord.trim(),
        pinyin: editPinyin.trim(),
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
      };
      await updateWord(user.uid, wordbookId, editTarget.id, updated);
      setWords((prev) =>
        sortWords(prev.map((w) => (w.id === editTarget.id ? { ...w, ...updated } : w)))
      );
      setEditTarget(null);
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
      setWords((prev) => sortWords(prev.filter((w) => w.id !== wordId)));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleFavorite = async (word: Word) => {
    if (!user) return;
    const newVal = !word.favorite;
    try {
      await updateWord(user.uid, wordbookId, word.id, { favorite: newVal });
      setWords((prev) =>
        sortWords(prev.map((w) => (w.id === word.id ? { ...w, favorite: newVal } : w)))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const changeMastery = async (word: Word, delta: number) => {
    if (!user) return;
    const newVal = Math.min(100, Math.max(0, (word.mastery || 0) + delta));
    try {
      await updateWord(user.uid, wordbookId, word.id, { mastery: newVal });
      setWords((prev) =>
        sortWords(prev.map((w) => (w.id === word.id ? { ...w, mastery: newVal } : w)))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const displayWords = showFavorites ? words.filter((w) => w.favorite) : words;
  const emptyMessage = showFavorites ? "尚無收藏單字" : "尚無單字";

  if (loading) {
    return <div className="text-sm text-muted-foreground">載入中...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Dialog open={createOpen} onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) resetCreateForm();
        }}>
          <DialogTrigger asChild>
            <Button>新增單字</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增單字</DialogTitle>
          </DialogHeader>
          <Label htmlFor="newWord" className="mb-1">單字</Label>
          <Input
            id="newWord"
            autoFocus
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            className="mb-2"
          />
          <Label htmlFor="newPinyin" className="mb-1">拼音</Label>
          <Input
            id="newPinyin"
            value={newPinyin}
            onChange={(e) => setNewPinyin(e.target.value)}
            className="mb-2"
          />
          <Label htmlFor="newTranslation" className="mb-1">翻譯</Label>
          <Input
            id="newTranslation"
            value={newTranslation}
            onChange={(e) => setNewTranslation(e.target.value)}
            className="mb-2"
          />
          <Label htmlFor="newPartOfSpeech" className="mb-1">詞性（以逗號分隔）</Label>
          <Input
            id="newPartOfSpeech"
            value={newPartOfSpeech}
            onChange={(e) => setNewPartOfSpeech(e.target.value)}
            className="mb-2"
          />
          <Label htmlFor="newExampleSentence" className="mb-1">例句</Label>
          <Input
            id="newExampleSentence"
            value={newExampleSentence}
            onChange={(e) => setNewExampleSentence(e.target.value)}
            className="mb-2"
          />
          <Label htmlFor="newExampleTranslation" className="mb-1">例句翻譯</Label>
          <Input
            id="newExampleTranslation"
            value={newExampleTranslation}
            onChange={(e) => setNewExampleTranslation(e.target.value)}
            className="mb-2"
          />
          <Label htmlFor="newNote" className="mb-1">備註</Label>
          <Input
            id="newNote"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="mb-2"
          />
          <Label htmlFor="newMastery" className="mb-1">掌握度 (0-100)</Label>
          <Input
            id="newMastery"
            type="number"
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
        <Button
          className={
            showFavorites
              ? "bg-black text-white hover:bg-black/90"
              : "bg-yellow-500 text-black hover:bg-yellow-600"
          }
          onClick={() => setShowFavorites((prev) => !prev)}
        >
          {showFavorites ? "顯示全部" : "顯示最愛"}
        </Button>
      </div>

      {!displayWords.length ? (
        <div className="text-sm text-muted-foreground">{emptyMessage}</div>
      ) : (
        <div className="w-full">
          <div className="min-w-[1000px] text-sm max-h-[70vh] overflow-y-auto">
            <div className="flex bg-muted sticky top-0 z-10">
              <div className="w-12 px-2 py-1 border-r border-gray-200">收藏</div>
              <div className="flex-1 min-w-0 px-2 py-1 border-r border-gray-200">單字</div>
              <div className="flex-1 min-w-0 px-2 py-1 border-r border-gray-200">拼音</div>
              <div className="flex-1 min-w-0 px-2 py-1 border-r border-gray-200">翻譯</div>
              <div className="flex-1 min-w-0 px-2 py-1 border-r border-gray-200">詞性</div>
              <div className="flex-[2] min-w-0 px-2 py-1 border-r border-gray-200">例句</div>
              <div className="flex-[2] min-w-0 px-2 py-1 border-r border-gray-200">例句翻譯</div>
              <div className="w-20 px-2 py-1 border-r border-gray-200">
                <button
                  className="flex items-center"
                  onClick={() => toggleSort("mastery")}
                >
                  掌握度
                  {sortBy === "mastery" ? (
                    sortDir === "desc" ? (
                      <ChevronDown className="h-4 w-4 ml-1" />
                    ) : (
                      <ChevronUp className="h-4 w-4 ml-1" />
                    )
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                  )}
                </button>
              </div>
              <div className="flex-1 min-w-0 px-2 py-1 border-r border-gray-200">備註</div>
              <div className="w-28 px-2 py-1 border-r border-gray-200">
                <button
                  className="flex items-center"
                  onClick={() => toggleSort("createdAt")}
                >
                  建立日期
                  {sortBy === "createdAt" ? (
                    sortDir === "desc" ? (
                      <ChevronDown className="h-4 w-4 ml-1" />
                    ) : (
                      <ChevronUp className="h-4 w-4 ml-1" />
                    )
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                  )}
                </button>
              </div>
              <div className="w-40 px-2 py-1">操作</div>
            </div>
            {displayWords.map((w) => (
              <div key={w.id} className="flex border-b items-start">
                <div className="w-12 px-2 py-2 text-center border-r border-gray-200">
                  <button onClick={() => toggleFavorite(w)} className="mx-auto">
                    <Star
                      className={`h-4 w-4 ${
                        w.favorite
                          ? "fill-yellow-500 text-yellow-500"
                          : "text-black"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex-1 min-w-0 break-words px-2 py-2 font-medium border-r border-gray-200">
                  {w.word}
                </div>
                <div className="flex-1 min-w-0 break-words px-2 py-2 border-r border-gray-200">
                  {w.pinyin || '-'}
                </div>
                <div className="flex-1 min-w-0 break-words px-2 py-2 border-r border-gray-200">
                  {w.translation || '-'}
                </div>
                <div className="flex-1 min-w-0 break-words px-2 py-2 border-r border-gray-200">
                  {w.partOfSpeech.join(', ') || '-'}
                </div>
                <div className="flex-[2] min-w-0 break-words px-2 py-2 border-r border-gray-200">
                  {w.exampleSentence || '-'}
                </div>
                <div className="flex-[2] min-w-0 break-words px-2 py-2 border-r border-gray-200">
                  {w.exampleTranslation || '-'}
                </div>
                <div className="w-20 px-2 py-2 flex items-center justify-center gap-1 border-r border-gray-200">
                  <span>{w.mastery}</span>
                  <div className="flex flex-col ml-1">
                    <button
                      className="p-0 hover:text-blue-500"
                      onClick={() => changeMastery(w, 1)}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      className="p-0 hover:text-blue-500"
                      onClick={() => changeMastery(w, -1)}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-w-0 break-words px-2 py-2 border-r border-gray-200">
                  {w.note || '-'}
                </div>
                <div className="w-28 px-2 py-2 border-r border-gray-200">
                  {w.createdAt?.toDate().toLocaleDateString() || '-'}
                </div>
                <div className="w-40 px-2 py-2">
                  <div className="flex gap-2">
                    <Dialog
                      open={editTarget?.id === w.id}
                      onOpenChange={(o) => {
                        if (!o) setEditTarget(null);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(w)}
                          aria-label="編輯"
                        >
                          ✏️
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>編輯單字</DialogTitle>
                        </DialogHeader>
                        <Label htmlFor="editWord" className="mb-1">單字</Label>
                        <Input
                          id="editWord"
                          autoFocus
                          value={editWord}
                          onChange={(e) => setEditWord(e.target.value)}
                          className="mb-2"
                        />
                        <Label htmlFor="editPinyin" className="mb-1">拼音</Label>
                        <Input
                          id="editPinyin"
                          value={editPinyin}
                          onChange={(e) => setEditPinyin(e.target.value)}
                          className="mb-2"
                        />
                        <Label htmlFor="editTranslation" className="mb-1">翻譯</Label>
                        <Input
                          id="editTranslation"
                          value={editTranslation}
                          onChange={(e) => setEditTranslation(e.target.value)}
                          className="mb-2"
                        />
                        <Label htmlFor="editPartOfSpeech" className="mb-1">詞性（以逗號分隔）</Label>
                        <Input
                          id="editPartOfSpeech"
                          value={editPartOfSpeech}
                          onChange={(e) => setEditPartOfSpeech(e.target.value)}
                          className="mb-2"
                        />
                        <Label htmlFor="editExampleSentence" className="mb-1">例句</Label>
                        <Input
                          id="editExampleSentence"
                          value={editExampleSentence}
                          onChange={(e) => setEditExampleSentence(e.target.value)}
                          className="mb-2"
                        />
                        <Label htmlFor="editExampleTranslation" className="mb-1">例句翻譯</Label>
                        <Input
                          id="editExampleTranslation"
                          value={editExampleTranslation}
                          onChange={(e) => setEditExampleTranslation(e.target.value)}
                          className="mb-2"
                        />
                        <Label htmlFor="editNote" className="mb-1">備註</Label>
                        <Input
                          id="editNote"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="mb-2"
                        />
                        <Label htmlFor="editMastery" className="mb-1">掌握度 (0-100)</Label>
                        <Input
                          id="editMastery"
                          type="number"
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
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label="刪除"
                        >
                          🗑️
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>確定要刪除「{w.word}」嗎？</AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeletingId(null)}>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

