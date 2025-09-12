import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Define wordbook type
export interface Wordbook {
  id: string;
  name: string;
  createdAt: Timestamp;
  userId: string;
  trashed?: boolean;
  trashedAt?: Timestamp | null;
}

// Define word type
export interface Word {
  id: string;
  word: string;
  pinyin: string;
  favorite: boolean;
  translation: string;
  partOfSpeech: string[];
  exampleSentence: string;
  exampleTranslation: string;
  relatedWords?: {
    same?: string;
    opposite?: string;
  };
  usageFrequency: number;
  mastery: number;
  note: string;
  wordbookId: string;
  createdAt: Timestamp;
  reviewDate?: Timestamp | null;
  studyCount?: number;
}

// Custom part-of-speech tags
export interface PartOfSpeechTag {
  id: string;
  name: string;
  color: string;
  userId: string;
}

// simple in-memory cache to avoid repeated reads for the same wordbook
const wordCache: Record<string, Word[]> = {};
const makeCacheKey = (userId: string, wordbookId: string) => `${userId}_${wordbookId}`;
const posTagCache: Record<string, PartOfSpeechTag[]> = {};

// Get all wordbooks for a user
export const getWordbooksByUserId = async (
  userId: string
): Promise<Wordbook[]> => {
  const colRef = collection(db, "users", userId, "wordbooks");
  const querySnapshot = await getDocs(colRef);
  const wordbooks: Wordbook[] = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data() as Omit<Wordbook, "id">;
    if (!data.trashed) wordbooks.push({ id: docSnap.id, ...data });
  });
  return wordbooks;
};

// Create a new wordbook
export const createWordbook = async (
  userId: string,
  name: string
): Promise<Wordbook> => {
  const colRef = collection(db, "users", userId, "wordbooks");
  const docRef = await addDoc(colRef, {
    name,
    userId,
    createdAt: Timestamp.now(),
    trashed: false,
    trashedAt: null,
  });
  return {
    id: docRef.id,
    name,
    userId,
    createdAt: Timestamp.now(),
    trashed: false,
    trashedAt: null,
  };
};

// Permanently delete a wordbook
export const deleteWordbook = async (
  userId: string,
  wordbookId: string
): Promise<void> => {
  const docRef = doc(db, "users", userId, "wordbooks", wordbookId);
  const wordsRef = collection(docRef, "words");
  const wordsSnap = await getDocs(wordsRef);
  await Promise.all(wordsSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(docRef);
};

// Move a wordbook to trash
export const trashWordbook = async (
  userId: string,
  wordbookId: string
): Promise<void> => {
  const docRef = doc(db, "users", userId, "wordbooks", wordbookId);
  await updateDoc(docRef, { trashed: true, trashedAt: Timestamp.now() });
};

// Get a user's wordbooks in trash
export const getTrashedWordbooksByUserId = async (
  userId: string
): Promise<Wordbook[]> => {
  const colRef = collection(db, "users", userId, "wordbooks");
  const snapshot = await getDocs(colRef);
  const wordbooks: Wordbook[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as Omit<Wordbook, "id">;
    if (data.trashed) wordbooks.push({ id: docSnap.id, ...data });
  });
  return wordbooks;
};

// Empty trash
export const clearTrashedWordbooks = async (userId: string): Promise<void> => {
  const trashed = await getTrashedWordbooksByUserId(userId);
  await Promise.all(
    trashed.map((wb) => deleteWordbook(userId, wb.id))
  );
};

// Update wordbook name
export const updateWordbookName = async (
  userId: string,
  wordbookId: string,
  newName: string
): Promise<void> => {
  const wordbookRef = doc(db, "users", userId, "wordbooks", wordbookId);
  await updateDoc(wordbookRef, { name: newName });
};

