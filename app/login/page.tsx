"use client";

import { FormEvent, useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { LogIn } from "lucide-react";
import { getClientAuth } from "@/lib/firebase-client";
import { useAuth } from "@/components/layout/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

export default function LoginPage() {
  const router = useRouter();
  const { appUser, loading: authLoading, authError, refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (appUser) router.replace("/dashboard");
  }, [appUser, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(getClientAuth(), email, password);
      const hasAccess = await refreshUser();
      if (hasAccess) router.replace("/dashboard");
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Nakagami UCO</h1>
          <p className="mt-2 text-sm text-slate-400">Masuk dengan akun Firebase Authentication yang sudah diberi role admin atau ranger.</p>
        </div>
        {(error || authError) && <div className="mb-4 rounded-md border border-red-700/70 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error || authError}</div>}
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          <Button type="submit" disabled={loading || authLoading}><LogIn size={16} />{loading ? "Memproses..." : "Login"}</Button>
        </form>
      </Card>
    </main>
  );
}

function authMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
      return "Email atau password tidak sesuai.";
    }
    if (error.code === "auth/too-many-requests") return "Terlalu banyak percobaan login. Coba lagi nanti.";
    if (error.code === "auth/api-key-not-valid.-please-pass-a-valid-api-key." || error.code === "auth/invalid-api-key") {
      return "NEXT_PUBLIC_FIREBASE_API_KEY tidak valid. Ganti nilainya di .env.local dengan apiKey dari Firebase Console > Project settings > Your apps untuk project nakagami-uco, lalu restart dev server.";
    }
  }
  return error instanceof Error ? error.message : "Login gagal. Periksa email dan password.";
}
