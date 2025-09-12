"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/components/auth-provider";
import {
  getWordsByWordbookId,
  createWord,
  updateWord,
  deleteWord,
  resetWordsProgress,
  bulkDeleteWords,
  getPartOfSpeechTags,
  createPartOfSpeechTag,
  updatePartOfSpeechTag,
  deletePartOfSpeechTag,
  getAllSrsStates,
  type Word,
  type PartOfSpeechTag,
  type SrsState,
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
import { Heart, Star, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

function masteryLevelMin(score: number) {
  if (score >= 90) return 90;
  if (score >= 50) return 50;
  if (score >= 25) return 25;
  return 0;
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const full = value >= i + 1;
        const half = !full && value >= i + 0.5;
        return (
          <button
            key={i}
            type="button"
            className="relative h-5 w-5"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const v = i + (x < rect.width / 2 ? 0.5 : 1);
              onChange(v === value ? 0 : v);
            }}
          >
            <Star className="h-5 w-5 text-gray-300" />
            {(full || half) && (
              <Star
                className="h-5 w-5 text-yellow-400 fill-yellow-400 absolute top-0 left-0"
                style={half ? { clipPath: "inset(0 50% 0 0)" } : {}}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface WordListProps {
  wordbookId: string;
}

const colorOptions = [
  { value: "gray", labelKey: "colors.gray" },
  { value: "brown", labelKey: "colors.brown" },
  { value: "orange", labelKey: "colors.orange" },
  { value: "yellow", labelKey: "colors.yellow" },
  { value: "green", labelKey: "colors.green" },
  { value: "blue", labelKey: "colors.blue" },
  { value: "purple", labelKey: "colors.purple" },
  { value: "pink", labelKey: "colors.pink" },
  { value: "red", labelKey: "colors.red" },
];

const colorClasses: Record<string, string> = {
  gray: "bg-gray-300 text-gray-900",
  brown: "bg-amber-700 text-amber-50",
  orange: "bg-orange-300 text-orange-900",
  yellow: "bg-yellow-300 text-yellow-900",
  green: "bg-green-300 text-green-900",
  blue: "bg-blue-300 text-blue-900",
  purple: "bg-purple-300 text-purple-900",
  pink: "bg-pink-300 text-pink-900",
  red: "bg-red-300 text-red-900",
};

const masteryOptions = [
  { key: "unknown", value: 0, cls: "bg-red-500 text-white" },
  { key: "impression", value: 25, cls: "bg-orange-500 text-white" },
  { key: "familiar", value: 50, cls: "bg-yellow-500 text-white" },
  { key: "memorized", value: 90, cls: "bg-green-600 text-white" },
];

type SortField =
  | "createdAt"
  | "reviewDate"
  | "mastery"
  | "usageFrequency"
  | "studyCount"
  | "dueDate"
  | "overdue";

const PER_PAGE = 20;

// Word management component: display, create, edit, delete
export function WordList({ wordbookId }: WordListProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [words, setWords] = useState<Word[]>([]);

  const [posTags, setPosTags] = useState<PartOfSpeechTag[]>([]);
  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("gray");

  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFavorites, setShowFavorites] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [tempTagFilter, setTempTagFilter] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [masteryQuickOpen, setMasteryQuickOpen] = useState(false);
  const [masteryQuickWord, setMasteryQuickWord] = useState<Word | null>(null);
  const [masteryQuickValue, setMasteryQuickValue] = useState(0);
  const [posQuickOpen, setPosQuickOpen] = useState(false);
  const [posQuickWord, setPosQuickWord] = useState<Word | null>(null);
  const [posQuickValue, setPosQuickValue] = useState<string[]>([]);
  const [usageQuickOpen, setUsageQuickOpen] = useState(false);
  const [usageQuickWord, setUsageQuickWord] = useState<Word | null>(null);
  const [usageQuickValue, setUsageQuickValue] = useState(0);
  const [srsStates, setSrsStates] = useState<Record<string, SrsState>>({});
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    getAllSrsStates(user.uid, wordbookId, words).then(setSrsStates);
  }, [user, wordbookId, words]);

  useEffect(() => {
    const adjust = () => {
      const cells = document.querySelectorAll(".header-cell") as NodeListOf<HTMLElement>;
      cells.forEach((c) => {
        c.classList.remove("text-xs");
        if (c.scrollWidth > c.clientWidth) {
          c.classList.add("text-xs");
        }
      });
    };
    adjust();
    window.addEventListener("resize", adjust);
    return () => window.removeEventListener("resize", adjust);
  }, [i18n.language]);

  const getColStyle = (key: string): React.CSSProperties | undefined =>
    colWidths[key] !== undefined
      ? { width: colWidths[key], flex: "none" }
      : undefined;

  const headerTextClass = "whitespace-nowrap overflow-hidden header-cell";

  const startResize = (
    key: string,
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    const parent = (e.target as HTMLElement).parentElement as HTMLElement;
    const startWidth = parent.getBoundingClientRect().width;
    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(40, startWidth + ev.clientX - startX);
      setColWidths((prev) => ({ ...prev, [key]: newWidth }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const sortedWords = useMemo(() => {
    return [...words].sort((a, b) => {
      let aVal: number;
      let bVal: number;
      if (sortBy === "createdAt") {
        aVal = a.createdAt?.toMillis() || 0;
        bVal = b.createdAt?.toMillis() || 0;
      } else if (sortBy === "reviewDate") {
        aVal = a.reviewDate?.toMillis() || 0;
        bVal = b.reviewDate?.toMillis() || 0;
      } else if (sortBy === "mastery") {
        aVal = a.mastery || 0;
        bVal = b.mastery || 0;
      } else if (sortBy === "studyCount") {
        aVal = a.studyCount || 0;
        bVal = b.studyCount || 0;
      } else if (sortBy === "dueDate") {
        aVal = srsStates[a.id]?.dueDate?.toMillis() || 0;
        bVal = srsStates[b.id]?.dueDate?.toMillis() || 0;
      } else if (sortBy === "overdue") {
        const today = Date.now();
        aVal = srsStates[a.id]?.dueDate ? today - srsStates[a.id].dueDate.toMillis() : 0;
        bVal = srsStates[b.id]?.dueDate ? today - srsStates[b.id].dueDate.toMillis() : 0;
      } else {
        aVal = a.usageFrequency || 0;
        bVal = b.usageFrequency || 0;
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [words, sortBy, sortDir, srsStates]);

  // Create
  const [creating, setCreating] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newPinyin, setNewPinyin] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newPartOfSpeech, setNewPartOfSpeech] = useState<string[]>([]);
  const [newExampleSentence, setNewExampleSentence] = useState("");
  const [newExampleTranslation, setNewExampleTranslation] = useState("");
  const [newSynonym, setNewSynonym] = useState("無");
  const [newAntonym, setNewAntonym] = useState("無");
  const [newUsageFrequency, setNewUsageFrequency] = useState(0);
  const [newMastery, setNewMastery] = useState(0);
  const [newNote, setNewNote] = useState("");
  const [newFavorite, setNewFavorite] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Edit
  const [editTarget, setEditTarget] = useState<Word | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editPinyin, setEditPinyin] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [editPartOfSpeech, setEditPartOfSpeech] = useState<string[]>([]);
  const [editExampleSentence, setEditExampleSentence] = useState("");
  const [editExampleTranslation, setEditExampleTranslation] = useState("");
  const [editSynonym, setEditSynonym] = useState("");
  const [editAntonym, setEditAntonym] = useState("");
  const [editUsageFrequency, setEditUsageFrequency] = useState(0);
  const [editMastery, setEditMastery] = useState(0);
  const [editNote, setEditNote] = useState("");
  const [editFavorite, setEditFavorite] = useState(false);
  const [editFocusField, setEditFocusField] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleNewTag = (id: string) => {
    setNewPartOfSpeech((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleEditTag = (id: string) => {
    setEditPartOfSpeech((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const openFilterDialog = () => {
    setTempTagFilter(tagFilter.length ? tagFilter : posTags.map((t) => t.id));
    setFilterOpen(true);
  };

  const toggleTempTag = (id: string) => {
    setTempTagFilter((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const applyTagFilter = () => {
    if (tempTagFilter.length === posTags.length) {
      setTagFilter([]);
    } else {
      setTagFilter(tempTagFilter);
    }
    setFilterOpen(false);
  };

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[\u30a1-\u30f6]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0x60)
      );

  const escapeRegExp = (str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const highlight = (text: string) => {
    if (!search.trim()) return text;
    const term = search.trim();
    const normText = normalize(text);
    const normTerm = normalize(term);
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let index = normText.indexOf(normTerm);
    if (index === -1) return text;
    while (index !== -1) {
      parts.push(text.slice(lastIndex, index));
      parts.push(
        <mark key={index} className="bg-yellow-200">
          {text.slice(index, index + normTerm.length)}
        </mark>
      );
      lastIndex = index + normTerm.length;
      index = normText.indexOf(normTerm, lastIndex);
    }
    parts.push(text.slice(lastIndex));
    return parts;
  };

  const highlightExample = (sentence: string, word: string) => {
    const segments = sentence.split("/");
    return segments.map((seg, i) => {
      const regex = word
        ? new RegExp(`(${escapeRegExp(word)})`, "gi")
        : null;
      const parts = regex ? seg.split(regex) : [seg];
      const rendered = parts.map((part, idx) => {
        const isWord = regex && part.toLowerCase() === word.toLowerCase();
        return isWord ? (
          <span key={idx} className="text-red-400">
            {highlight(part)}
          </span>
        ) : (
          <React.Fragment key={idx}>{highlight(part)}</React.Fragment>
        );
      });
      return (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {rendered}
        </React.Fragment>
      );
    });
  };

  const {
    data: fetchedWords,
    isLoading: loading,
    error,
  } = useQuery<Word[]>({
    queryKey: ["words", user?.uid, wordbookId],
    queryFn: () => getWordsByWordbookId(user!.uid, wordbookId),
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (fetchedWords) setWords(fetchedWords);
  }, [fetchedWords]);

  const tagKey = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.uid) return;
    if (tagKey.current === user.uid) return;
    tagKey.current = user.uid;
    getPartOfSpeechTags(user.uid).then(setPosTags);
  }, [user?.uid]);

  useEffect(() => {
    setPage(1);
  }, [sortBy, sortDir, search, showFavorites, tagFilter]);

  useEffect(() => {
    if (!bulkMode) setSelectedIds([]);
  }, [bulkMode]);

  const resetCreateForm = () => {
    setNewWord("");
    setNewPinyin("");
    setNewTranslation("");
    setNewPartOfSpeech([]);
    setNewExampleSentence("");
    setNewExampleTranslation("");
    setNewSynonym("無");
    setNewAntonym("無");
    setNewUsageFrequency(0);
    setNewMastery(0);
    setNewNote("");
    setNewFavorite(false);
  };

  const handleCreate = async () => {
    if (!user || !newWord.trim()) return;
    setCreating(true);
    try {
      const relatedWords =
        newSynonym.trim() || newAntonym.trim()
          ? {
              ...(newSynonym.trim() && { same: newSynonym.trim() }),
              ...(newAntonym.trim() && { opposite: newAntonym.trim() }),
            }
          : undefined;
      const created = await createWord(user.uid, wordbookId, {
        word: newWord.trim(),
        pinyin: newPinyin.trim(),
        translation: newTranslation.trim(),
        partOfSpeech: newPartOfSpeech,
        exampleSentence: newExampleSentence.trim(),
        exampleTranslation: newExampleTranslation.trim(),
        ...(relatedWords ? { relatedWords } : {}),
        usageFrequency: newUsageFrequency,
        mastery: Math.max(0, Number(newMastery) || 0),
        note: newNote.trim(),
        favorite: newFavorite,
      });
      setWords((prev) => [created, ...prev]);
      resetCreateForm();
      setCreateOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (w: Word, focusField?: string) => {
    setEditTarget(w);
    setEditWord(w.word);
    setEditPinyin(w.pinyin || "");
    setEditTranslation(w.translation);
    setEditPartOfSpeech(w.partOfSpeech || []);
    setEditExampleSentence(w.exampleSentence);
    setEditExampleTranslation(w.exampleTranslation);
    setEditSynonym(w.relatedWords?.same || "");
    setEditAntonym(w.relatedWords?.opposite || "");
    setEditUsageFrequency(w.usageFrequency || 0);
    setEditMastery(w.mastery || 0);
    setEditNote(w.note);
    setEditFavorite(w.favorite);
    setEditFocusField(focusField || null);
  };

  useEffect(() => {
    if (editTarget && editFocusField) {
      const id = editFocusField;
      const t = setTimeout(() => {
        document.getElementById(id)?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [editTarget, editFocusField]);

  const handleUpdate = async () => {
    if (!user || !editTarget) return;
    setUpdating(true);
    try {
      const relatedWords =
        editSynonym.trim() || editAntonym.trim()
          ? {
              ...(editSynonym.trim() && { same: editSynonym.trim() }),
              ...(editAntonym.trim() && { opposite: editAntonym.trim() }),
            }
          : undefined;
      const updated: Partial<Word> = {
        word: editWord.trim(),
        pinyin: editPinyin.trim(),
        translation: editTranslation.trim(),
        partOfSpeech: editPartOfSpeech,
        exampleSentence: editExampleSentence.trim(),
        exampleTranslation: editExampleTranslation.trim(),
        usageFrequency: editUsageFrequency,
        mastery: Math.max(0, Number(editMastery) || 0),
        note: editNote.trim(),
        favorite: editFavorite,
        relatedWords: relatedWords || {},
      };
      await updateWord(user.uid, wordbookId, editTarget.id, updated);
      setWords((prev) => prev.map((w) => (w.id === editTarget.id ? { ...w, ...updated } : w)));
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
      setWords((prev) => prev.filter((w) => w.id !== wordId));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleIncrementStudy = async (w: Word) => {
    if (!user) return;
    const newCount = (w.studyCount || 0) + 1;
    const newMastery = (w.mastery || 0) + 1;
    const now = Timestamp.now();
    try {
      await updateWord(user.uid, wordbookId, w.id, {
        studyCount: newCount,
        reviewDate: now,
        mastery: newMastery,
      });
      setWords((prev) =>
        prev.map((x) =>
          x.id === w.id
            ? { ...x, studyCount: newCount, reviewDate: now, mastery: newMastery }
            : x
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  const openMasteryQuick = (w: Word) => {
    setMasteryQuickWord(w);
    setMasteryQuickValue(w.mastery || 0);
    setMasteryQuickOpen(true);
  };

  const saveMasteryQuick = async () => {
    if (!user || !masteryQuickWord) return;
    try {
      await updateWord(user.uid, wordbookId, masteryQuickWord.id, {
        mastery: masteryQuickValue,
      });
      setWords((prev) =>
        prev.map((x) =>
          x.id === masteryQuickWord.id
            ? { ...x, mastery: masteryQuickValue }
            : x
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setMasteryQuickOpen(false);
      setMasteryQuickWord(null);
    }
  };

  const openPosQuick = (w: Word) => {
    setPosQuickWord(w);
    setPosQuickValue(w.partOfSpeech || []);
    setPosQuickOpen(true);
  };

  const togglePosQuick = (id: string) => {
    setPosQuickValue((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const savePosQuick = async () => {
    if (!user || !posQuickWord) return;
    try {
      await updateWord(user.uid, wordbookId, posQuickWord.id, {
        partOfSpeech: posQuickValue,
      });
      setWords((prev) =>
        prev.map((x) =>
          x.id === posQuickWord.id
            ? { ...x, partOfSpeech: posQuickValue }
            : x
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setPosQuickOpen(false);
      setPosQuickWord(null);
    }
  };

  const openUsageQuick = (w: Word) => {
    setUsageQuickWord(w);
    setUsageQuickValue(w.usageFrequency || 0);
    setUsageQuickOpen(true);
  };

  const saveUsageQuick = async () => {
    if (!user || !usageQuickWord) return;
    try {
      await updateWord(user.uid, wordbookId, usageQuickWord.id, {
        usageFrequency: usageQuickValue,
      });
      setWords((prev) =>
        prev.map((x) =>
          x.id === usageQuickWord.id
            ? { ...x, usageFrequency: usageQuickValue }
            : x
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setUsageQuickOpen(false);
      setUsageQuickWord(null);
    }
  };

  const handleInitProgress = async () => {
    if (!user || selectedIds.length === 0) return;
    if (!window.confirm(t("wordList.resetConfirm1"))) return;
    if (!window.confirm(t("wordList.resetConfirm2"))) return;
    try {
      await resetWordsProgress(user.uid, wordbookId, selectedIds);
      setWords((prev) =>
        prev.map((w) =>
          selectedIds.includes(w.id)
            ? { ...w, mastery: 0, studyCount: 0, reviewDate: null }
            : w
        )
      );
      setSrsStates((prev) => {
        const copy = { ...prev };
        selectedIds.forEach((id) => delete copy[id]);
        return copy;
      });
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkDelete = async () => {
    if (!user || selectedIds.length === 0) return;
    if (!window.confirm(t("wordList.deleteConfirm1"))) return;
    if (!window.confirm(t("wordList.deleteConfirm2"))) return;
    try {
      await bulkDeleteWords(user.uid, wordbookId, selectedIds);
      setWords((prev) => prev.filter((w) => !selectedIds.includes(w.id)));
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
    }
  };

  const exportCsv = (items: Word[], filename = wordbookId) => {
    const header =
      "word,pinyin,translation,partOfSpeech,exampleSentence,exampleTranslation,synonym,antonym,usageFrequency,mastery,note";
    const sanitize = (s: string) => s.replace(/,/g, " ").replace(/\n/g, " ");
    const lines = items.map((w) => {
      const parts = [
        w.word,
        w.pinyin || "",
        w.translation || "",
        w.partOfSpeech.join(";"),
        sanitize(w.exampleSentence || ""),
        sanitize(w.exampleTranslation || ""),
        w.relatedWords?.same || "",
        w.relatedWords?.opposite || "",
        String(w.usageFrequency ?? 0),
        String(w.mastery ?? 0),
        sanitize(w.note || ""),
      ];
      return parts.join(",");
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSelectedCsv = () => {
    const items = sortedWords.filter((w) => selectedIds.includes(w.id));
    exportCsv(items, `${wordbookId}-selected`);
  };

  const handleExportAllCsv = () => {
    exportCsv(sortedWords);
  };

  const toggleFavorite = async (word: Word) => {
    if (!user) return;
    const newVal = !word.favorite;
    try {
      await updateWord(user.uid, wordbookId, word.id, { favorite: newVal });
      setWords((prev) =>
        prev.map((w) => (w.id === word.id ? { ...w, favorite: newVal } : w))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTag = async () => {
    if (!user || !newTagName.trim()) return;
    try {
      const created = await createPartOfSpeechTag(user.uid, {
        name: newTagName.trim(),
        color: newTagColor,
      });
      setPosTags((prev) => [...prev, created]);
      setNewTagName("");
      setNewTagColor("gray");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!user) return;
    if (!window.confirm(t("wordList.deleteTagConfirm1"))) return;
    if (!window.confirm(t("wordList.deleteTagConfirm2"))) return;
    try {
      await deletePartOfSpeechTag(user.uid, id);
      setPosTags((prev) => prev.filter((t) => t.id !== id));
      setNewPartOfSpeech((p) => p.filter((t) => t !== id));
      setEditPartOfSpeech((p) => p.filter((t) => t !== id));
      setTagFilter((f) => f.filter((t) => t !== id));
      setTempTagFilter((f) => f.filter((t) => t !== id));
      setWords((prev) =>
        prev.map((w) => ({
          ...w,
          partOfSpeech: w.partOfSpeech.filter((t) => t !== id),
        }))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const displayWords = useMemo(
    () =>
      sortedWords.filter((w) => {
        if (showFavorites && !w.favorite) return false;
        if (tagFilter.length && !tagFilter.every((t) => w.partOfSpeech?.includes(t))) {
          return false;
        }
        if (!search.trim()) return true;
        const term = normalize(search.trim());
        return [
          w.word,
          w.translation,
          w.pinyin || "",
          w.exampleSentence || "",
          w.exampleTranslation || "",
          w.relatedWords?.same || "",
          w.relatedWords?.opposite || "",
        ].some((f) => normalize(f).includes(term));
      }),
    [sortedWords, showFavorites, tagFilter, search]
  );
  const totalPages = Math.max(1, Math.ceil(displayWords.length / PER_PAGE));
  const visibleWords = useMemo(
    () =>
      displayWords.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [displayWords, page]
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);
  const allSelected =
    visibleWords.length > 0 && visibleWords.every((w) => selectedIds.includes(w.id));
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !visibleWords.some((w) => w.id === id))
      );
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...visibleWords.map((w) => w.id)]))
      );
    }
  };
  const emptyMessage =
    search.trim() || tagFilter.length
      ? t("wordList.noMatchingWords")
      : showFavorites
      ? t("wordList.noFavoriteWords")
      : t("wordList.noWords");

  const overallMastery =
    words.length > 0
      ?
          words.reduce(
            (sum, w) => sum + Math.min(w.mastery || 0, 100),
            0
          ) /
          words.length
      : 0;
  const masteryColor = `hsl(${(overallMastery / 100) * 120}, 80%, 45%)`;

  if (loading || !mounted) {
    return (
      <div
        className="text-sm text-muted-foreground"
        suppressHydrationWarning
      >
        {mounted ? t("wordList.loading") : ""}
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-500">{String(error)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!bulkMode && (
            <Dialog open={createOpen} onOpenChange={(o) => {
              setCreateOpen(o);
              if (!o) resetCreateForm();
            }}>
              <DialogTrigger asChild>
                <Button>{t("wordList.addWord")}</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("wordList.addWord")}</DialogTitle>
                </DialogHeader>
          <Label htmlFor="newWord" className="mb-1">{t("wordList.word")}</Label>
          <Input
            id="newWord"
            autoFocus
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            className="mb-2"
          />
          <Label htmlFor="newPinyin" className="mb-1">{t("wordList.pinyin")}</Label>
          <Input
            id="newPinyin"
            value={newPinyin}
            onChange={(e) => setNewPinyin(e.target.value)}
            className="mb-2"
          />
          <Label htmlFor="newTranslation" className="mb-1">{t("wordList.translation")}</Label>
          <textarea
            id="newTranslation"
            value={newTranslation}
            onChange={(e) => setNewTranslation(e.target.value)}
            rows={3}
            className="mb-2 w-full rounded border px-2 py-1"
          />
          <Label className="mb-1">{t("wordList.partOfSpeech")}</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {posTags.map((tag) => (
              <label key={tag.id} className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={newPartOfSpeech.includes(tag.id)}
                  onChange={() => toggleNewTag(tag.id)}
                />
                <span
                  className={`px-1 rounded text-xs ${
                    colorClasses[tag.color] || colorClasses.gray
                  }`}
                >
                  {tag.name}
                </span>
              </label>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPosDialogOpen(true)}
            >
              {t("wordList.manageTags")}
            </Button>
          </div>
          <Label htmlFor="newExampleSentence" className="mb-1">{t("wordList.example")}</Label>
          <textarea
            id="newExampleSentence"
            value={newExampleSentence}
            onChange={(e) => setNewExampleSentence(e.target.value)}
            rows={3}
            className="mb-2 w-full rounded border px-2 py-1"
          />
          <Label htmlFor="newExampleTranslation" className="mb-1">{t("wordList.exampleTranslation")}</Label>
          <textarea
            id="newExampleTranslation"
            value={newExampleTranslation}
            onChange={(e) => setNewExampleTranslation(e.target.value)}
            rows={3}
            className="mb-2 w-full rounded border px-2 py-1"
          />
          <Label className="mb-1">{t("wordList.relatedWords")}</Label>
          <div className="mb-2 flex gap-2">
            <div className="flex-1">
              <div className="mb-1 text-xs">
                <span className="px-1 rounded bg-blue-100 text-blue-800">
                  {t("wordList.synonym")}
                </span>
              </div>
              <textarea
                id="newSynonym"
                value={newSynonym}
                onChange={(e) => setNewSynonym(e.target.value)}
                rows={3}
                className="w-full rounded border px-2 py-1"
              />
            </div>
            <div className="flex-1">
              <div className="mb-1 text-xs">
                <span className="px-1 rounded bg-gray-200 text-gray-800">
                  {t("wordList.antonym")}
                </span>
              </div>
              <textarea
                id="newAntonym"
                value={newAntonym}
                onChange={(e) => setNewAntonym(e.target.value)}
                rows={3}
                className="w-full rounded border px-2 py-1"
              />
            </div>
          </div>
          <Label className="mb-1">{t("wordList.usageFrequency")}</Label>
          <div className="mb-2 flex items-center gap-2">
            <StarRating value={newUsageFrequency} onChange={setNewUsageFrequency} />
            <span>{newUsageFrequency}⭐</span>
          </div>
          <Label htmlFor="newNote" className="mb-1">{t("wordList.note")}</Label>
          <textarea
            id="newNote"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
            className="mb-2 w-full rounded border px-2 py-1"
          />
          <Label className="mb-1">{t("wordList.mastery")}</Label>
          <div className="mb-2 flex flex-wrap gap-2">
            {masteryOptions.map((opt) => (
              <label
                key={opt.key}
                className={`${opt.cls} px-2 py-1 rounded cursor-pointer ${
                  newMastery === opt.value ? "ring-2 ring-offset-2 ring-black" : ""
                }`}
              >
                <input
                  type="radio"
                  name="newMastery"
                  className="sr-only"
                  checked={newMastery === opt.value}
                  onChange={() => setNewMastery(opt.value)}
                />
                {t(`wordList.masteryLevels.${opt.key}`)}
              </label>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <input
              id="newFavorite"
              type="checkbox"
              className="h-4 w-4"
              checked={newFavorite}
              onChange={(e) => setNewFavorite(e.target.checked)}
            />
            <Label htmlFor="newFavorite">{t("wordList.favorite")}</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("wordList.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newWord.trim()}>
              {creating ? t("wordList.creating") : t("wordList.create")}
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
        {!bulkMode && (
        <Button
          className={
            showFavorites
              ? "bg-black text-white hover:bg-black/90"
              : "bg-yellow-500 text-white hover:bg-yellow-600"
          }
          onClick={() => setShowFavorites((prev) => !prev)}
        >
          {showFavorites
            ? t("wordList.showAll")
            : t("wordList.showFavorites")}
        </Button>
        )}
        {!bulkMode && (
          <Button
            className="bg-orange-500 text-white hover:bg-orange-600"
            asChild
          >
            <Link href={`/wordbooks/${wordbookId}/study`}>
              {t("wordList.studyWords")}
            </Link>
          </Button>
        )}
        {bulkMode ? (
          <>
            <Button
              className="bg-red-700 text-white hover:bg-red-800"
              onClick={() => {
                setBulkMode(false);
                setSelectedIds([]);
              }}
            >
              {t("wordList.cancelManage")}
            </Button>
            <Button
              className="bg-blue-500 text-white hover:bg-blue-600"
              onClick={handleExportSelectedCsv}
              disabled={!selectedIds.length}
            >
              {t("wordList.exportCsv")}
            </Button>
            <Button
              className="bg-blue-500 text-white hover:bg-blue-600"
              onClick={handleExportAllCsv}
            >
              {t("wordList.exportAllCsv")}
            </Button>
            <Button
              className="bg-yellow-500 text-white hover:bg-yellow-600"
              onClick={handleInitProgress}
              disabled={!selectedIds.length}
            >
              {t("wordList.resetProgress")}
            </Button>
            <Button
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={handleBulkDelete}
              disabled={!selectedIds.length}
            >
              {t("wordList.bulkDelete")}
            </Button>
          </>
        ) : (
          <>
            <Button
              className="bg-green-500 text-white hover:bg-green-600"
              onClick={() => setBulkMode(true)}
            >
              {t("wordList.bulkManage")}
            </Button>
            <Button
              className="bg-blue-500 text-white hover:bg-blue-600"
              asChild
            >
              <Link href={`/wordbooks/${wordbookId}/import`}>
                {t("wordList.bulkImport")}
              </Link>
            </Button>
            <Button
              className="bg-purple-500 text-white hover:bg-purple-600"
              asChild
            >
              <Link href={`/wordbooks/${wordbookId}/srs`}>
                {t("wordList.srsStudy")}
              </Link>
            </Button>
          </>
        )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 sm:ml-auto shrink-0">
          <span>{t("wordList.wordCount", { count: words.length })}</span>
          <div className="flex items-center gap-2">
            <span>{t("wordList.overallMastery")}</span>
            <div className="h-2 w-24 rounded bg-gray-200">
              <div
                className="h-2 rounded"
                style={{ width: `${overallMastery}%`, backgroundColor: masteryColor }}
              />
            </div>
            <span>{overallMastery.toFixed(1)}%</span>
            <Button asChild variant="outline" size="sm">
              <Link href={`/wordbooks/${wordbookId}/srs/stats`}>
                {t("srs.stats.title")}
              </Link>
            </Button>
          </div>
          <select
            className="border rounded p-1 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
          >
            <option value="createdAt">{t("wordList.createdAt")}</option>
            <option value="reviewDate">{t("wordList.reviewDate")}</option>
            <option value="usageFrequency">{t("wordList.usageFrequency")}</option>
            <option value="mastery">{t("wordList.mastery")}</option>
            <option value="studyCount">{t("wordList.studyCount")}</option>
            <option value="dueDate">{t("wordList.dueDate")}</option>
            <option value="overdue">{t("wordList.overdueDays")}</option>
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={sortDir === "asc"}
              onChange={(e) => setSortDir(e.target.checked ? "asc" : "desc")}
            />
            {t("wordList.reverseOrder")}
          </label>
          <div className="flex items-center gap-1">
            <Input
              placeholder={t("wordList.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearch(searchInput);
                  setPage(1);
                }
              }}
              className="w-40"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                setSearch(searchInput);
                setPage(1);
              }}
              aria-label={t("wordList.searchButton")}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("wordList.manageTags")}</DialogTitle>
          </DialogHeader>
          {posTags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2 mb-2">
              <Input
                className="w-32"
                value={tag.name}
                onChange={(e) =>
                  setPosTags((prev) =>
                    prev.map((t) =>
                      t.id === tag.id ? { ...t, name: e.target.value } : t
                    )
                  )
                }
                onBlur={(e) => {
                  if (!user) return;
                  updatePartOfSpeechTag(user.uid, tag.id, {
                    name: e.target.value,
                  });
                }}
              />
              <select
                className="border rounded p-1 text-sm"
                value={tag.color}
                onChange={(e) => {
                  const color = e.target.value;
                  setPosTags((prev) =>
                    prev.map((t) =>
                      t.id === tag.id ? { ...t, color } : t
                    )
                  );
                  if (user) {
                    updatePartOfSpeechTag(user.uid, tag.id, { color });
                  }
                }}
              >
                {colorOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {t(c.labelKey)}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeleteTag(tag.id)}
              >
                {t("wordList.delete")}
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-4">
            <Input
              className="w-32"
              placeholder={t("wordList.newTag")}
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <select
              className="border rounded p-1 text-sm"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
            >
              {colorOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.labelKey)}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={handleAddTag} disabled={!newTagName.trim()}>
              {t("wordList.add")}
            </Button>
          </div>
      </DialogContent>
      </Dialog>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("wordList.filterTags")}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTempTagFilter(posTags.map((t) => t.id))}
            >
              {t("wordList.selectAllTags")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setTempTagFilter((prev) =>
                  posTags
                    .filter((t) => !prev.includes(t.id))
                    .map((t) => t.id)
                )
              }
            >
              {t("wordList.clearAllTags")}
            </Button>
          </div>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {posTags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 p-2 border rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={tempTagFilter.includes(tag.id)}
                  onChange={() => toggleTempTag(tag.id)}
                />
                <span
                  className={`px-2 py-1 rounded text-sm ${
                    colorClasses[tag.color] || colorClasses.gray
                  }`}
                >
                  {tag.name}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFilterOpen(false)}>
              {t("wordList.cancel")}
            </Button>
            <Button onClick={applyTagFilter}>{t("wordList.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-full overflow-x-auto">
        <div ref={listRef} className="min-w-[1400px] text-sm max-h-[70vh] overflow-y-auto">
          <div className="flex bg-muted sticky top-0 z-10">
            {bulkMode && (
              <div className="w-10 px-2 py-1 border-r border-gray-200 flex items-center justify-center">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
              </div>
            )}
            <div
              data-col="favorite"
              className={`relative w-12 px-2 py-1 border-r border-gray-200 col-favorite col-header ${headerTextClass}`}
              style={getColStyle("favorite")}
            >
              {t("wordList.favorite")}
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("favorite", e)}
              />
            </div>
            <div
              data-col="word"
              className={`relative flex-[2] min-w-0 px-2 py-1 border-r border-gray-200 col-word col-header ${headerTextClass}`}
              style={getColStyle("word")}
            >
              <div className={`flex items-center ${headerTextClass}`}>{t("wordList.word")}</div>
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("word", e)}
              />
            </div>
            <div
              data-col="pinyin"
              className={`relative flex-[2] min-w-0 px-2 py-1 border-r border-gray-200 col-pinyin col-header ${headerTextClass}`}
              style={getColStyle("pinyin")}
            >
              {t("wordList.pinyin")}
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("pinyin", e)}
              />
            </div>
            <div
              data-col="translation"
              className={`relative flex-[2] min-w-0 px-2 py-1 border-r border-gray-200 col-translation col-header ${headerTextClass}`}
              style={getColStyle("translation")}
            >
              {t("wordList.translation")}
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("translation", e)}
              />
            </div>
            <div
              data-col="part"
              className={`relative w-20 px-2 py-1 border-r border-gray-200 col-part col-header ${headerTextClass}`}
              style={getColStyle("part")}
            >
              <button className={`flex items-center ${headerTextClass}`} onClick={openFilterDialog}>
                {t("wordList.partOfSpeech")}
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("part", e)}
              />
            </div>
            <div
              data-col="example"
              className={`relative flex-[5] min-w-0 px-2 py-1 border-r border-gray-200 col-example col-header ${headerTextClass}`}
              style={getColStyle("example")}
            >
              {t("wordList.example")}
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("example", e)}
              />
            </div>
            <div
              data-col="exampleTranslation"
              className={`relative flex-[5] min-w-0 px-2 py-1 border-r border-gray-200 col-exampleTranslation col-header ${headerTextClass}`}
              style={getColStyle("exampleTranslation")}
            >
              {t("wordList.exampleTranslation")}
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("exampleTranslation", e)}
              />
            </div>
            <div
              data-col="related"
              className={`relative flex-[2] min-w-0 px-2 py-1 border-r border-gray-200 col-related col-header ${headerTextClass}`}
              style={getColStyle("related")}
            >
              {t("wordList.relatedWords")}
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("related", e)}
              />
            </div>
            <div
              data-col="mastery"
              className={`relative w-20 px-2 py-1 border-r border-gray-200 col-mastery col-header ${headerTextClass}`}
              style={getColStyle("mastery")}
            >
              {t("wordList.mastery")}
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("mastery", e)}
              />
            </div>
            <div
              data-col="note"
              className={`relative flex-[6] min-w-0 px-2 py-1 border-r border-gray-200 col-note col-header ${headerTextClass}`}
              style={getColStyle("note")}
            >
              {t("wordList.note")}
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("note", e)}
              />
            </div>
            <div
              data-col="reviewDate"
              className={`relative w-[5.4rem] px-2 py-1 border-r border-gray-200 col-reviewDate col-header ${headerTextClass}`}
              style={getColStyle("reviewDate")}
            >
              {t("wordList.reviewDate")}
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("reviewDate", e)}
              />
            </div>
            <div
              data-col="createdAt"
              className={`relative w-20 px-2 py-1 border-r border-gray-200 col-createdAt col-header ${headerTextClass}`}
              style={getColStyle("createdAt")}
            >
              {t("wordList.createdAt")}
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => startResize("createdAt", e)}
              />
            </div>
            <div
              data-col="actions"
              className={`relative w-28 px-2 py-1 col-actions col-header ${headerTextClass}`}
              style={getColStyle("actions")}
            >
              {t("wordList.actions")}
            </div>
          </div>
          {visibleWords.length ? (
            visibleWords.map((w) => (
              <div key={w.id} className="flex border-b">
                {bulkMode && (
                  <div className="w-10 px-2 py-2 border-r border-gray-200 flex items-center justify-center overflow-hidden">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedIds.includes(w.id)}
                      onChange={() => toggleSelect(w.id)}
                    />
                  </div>
                )}
                <div
                  className="w-12 px-2 py-2 text-center border-r border-gray-200 overflow-hidden col-favorite"
                  style={getColStyle("favorite")}
                >
                  <button onClick={() => toggleFavorite(w)} className="mx-auto">
                    <Heart
                      className={`h-4 w-4 ${
                        w.favorite
                          ? "fill-red-500 text-red-500"
                          : "text-red-500"
                      }`}
                    />
                  </button>
                </div>
                <div
                  className="flex-[2] min-w-0 break-words px-2 py-2 font-medium border-r border-gray-200 overflow-hidden col-word"
                  style={getColStyle("word")}
                  onDoubleClick={() => openEdit(w, "editWord")}
                >
                  <div className="flex items-center gap-1">
                    <span>{w.word}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <button onClick={() => openUsageQuick(w)} className="text-yellow-500">
                      <Star className="h-4 w-4" />
                    </button>
                    <span>{w.usageFrequency || 0}</span>
                  </div>
                </div>
                <div
                  className="flex-[2] min-w-0 break-words px-2 py-2 border-r border-gray-200 overflow-hidden col-pinyin"
                  style={getColStyle("pinyin")}
                  onDoubleClick={() => openEdit(w, "editPinyin")}
                >
                  {highlight(w.pinyin || "-")}
                </div>
                <div
                  className="flex-[2] min-w-0 break-words whitespace-pre-line px-2 py-2 border-r border-gray-200 overflow-hidden col-translation"
                  style={getColStyle("translation")}
                  onDoubleClick={() => openEdit(w, "editTranslation")}
                >
                  {highlight(w.translation || "-")}
                </div>
                <div
                  className="w-20 min-w-0 break-words px-2 py-2 border-r border-gray-200 cursor-pointer overflow-hidden col-part"
                  style={getColStyle("part")}
                  onClick={() => openPosQuick(w)}
                >
                  {w.partOfSpeech.length ? (
                    <div className="flex flex-col gap-1">
                      {w.partOfSpeech.map((id) => {
                        const tag = posTags.find((t) => t.id === id);
                        return (
                          <span
                            key={id}
                            className={`inline-block px-1 rounded text-xs ${
                              colorClasses[tag?.color || "gray"]
                            }`}
                          >
                            {tag?.name || id}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    "-"
                  )}
                </div>
                <div
                  className="flex-[5] min-w-0 break-words whitespace-pre-line px-2 py-2 border-r border-gray-200 overflow-hidden col-example"
                  style={getColStyle("example")}
                  onDoubleClick={() => openEdit(w, "editExampleSentence")}
                >
                  {highlightExample(w.exampleSentence || "-", w.word)}
                </div>
                <div
                  className="flex-[5] min-w-0 break-words whitespace-pre-line px-2 py-2 border-r border-gray-200 overflow-hidden col-exampleTranslation"
                  style={getColStyle("exampleTranslation")}
                  onDoubleClick={() => openEdit(w, "editExampleTranslation")}
                >
                  {highlightExample(w.exampleTranslation || "-", w.word)}
                </div>
                <div
                  className="flex-[2] min-w-0 break-words px-2 py-2 border-r border-gray-200 overflow-hidden col-related"
                  style={getColStyle("related")}
                  onDoubleClick={() => openEdit(w, "editSynonym")}
                >
                  <div className="space-y-1">
                    {w.relatedWords?.same && (
                      <div className="flex items-start text-xs gap-1">
                        <span className="px-1 rounded bg-blue-100 text-blue-800">
                          {t("wordList.synonym")}
                        </span>
                        <span className="flex-1 min-w-0 break-words whitespace-pre-wrap">
                          {highlight(w.relatedWords.same)}
                        </span>
                      </div>
                    )}
                    {w.relatedWords?.opposite && (
                      <div className="flex items-start text-xs gap-1">
                        <span className="px-1 rounded bg-gray-200 text-gray-800">
                          {t("wordList.antonym")}
                        </span>
                        <span className="flex-1 min-w-0 break-words whitespace-pre-wrap">
                          {highlight(w.relatedWords.opposite)}
                        </span>
                      </div>
                    )}
                    {!w.relatedWords?.same && !w.relatedWords?.opposite && "-"}
                  </div>
                </div>
                <div
                  className="w-20 px-2 py-2 flex flex-col items-center border-r border-gray-200 overflow-hidden col-mastery"
                  style={getColStyle("mastery")}
                >
                  <span>{w.mastery ?? 0}{t("wordList.points")}</span>
                  {(() => {
                    const s = w.mastery || 0;
                    let label = t("wordList.masteryLevels.unknown");
                    let cls = "bg-red-500 text-white";
                    if (s >= 90) {
                      label = t("wordList.masteryLevels.memorized");
                      cls = "bg-green-600 text-white";
                    } else if (s >= 50) {
                      label = t("wordList.masteryLevels.familiar");
                      cls = "bg-yellow-500 text-white";
                    } else if (s >= 25) {
                      label = t("wordList.masteryLevels.impression");
                      cls = "bg-orange-500 text-white";
                    }
                    return (
                      <button
                        className={`mt-1 px-2 py-0.5 rounded text-xs ${cls}`}
                        onClick={() => openMasteryQuick(w)}
                      >
                        {label}
                      </button>
                    );
                  })()}
                </div>
                <div
                  className="flex-[6] min-w-0 break-words whitespace-pre-line px-2 py-2 border-r border-gray-200 overflow-hidden col-note"
                  style={getColStyle("note")}
                  onDoubleClick={() => openEdit(w, "editNote")}
                >
                  {highlight(w.note || "-")}
                </div>
                <div
                  className="w-[5.4rem] px-2 py-2 border-r border-gray-200 overflow-hidden col-reviewDate space-y-1"
                  style={getColStyle("reviewDate")}
                >
                  {(() => {
                    const review =
                      w.reviewDate?.toDate().toLocaleDateString() || "-";
                    const due =
                      srsStates[w.id]?.dueDate?.toDate().toLocaleDateString() ||
                      "-";
                    const diff = srsStates[w.id]?.dueDate
                      ? Math.max(
                          0,
                          Math.floor(
                            (Date.now() -
                              srsStates[w.id].dueDate
                                .toDate()
                                .getTime()) /
                              86400000
                          )
                        )
                      : null;
                    return (
                      <>
                        <div>{t("wordList.lastReview")}</div>
                        <div>{review}</div>
                        <div className="border-b border-gray-300 my-1" />
                        <div>{t("wordList.dueDate")}</div>
                        <div>{due}</div>
                        {diff !== null && diff > 0 && (
                          <div>
                            {t("wordList.overdue")}: {diff}
                            {t("wordList.days")}
                          </div>
                        )}
                        <div className="border-b border-gray-300 my-1" />
                        <div className="flex items-center gap-1">
                          {t("wordList.studyCount")}:<span>{w.studyCount ?? 0}</span>
                          <button
                            className="px-1 text-xs border rounded"
                            onClick={() => handleIncrementStudy(w)}
                          >
                            +
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div
                  className="w-20 px-2 py-2 border-r border-gray-200 overflow-hidden col-createdAt"
                  style={getColStyle("createdAt")}
                >
                  {w.createdAt?.toDate().toLocaleDateString() || "-"}
                </div>
                <div
                  className="w-28 px-2 py-2 overflow-hidden col-actions"
                  style={getColStyle("actions")}
                >
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
                          aria-label={t("wordList.edit")}
                        >
                          ✏️
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{t("wordList.editWord")}</DialogTitle>
                        </DialogHeader>
                        <Label htmlFor="editWord" className="mb-1">{t("wordList.word")}</Label>
                        <Input
                          id="editWord"
                          autoFocus
                          value={editWord}
                          onChange={(e) => setEditWord(e.target.value)}
                          className="mb-2"
                        />
                        <Label htmlFor="editPinyin" className="mb-1">{t("wordList.pinyin")}</Label>
                        <Input
                          id="editPinyin"
                          value={editPinyin}
                          onChange={(e) => setEditPinyin(e.target.value)}
                          className="mb-2"
                        />
                        <Label htmlFor="editTranslation" className="mb-1">{t("wordList.translation")}</Label>
                        <textarea
                          id="editTranslation"
                          value={editTranslation}
                          onChange={(e) => setEditTranslation(e.target.value)}
                          rows={3}
                          className="mb-2 w-full rounded border px-2 py-1"
                        />
                        <Label className="mb-1">{t("wordList.partOfSpeech")}</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {posTags.map((tag) => (
                            <label key={tag.id} className="flex items-center space-x-1">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={editPartOfSpeech.includes(tag.id)}
                                onChange={() => toggleEditTag(tag.id)}
                              />
                              <span
                                className={`px-1 rounded text-xs ${
                                  colorClasses[tag.color] || colorClasses.gray
                                }`}
                              >
                                {tag.name}
                              </span>
                            </label>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setPosDialogOpen(true)}
                          >
                            {t("wordList.manageTags")}
                          </Button>
                        </div>
                        <Label htmlFor="editExampleSentence" className="mb-1">{t("wordList.example")}</Label>
                        <textarea
                          id="editExampleSentence"
                          value={editExampleSentence}
                          onChange={(e) => setEditExampleSentence(e.target.value)}
                          rows={3}
                          className="mb-2 w-full rounded border px-2 py-1"
                        />
                        <Label htmlFor="editExampleTranslation" className="mb-1">{t("wordList.exampleTranslation")}</Label>
                        <textarea
                          id="editExampleTranslation"
                          value={editExampleTranslation}
                          onChange={(e) => setEditExampleTranslation(e.target.value)}
                          rows={3}
                          className="mb-2 w-full rounded border px-2 py-1"
                        />
                        <Label className="mb-1">{t("wordList.relatedWords")}</Label>
                        <div className="mb-2 flex gap-2">
                          <div className="flex-1">
                            <div className="mb-1 text-xs">
                              <span className="px-1 rounded bg-blue-100 text-blue-800">
                                {t("wordList.synonym")}
                              </span>
                            </div>
                            <textarea
                              id="editSynonym"
                              value={editSynonym}
                              onChange={(e) => setEditSynonym(e.target.value)}
                              rows={3}
                              className="w-full rounded border px-2 py-1"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 text-xs">
                              <span className="px-1 rounded bg-gray-200 text-gray-800">
                                {t("wordList.antonym")}
                              </span>
                            </div>
                            <textarea
                              id="editAntonym"
                              value={editAntonym}
                              onChange={(e) => setEditAntonym(e.target.value)}
                              rows={3}
                              className="w-full rounded border px-2 py-1"
                            />
                          </div>
                        </div>
                        <Label className="mb-1">{t("wordList.usageFrequency")}</Label>
                        <div className="mb-2 flex items-center gap-2">
                          <StarRating value={editUsageFrequency} onChange={setEditUsageFrequency} />
                          <span>{editUsageFrequency}⭐</span>
                        </div>
                        <Label htmlFor="editNote" className="mb-1">{t("wordList.note")}</Label>
                        <textarea
                          id="editNote"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          rows={3}
                          className="mb-2 w-full rounded border px-2 py-1"
                        />
          <Label className="mb-1">{t("wordList.mastery")}</Label>
          <div className="mb-2 flex flex-wrap gap-2">
            {masteryOptions.map((opt) => (
              <label
                key={opt.key}
                className={`${opt.cls} px-2 py-1 rounded cursor-pointer ${
                  masteryLevelMin(editMastery) === opt.value
                    ? "ring-2 ring-offset-2 ring-black"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="editMastery"
                  className="sr-only"
                  checked={masteryLevelMin(editMastery) === opt.value}
                  onChange={() =>
                    setEditMastery((prev) =>
                      masteryLevelMin(prev) === opt.value ? prev : opt.value
                    )
                  }
                />
                {t(`wordList.masteryLevels.${opt.key}`)}
              </label>
            ))}
          </div>
                        <div className="flex items-center space-x-2 mb-2">
                          <input
                            id="editFavorite"
                            type="checkbox"
                            className="h-4 w-4"
                            checked={editFavorite}
                            onChange={(e) => setEditFavorite(e.target.checked)}
                          />
                          <Label htmlFor="editFavorite">{t("wordList.favorite")}</Label>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setEditTarget(null)}
                          >
                            {t("wordList.cancel")}
                          </Button>
                          <Button
                            onClick={handleUpdate}
                            disabled={updating || !editWord.trim()}
                          >
                            {updating ? t("wordList.saving") : t("wordList.save")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={t("wordList.delete")}
                        >
                          🗑️
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("wordList.confirmDeleteWord", { word: w.word })}
                          </AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeletingId(null)}>
                            {t("wordList.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(w.id)}
                            disabled={deletingId === w.id}
                          >
                            {deletingId === w.id
                              ? t("wordList.deleting")
                              : t("wordList.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1 mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(1)}
            disabled={page === 1}
          >
            {t("wordList.firstPage")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            {t("wordList.prevPage")}
          </Button>
          {(() => {
            const start = Math.max(1, page - 3);
            const end = Math.min(totalPages, page + 3);
            const items: React.ReactNode[] = [];
            if (start > 1) items.push(<span key="start-ellipsis">…</span>);
            for (let p = start; p <= end; p++) {
              items.push(
                <Button
                  key={p}
                  size="sm"
                  variant={p === page ? "default" : "outline"}
                  onClick={() => setPage(p)}
                  disabled={p === page}
                >
                  {p}
                </Button>
              );
            }
            if (end < totalPages) items.push(<span key="end-ellipsis">…</span>);
            return items;
          })()}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            {t("wordList.nextPage")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
          >
            {t("wordList.lastPage")}
          </Button>
        </div>
      )}

      <Dialog open={masteryQuickOpen} onOpenChange={setMasteryQuickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wordList.updateMastery")}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            {masteryOptions.map((opt) => (
              <Button
                key={opt.value}
                className={`${opt.cls} transition-transform ${
                  masteryLevelMin(masteryQuickValue) === opt.value
                    ? "ring-2 ring-offset-2 scale-105"
                    : "opacity-60"
                }`}
                onClick={() =>
                  setMasteryQuickValue((prev) =>
                    masteryLevelMin(prev) === opt.value ? prev : opt.value
                  )
                }
              >
                {t(`wordList.masteryLevels.${opt.key}`)}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={saveMasteryQuick}>{t("wordList.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={posQuickOpen} onOpenChange={setPosQuickOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("wordList.updatePartOfSpeech")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {posTags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 p-2 border rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={posQuickValue.includes(tag.id)}
                  onChange={() => togglePosQuick(tag.id)}
                />
                <span
                  className={`px-2 py-1 rounded text-sm ${
                    colorClasses[tag.color] || colorClasses.gray
                  }`}
                >
                  {tag.name}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={savePosQuick}>{t("wordList.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={usageQuickOpen} onOpenChange={setUsageQuickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wordList.updateUsageFrequency")}</DialogTitle>
          </DialogHeader>
          <StarRating value={usageQuickValue} onChange={setUsageQuickValue} />
          <DialogFooter>
            <Button onClick={saveUsageQuick}>{t("wordList.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

