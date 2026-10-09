"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getClientAuth } from "@/lib/firebase-client";
import { getSignedInProfile } from "@/lib/firestore-api";
import type { AppUser } from "@/types/domain";

type AuthContextValue = {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  authError: string;
  token: () => Promise<string>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  async function token() {
    const auth = getClientAuth();
    if (!auth.currentUser) throw new Error("Belum login.");
    return auth.currentUser.getIdToken();
  }

  async function refreshUser() {
    const auth = getClientAuth();
    if (!auth.currentUser) {
      setAppUser(null);
      setAuthError("");
      return false;
    }
    const payload = await getSignedInProfile();
    setAuthError("");
    setAppUser(payload);
    return true;
  }

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const auth = getClientAuth();
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        setLoading(true);
        setFirebaseUser(user);
        try {
          if (user) await refreshUser();
          else {
            setAppUser(null);
            setAuthError("");
          }
        } catch {
          setAppUser(null);
          setAuthError("Gagal memeriksa sesi. Silakan login ulang.");
        } finally {
          setLoading(false);
        }
      });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Konfigurasi Firebase Authentication tidak valid.");
      setLoading(false);
    }
    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      firebaseUser,
      appUser,
      loading,
      authError,
      token,
      refreshUser,
      logout: () => signOut(getClientAuth())
    }),
    [firebaseUser, appUser, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
