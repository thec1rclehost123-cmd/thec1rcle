"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase/client";

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  login: async () => { },
  register: async () => { },
  logout: async () => { },
  updateEventList: async () => { }
});

const buildProfilePayload = (firebaseUser, overrides = {}) => {
  const now = new Date().toISOString();
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || "",
    displayName: firebaseUser.displayName || "Member",
    photoURL: firebaseUser.photoURL || "",

    attendedEvents: [],
    city: "",
    instagram: "",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  const ensureProfile = useCallback(async (firebaseUser) => {
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const payload = buildProfilePayload(firebaseUser);

      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setProfile(data.user);
          return data.user;
        }
      }

      // If missing or error fetching, create new one
      await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      setProfile(payload);
      return payload;
    } catch (profileError) {
      console.error("ensureProfile error", profileError);
      setError("Unable to ensure profile via API.");
      return null;
    }
  }, []);

  useEffect(() => {
    let unsubscribe;
    try {
      const auth = getFirebaseAuth();
      unsubscribe = onAuthStateChanged(auth, async (authUser) => {
        setUser(authUser);
        if (authUser) {
          try {
            await ensureProfile(authUser);
          } catch (profileError) {
            console.error("Failed to load user profile", profileError);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
    } catch (authError) {
      console.error("Firebase auth unavailable", authError);
      setError("Firebase is not configured. Check NEXT_PUBLIC_FIREBASE_* env vars.");
      setLoading(false);
    }
    return () => unsubscribe?.();
  }, [ensureProfile]);

  const login = useCallback(async (email, password, rememberMe = true) => {
    const auth = getFirebaseAuth();
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await ensureProfile(credential.user);
    return credential.user;
  }, [ensureProfile]);

  const register = useCallback(
    async (email, password, displayName) => {
      const auth = getFirebaseAuth();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateFirebaseProfile(credential.user, { displayName });
      }
      await ensureProfile({
        ...credential.user,
        displayName: displayName || credential.user.displayName
      });
      return credential.user;
    },
    [ensureProfile]
  );

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    await signOut(auth);
    setProfile(null);
    setUser(null);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    await ensureProfile(credential.user);
    return credential.user;
  }, [ensureProfile]);

  const updateEventList = useCallback(
    async (field, eventId, shouldInclude) => {
      if (!user?.uid) {
        throw new Error("You must be logged in to manage events.");
      }

      // Read latest profile via ref — avoids adding `profile` to deps
      // which would recreate this callback (and invalidate context) on every profile update
      const current = new Set(profileRef.current?.[field] || []);
      if (shouldInclude) current.add(eventId);
      else current.delete(eventId);
      const updatedArray = Array.from(current);

      // Optimistic update before awaiting the token/network
      setProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, [field]: updatedArray };
      });

      const token = await user.getIdToken();
      await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'user', updates: { [field]: updatedArray } })
      });
    },
    [user?.uid] // profile removed from deps — read via ref instead
  );

  const updateUserProfile = useCallback(
    async (updates) => {
      if (!user?.uid) throw new Error("Not logged in");

      const token = await user.getIdToken();
      await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'user', updates })
      });

      setProfile((prev) => ({ ...prev, ...updates }));
    },
    [user?.uid]
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      login,
      register,
      loginWithGoogle,
      logout,
      updateEventList,
      updateUserProfile
    }),
    [user, profile, loading, error, login, register, loginWithGoogle, logout, updateEventList, updateUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;
