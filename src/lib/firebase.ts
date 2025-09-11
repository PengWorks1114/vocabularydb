// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";

// Provide fallback values so builds do not fail when env vars are missing.
// These placeholders are only used during build and are replaced at runtime
// when proper environment variables are supplied.
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyDUMMYKEY12345678901234567890abcd",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "placeholder.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "placeholder",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "placeholder.appspot.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "0",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:0:web:placeholderappid",
};

// Avoid re-initializing during HMR
export const firebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

// Enable persistent local cache (IndexedDB)
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache(),
});
