// src/lib/firebase-client.ts
"use client";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  Auth,
} from "firebase/auth";
import { firebaseApp } from "./firebase";

let auth: Auth | null = null;

/**
 * Lazily obtain the Firebase Auth instance. This avoids initializing auth
 * during server-side builds where Firebase config may be missing.
 */
export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!auth) {
    auth = getAuth(firebaseApp);
    // Optional: set persistence and ignore failures
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }

  return auth;
}
