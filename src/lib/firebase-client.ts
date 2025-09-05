// src/lib/firebase-client.ts
"use client";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { firebaseApp } from "./firebase";

export const auth = getAuth(firebaseApp);

// 可選：設定持久化，失敗也別讓它炸掉
setPersistence(auth, browserLocalPersistence).catch(() => {});
