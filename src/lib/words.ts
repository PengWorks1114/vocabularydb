import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

export interface WordDoc {
  id: string;
  [key: string]: unknown;
}

export async function fetchWordsPage(
  userId: string,
  wordbookId: string,
  pageSize = 20,
  cursor?: QueryDocumentSnapshot
) {
  const base = collection(
    db,
    "users",
    userId,
    "wordbooks",
    wordbookId,
    "words"
  );
  const q = cursor
    ? query(base, orderBy("updatedAt", "desc"), startAfter(cursor), limit(pageSize))
    : query(base, orderBy("updatedAt", "desc"), limit(pageSize));

  const snap = await getDocs(q);
  const items: WordDoc[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  }));
  const nextCursor = snap.docs.at(-1) ?? null;
  return { items, nextCursor };
}