// Get a single wordbook's info
export const getWordbook = async (
  userId: string,
  wordbookId: string
): Promise<Wordbook | null> => {
  const ref = doc(db, "users", userId, "wordbooks", wordbookId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<Wordbook, "id">;
  return { id: snap.id, ...data };
};

// ------------------- Word CRUD -------------------

// Get all words for a wordbook
export const getWordsByWordbookId = async (
  userId: string,
  wordbookId: string
): Promise<Word[]> => {
  const key = makeCacheKey(userId, wordbookId);
  if (wordCache[key]) return wordCache[key];
  const colRef = collection(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "words"
  );
  const snapshot = await getDocs(colRef);
  const words: Word[] = [];
  snapshot.forEach((docSnap) => {
    words.push({ id: docSnap.id, ...docSnap.data() } as Word);
  });
  wordCache[key] = words;
  return words;
};

// Create word
export const createWord = async (
  userId: string,
  wordbookId: string,
  wordData: Omit<Word, "id" | "createdAt" | "wordbookId" | "reviewDate" | "studyCount">
): Promise<Word> => {
  const colRef = collection(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "words"
  );
  const docRef = await addDoc(colRef, {
    ...wordData,
    wordbookId,
    createdAt: Timestamp.now(),
    reviewDate: null,
    studyCount: 0,
  });
  const newWord = {
    id: docRef.id,
    ...wordData,
    wordbookId,
    createdAt: Timestamp.now(),
    reviewDate: null,
    studyCount: 0,
  } as Word;
  const key = makeCacheKey(userId, wordbookId);
  if (wordCache[key]) wordCache[key].push(newWord);
  return newWord;
};

// Update word
export const updateWord = async (
  userId: string,
  wordbookId: string,
  wordId: string,
  updateData: Partial<Word>
): Promise<void> => {
  const ref = doc(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "words",
    wordId
  );
  await updateDoc(ref, updateData);
  const key = makeCacheKey(userId, wordbookId);
  if (wordCache[key]) {
    wordCache[key] = wordCache[key].map((w) =>
      w.id === wordId ? { ...w, ...updateData } : w
    );
  }
};

// Delete word
export const deleteWord = async (
  userId: string,
  wordbookId: string,
  wordId: string
): Promise<void> => {
  const ref = doc(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "words",
    wordId
  );
  await deleteDoc(ref);
  const key = makeCacheKey(userId, wordbookId);
  if (wordCache[key]) {
    wordCache[key] = wordCache[key].filter((w) => w.id !== wordId);
  }
};

// Bulk import words
export const bulkImportWords = async (
  userId: string,
  wordbookId: string,
  data: Omit<
    Word,
    "id" | "createdAt" | "wordbookId" | "reviewDate" | "studyCount"
  >[]
): Promise<Word[]> => {
  const colRef = collection(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "words"
  );
  const batch = writeBatch(db);
  const createdAt = Timestamp.now();
  const newWords: Word[] = [];
  data.forEach((d) => {
    const docRef = doc(colRef);
    const word: Word = {
      id: docRef.id,
      ...d,
      wordbookId,
      createdAt,
      reviewDate: null,
      studyCount: 0,
    };
    batch.set(docRef, word);
    newWords.push(word);
  });
  await batch.commit();
  const key = makeCacheKey(userId, wordbookId);
  if (wordCache[key]) wordCache[key].push(...newWords);
  else wordCache[key] = [...newWords];
  return newWords;
};

// Reset progress for multiple words
export const resetWordsProgress = async (
  userId: string,
  wordbookId: string,
  ids: string[]
): Promise<void> => {
  const batch = writeBatch(db);
  ids.forEach((id) => {
    const ref = doc(
      db,
      "users",
      userId,
      "wordbooks",
      wordbookId,
      "words",
      id
    );
    batch.update(ref, { mastery: 0, studyCount: 0, reviewDate: null });
    const srsRef = doc(
      db,
      "users",
      userId,
      "wordbooks",
      wordbookId,
      "srs",
      id
    );
    batch.delete(srsRef);
  });
  await batch.commit();
  const key = makeCacheKey(userId, wordbookId);
  if (wordCache[key]) {
    wordCache[key] = wordCache[key].map((w) =>
      ids.includes(w.id) ? { ...w, mastery: 0, studyCount: 0, reviewDate: null } : w
    );
  }
};

// Bulk delete words
export const bulkDeleteWords = async (
  userId: string,
  wordbookId: string,
  ids: string[]
): Promise<void> => {
  const batch = writeBatch(db);
  ids.forEach((id) => {
    const ref = doc(
      db,
      "users",
      userId,
      "wordbooks",
      wordbookId,
      "words",
      id
    );
    batch.delete(ref);
  });
  await batch.commit();
  const key = makeCacheKey(userId, wordbookId);
  if (wordCache[key]) {
    wordCache[key] = wordCache[key].filter((w) => !ids.includes(w.id));
  }
};

// ------------------- Part-of-speech tag CRUD -------------------

// Get all part-of-speech tags for a user
export const getPartOfSpeechTags = async (
  userId: string
): Promise<PartOfSpeechTag[]> => {
  if (posTagCache[userId]) return posTagCache[userId];
  const colRef = collection(db, "users", userId, "posTags");
  const snapshot = await getDocs(colRef);
  const tags: PartOfSpeechTag[] = [];
  snapshot.forEach((docSnap) => {
    tags.push({ id: docSnap.id, ...docSnap.data() } as PartOfSpeechTag);
  });
  posTagCache[userId] = tags;
  return tags;
};

// Create part-of-speech tag
export const createPartOfSpeechTag = async (
  userId: string,
  data: Omit<PartOfSpeechTag, "id" | "userId">
): Promise<PartOfSpeechTag> => {
  const colRef = collection(db, "users", userId, "posTags");
  const docRef = await addDoc(colRef, { ...data, userId });
  const tag = { id: docRef.id, ...data, userId } as PartOfSpeechTag;
  if (posTagCache[userId]) posTagCache[userId].push(tag);
  return tag;
};

// Update part-of-speech tag
export const updatePartOfSpeechTag = async (
  userId: string,
  tagId: string,
  data: Partial<PartOfSpeechTag>
): Promise<void> => {
  const ref = doc(db, "users", userId, "posTags", tagId);
  await updateDoc(ref, data);
  if (posTagCache[userId]) {
    posTagCache[userId] = posTagCache[userId].map((t) =>
      t.id === tagId ? { ...t, ...data } : t
    );
  }
};

// Delete part-of-speech tag
export const deletePartOfSpeechTag = async (
  userId: string,
  tagId: string
): Promise<void> => {
  const tagRef = doc(db, "users", userId, "posTags", tagId);

  // Remove the tag from any words that reference it
  const wordbooksRef = collection(db, "users", userId, "wordbooks");
  const wordbooksSnap = await getDocs(wordbooksRef);
  await Promise.all(
    wordbooksSnap.docs.map(async (wb) => {
      const wordsRef = collection(
        db,
        "users",
        userId,
        "wordbooks",
        wb.id,
        "words"
      );
      const wordsSnap = await getDocs(
        query(wordsRef, where("partOfSpeech", "array-contains", tagId))
      );
      await Promise.all(
        wordsSnap.docs.map((docSnap) => {
          const data = docSnap.data();
          const updated = (data.partOfSpeech || []).filter(
            (t: string) => t !== tagId
          );
          return updateDoc(docSnap.ref, { partOfSpeech: updated });
        })
      );
    })
  );

  await deleteDoc(tagRef);
  if (posTagCache[userId]) {
    posTagCache[userId] = posTagCache[userId].filter((t) => t.id !== tagId);
  }
};

// ------------------- SRS (Ebbinghaus) -------------------

export interface SrsState {
  stage: number;
  intervalDays: number;
  dueDate: Timestamp;
  streak: number;
  lapses: number;
  ease: number;
}

export interface ReviewLog {
  wordId: string;
  ts: Timestamp;
  quality: 0 | 1 | 2 | 3;
  mastery: number;
}

function initSrsFromWord(word: Word): SrsState {
  const score = word.mastery || 0;
  let stage = 0;
  let interval = 1;
  if (score >= 90 && score <= 100) {
    stage = 4;
    interval = 30;
  } else if (score >= 75) {
    stage = 3;
    interval = 14;
  } else if (score >= 50) {
    stage = 2;
    interval = 7;
  } else if (score >= 25) {
    stage = 1;
    interval = 3;
  } else {
    stage = 0;
    interval = 1;
  }
  if (score > 100) {
    stage = 5;
    interval = Math.min(60, Math.floor(score / 2));
  }
  const lastReview = word.reviewDate?.toDate() || new Date();
  const today = new Date();
  const due = new Date(lastReview);
  due.setDate(due.getDate() + interval);
  if (due < today) due.setTime(today.getTime());
  return {
    stage,
    intervalDays: interval,
    dueDate: Timestamp.fromDate(due),
    streak: Math.max(1, stage),
    lapses: 0,
    ease: 2.5,
  };
}

async function getOrInitSrsState(
  userId: string,
  wordbookId: string,
  word: Word
): Promise<SrsState> {
  const colRef = collection(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "srs"
  );
  const docRef = doc(colRef, word.id);
  const snap = await getDoc(docRef);
  if (snap.exists()) return snap.data() as SrsState;
  const init = initSrsFromWord(word);
  await setDoc(docRef, init);
  return init;
}

export const getAllSrsStates = async (
  userId: string,
  wordbookId: string,
  words: Word[]
): Promise<Record<string, SrsState>> => {
  const colRef = collection(db, "users", userId, "wordbooks", wordbookId, "srs");
  const snap = await getDocs(colRef);
  const existing = new Map<string, SrsState>();
  snap.forEach((d) => existing.set(d.id, d.data() as SrsState));

  const result: Record<string, SrsState> = {};
  await Promise.all(
    words.map(async (w) => {
      let state = existing.get(w.id);
      if (!state) {
        state = initSrsFromWord(w);
        await setDoc(doc(colRef, w.id), state);
      }
      result[w.id] = state;
    })
  );
  return result;
};

export const getDueSrsWords = async (
  userId: string,
  wordbookId: string
): Promise<{ word: Word; state: SrsState }[]> => {
  const words = await getWordsByWordbookId(userId, wordbookId);
  const colRef = collection(db, "users", userId, "wordbooks", wordbookId, "srs");
  const snap = await getDocs(colRef);
  const existing = new Map<string, SrsState>();
  snap.forEach((d) => existing.set(d.id, d.data() as SrsState));
  const today = new Date();
  const items: { word: Word; state: SrsState }[] = [];
  await Promise.all(
    words.map(async (w) => {
      let state = existing.get(w.id);
      if (!state) {
        state = initSrsFromWord(w);
        await setDoc(doc(colRef, w.id), state);
      }
      if (state.dueDate.toDate() <= today) {
        items.push({ word: w, state });
      }
    })
  );
  items.sort((a, b) => {
    const diffA = today.getTime() - a.state.dueDate.toDate().getTime();
    const diffB = today.getTime() - b.state.dueDate.toDate().getTime();
    if (diffA !== diffB) return diffB - diffA;
    return (b.state.lapses || 0) - (a.state.lapses || 0);
  });
  return items;
};

export const applySrsAnswer = async (
  userId: string,
  wordbookId: string,
  word: Word,
  state: SrsState,
  quality: 0 | 1 | 2 | 3
): Promise<SrsState> => {
  let { stage, intervalDays: ivl, streak, lapses, ease } = state;
  if (quality === 0) {
    stage = Math.max(0, stage - 2);
    ivl = 1;
    streak = 0;
    lapses += 1;
    ease = Math.max(2.3, ease - 0.2);
  } else if (quality === 1) {
    stage = Math.max(0, stage - 1);
    ivl = Math.ceil(ivl * 0.7);
    streak = 0;
    ease = Math.max(2.3, ease - 0.05);
  } else if (quality === 2) {
    stage += 1;
    streak += 1;
    ivl = Math.round(ivl * ease);
  } else {
    stage += 2;
    streak += 1;
    ease = Math.min(2.7, ease + 0.05);
    ivl = Math.round(ivl * ease * 1.15);
  }
  ivl = Math.min(180, Math.max(1, ivl));
  const today = new Date();
  const due = new Date(today);
  due.setDate(today.getDate() + ivl);
  const newState: SrsState = {
    stage,
    intervalDays: ivl,
    streak,
    lapses,
    ease,
    dueDate: Timestamp.fromDate(due),
  };
  const srsRef = doc(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "srs",
    word.id
  );
  await setDoc(srsRef, newState);

  const delta = quality === 0 ? -20 : quality === 1 ? -5 : quality === 2 ? 6 : 10;
  const newMastery = Math.max(0, (word.mastery || 0) + delta);
  const wordRef = doc(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "words",
    word.id
  );
  await updateDoc(wordRef, {
    mastery: newMastery,
    reviewDate: Timestamp.fromDate(today),
  });
  word.mastery = newMastery;
  word.reviewDate = Timestamp.fromDate(today);

  const logRef = collection(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "reviewLogs"
  );
  await addDoc(logRef, {
    wordId: word.id,
    ts: Timestamp.fromDate(today),
    quality,
    mastery: newMastery,
  });
  return newState;
};

export const getReviewLogs = async (
  userId: string,
  wordbookId: string,
  days: number
): Promise<ReviewLog[]> => {
  const colRef = collection(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "reviewLogs"
  );
  const since = new Date();
  since.setDate(since.getDate() - days);
  const qRef = query(
    colRef,
    where("ts", ">=", Timestamp.fromDate(since)),
    orderBy("ts", "desc"),
    limit(1000)
  );
  const snap = await getDocs(qRef);
  return snap.docs.map((d) => d.data() as ReviewLog);
};

