// src/lib/firestore-service.ts
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

// ------------------- 型別 -------------------

export interface Wordbook {
  id: string;
  name: string;
  createdAt: Timestamp;
  userId: string;
}

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

// ------------------- 單字本 CRUD -------------------

export const getWordbooksByUserId = async (
  userId: string
): Promise<Wordbook[]> => {
  const colRef = collection(db, "users", userId, "wordbooks");
  const snapshot = await getDocs(colRef);
  const wordbooks: Wordbook[] = [];
  snapshot.forEach((docSnap) => {
    wordbooks.push({ id: docSnap.id, ...docSnap.data() } as Wordbook);
  });
  return wordbooks;
};

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

export const deleteWordbook = async (
  userId: string,
  wordbookId: string
): Promise<void> => {
  const ref = doc(db, "users", userId, "wordbooks", wordbookId);
  await deleteDoc(ref);
};

export const updateWordbookName = async (
  userId: string,
  wordbookId: string,
  newName: string
): Promise<void> => {
  const ref = doc(db, "users", userId, "wordbooks", wordbookId);
  await updateDoc(ref, { name: newName });
};

// ------------------- 單字 CRUD -------------------

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
