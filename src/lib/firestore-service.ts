import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// 定義單字本的資料型別
export interface Wordbook {
  id: string;
  name: string;
  createdAt: Timestamp;
  userId: string;
  trashed?: boolean;
  trashedAt?: Timestamp | null;
}

// 定義單字的資料型別
export interface Word {
  id: string;
  word: string;
  pinyin: string;
  favorite: boolean;
  translation: string;
  partOfSpeech: string[];
  exampleSentence: string;
  exampleTranslation: string;
  relatedWords: string;
  mastery: number;
  note: string;
  wordbookId: string;
  createdAt: Timestamp;
}

// 自訂詞性標籤
export interface PartOfSpeechTag {
  id: string;
  name: string;
  color: string;
  userId: string;
}

// 取得使用者所有單字本
export const getWordbooksByUserId = async (
  userId: string
): Promise<Wordbook[]> => {
  const colRef = collection(db, "users", userId, "wordbooks");
  const querySnapshot = await getDocs(colRef);
  const wordbooks: Wordbook[] = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data() as Wordbook;
    if (!data.trashed) wordbooks.push({ id: docSnap.id, ...data });
  });
  return wordbooks;
};

// 建立新的單字本
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

// 永久刪除單字本
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

// 將單字本移到垃圾桶
export const trashWordbook = async (
  userId: string,
  wordbookId: string
): Promise<void> => {
  const docRef = doc(db, "users", userId, "wordbooks", wordbookId);
  await updateDoc(docRef, { trashed: true, trashedAt: Timestamp.now() });
};

// 取得使用者垃圾桶中的單字本
export const getTrashedWordbooksByUserId = async (
  userId: string
): Promise<Wordbook[]> => {
  const colRef = collection(db, "users", userId, "wordbooks");
  const snapshot = await getDocs(colRef);
  const wordbooks: Wordbook[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as Wordbook;
    if (data.trashed) wordbooks.push({ id: docSnap.id, ...data });
  });
  return wordbooks;
};

// 清空垃圾桶
export const clearTrashedWordbooks = async (userId: string): Promise<void> => {
  const trashed = await getTrashedWordbooksByUserId(userId);
  await Promise.all(
    trashed.map((wb) => deleteWordbook(userId, wb.id))
  );
};

// 更新單字本名稱
export const updateWordbookName = async (
  userId: string,
  wordbookId: string,
  newName: string
): Promise<void> => {
  const wordbookRef = doc(db, "users", userId, "wordbooks", wordbookId);
  await updateDoc(wordbookRef, { name: newName });
};

// 取得單一本的資訊
export const getWordbook = async (
  userId: string,
  wordbookId: string
): Promise<Wordbook | null> => {
  const ref = doc(db, "users", userId, "wordbooks", wordbookId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Wordbook) };
};

// ------------------- 單字 CRUD -------------------

// 取得指定單字本的所有單字
export const getWordsByWordbookId = async (
  userId: string,
  wordbookId: string
): Promise<Word[]> => {
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
  return words;
};

// 新增單字
export const createWord = async (
  userId: string,
  wordbookId: string,
  wordData: Omit<Word, "id" | "createdAt" | "wordbookId">
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
  });
  return {
    id: docRef.id,
    ...wordData,
    wordbookId,
    createdAt: Timestamp.now(),
  };
};

// 更新單字
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
};

// 刪除單字
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
};

// ------------------- 詞性標籤 CRUD -------------------

// 取得使用者的全部詞性標籤
export const getPartOfSpeechTags = async (
  userId: string
): Promise<PartOfSpeechTag[]> => {
  const colRef = collection(db, "users", userId, "posTags");
  const snapshot = await getDocs(colRef);
  const tags: PartOfSpeechTag[] = [];
  snapshot.forEach((docSnap) => {
    tags.push({ id: docSnap.id, ...docSnap.data() } as PartOfSpeechTag);
  });
  return tags;
};

// 新增詞性標籤
export const createPartOfSpeechTag = async (
  userId: string,
  data: Omit<PartOfSpeechTag, "id" | "userId">
): Promise<PartOfSpeechTag> => {
  const colRef = collection(db, "users", userId, "posTags");
  const docRef = await addDoc(colRef, { ...data, userId });
  return { id: docRef.id, ...data, userId };
};

// 更新詞性標籤
export const updatePartOfSpeechTag = async (
  userId: string,
  tagId: string,
  data: Partial<PartOfSpeechTag>
): Promise<void> => {
  const ref = doc(db, "users", userId, "posTags", tagId);
  await updateDoc(ref, data);
};

// 刪除詞性標籤
export const deletePartOfSpeechTag = async (
  userId: string,
  tagId: string
): Promise<void> => {
  const ref = doc(db, "users", userId, "posTags", tagId);
  await deleteDoc(ref);
};
