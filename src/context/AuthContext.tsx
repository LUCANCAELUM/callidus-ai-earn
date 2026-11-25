import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  mpesaNumber: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  kycStatus: string;
  role: string;
  accountStatus: string;
  accepted8020Terms: boolean;
  accepted8020At: string | null;
  acceptedDataPrivacy: boolean;
  preferredLanguages: string[];
  preferredDepartments: string[];
  referralCode: string | null;
  referredByUid: string | null;
  referralCount: number;
  tasksCompletedCount: number;
  qualityScorePct: number;
  grossEarnedCents: number;
  userNetEarnedCents: number;
  paybillAllocatedCents: number;
  availableBalanceCents: number;
  pendingBalanceCents: number;
  withdrawnCents: number;
}

interface AuthContextValue {
  firebaseUser: User | null;
  dbUser: DbUser | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const apiFetch = useCallback(
    async <T = unknown,>(url: string, options: RequestInit = {}): Promise<T> => {
      const currentUser = auth.currentUser;
      const headers = new Headers(options.headers || {});
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (currentUser) {
        const token = await currentUser.getIdToken();
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(url, { ...options, headers });
      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const msg =
          typeof payload === 'object' && payload && 'error' in payload
            ? String((payload as { error: string }).error)
            : `Request failed (${res.status})`;
        throw new Error(msg);
      }
      return payload as T;
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setDbUser(null);
      return;
    }
    try {
      const data = await apiFetch<{ user: DbUser }>('/api/me');
      setDbUser(data.user);
      setAuthError(null);
    } catch (err) {
      console.error('Failed to sync profile:', err);
      setAuthError(err instanceof Error ? err.message : 'Unable to sync account.');
    }
  }, [apiFetch]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await refreshProfile();
      } else {
        setDbUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [refreshProfile]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      await refreshProfile();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in could not be completed.';
      setAuthError(msg);
      return false;
    }
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setDbUser(null);
    setFirebaseUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        refreshProfile,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
