"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

const requiredFirebaseConfig = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId
};

function requireFirebaseClientConfig() {
  const missing = Object.entries(requiredFirebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Konfigurasi Firebase client belum lengkap: ${missing.join(", ")}.`);
  }

  if (firebaseConfig.projectId !== "nakagami-uco") {
    throw new Error("Konfigurasi Firebase client tidak cocok dengan project nakagami-uco.");
  }
}

export function getClientApp() {
  requireFirebaseClientConfig();
  app ||= getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return app;
}

export function getClientAuth() {
  auth ||= getAuth(getClientApp());
  return auth;
}

export function getClientFirestore() {
  firestore ||= getFirestore(getClientApp());
  return firestore;
}

export async function getClientAnalytics() {
  if (!firebaseConfig.measurementId || typeof window === "undefined") return null;
  analyticsPromise ||= isSupported().then((supported) => (supported ? getAnalytics(getClientApp()) : null));
  return analyticsPromise;
}
