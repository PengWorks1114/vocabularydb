// src/lib/firebase-client.ts
"use client";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { firebaseApp } from "./firebase";

export const auth = getAuth(firebaseApp);

// Optional: set persistence and ignore failures
setPersistence(auth, browserLocalPersistence).catch(() => {});
