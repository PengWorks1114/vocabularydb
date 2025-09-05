import {
  collection,
  doc,
  addDoc,
  getDocs,
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
}

// 定義單字的資料型別
export interface Word {
  id: string;
  word: string;
  favorite: boolean;
  translation: string;
  partOfSpeech: string[];
  exampleSentence: string;
  exampleTranslation: string;
  mastery: number;
  note: string;
  wordbookId: string;
  createdAt: Timestamp;
}

// 取得使用者所有單字本
export const getWordbooksByUserId = async (
  userId: string
): Promise<Wordbook[]> => {
  const colRef = collection(db, "users", userId, "wordbooks");
  const querySnapshot = await getDocs(colRef);
  const wordbooks: Wordbook[] = [];
  querySnapshot.forEach((docSnap) => {
    wordbooks.push({ id: docSnap.id, ...docSnap.data() } as Wordbook);
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
  });
  return { id: docRef.id, name, userId, createdAt: Timestamp.now() };
};

// 刪除單字本
export const deleteWordbook = async (
  userId: string,
  wordbookId: string
): Promise<void> => {
  const docRef = doc(db, "users", userId, "wordbooks", wordbookId);
  await deleteDoc(docRef);
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
