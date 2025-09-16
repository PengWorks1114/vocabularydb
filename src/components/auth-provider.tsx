"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User, Auth } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  auth: Auth | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseAuth, setFirebaseAuth] = useState<Auth | null>(null);

  useEffect(() => {
    const instance = getFirebaseAuth();
    if (!instance) {
      setLoading(false);
      return;
    }

    setFirebaseAuth(instance);
    const unsubscribe = onAuthStateChanged(instance, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, auth: firebaseAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
