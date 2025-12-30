"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "firebase/firestore";
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
import { getFirebaseAuth, getFirebaseDb } from "../../lib/firebase/client";

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

  const ensureProfile = useCallback(async (firebaseUser) => {
    try {
      const db = getFirebaseDb();
      const profileRef = doc(db, "users", firebaseUser.uid);
      const snapshot = await getDoc(profileRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProfile(data);
        return data;
      }
      const payload = buildProfilePayload(firebaseUser);
      await setDoc(profileRef, payload);
      setProfile(payload);
      return payload;
    } catch (profileError) {
      console.error("ensureProfile error", profileError);
      setError("Unable to reach Firestore. Check Firebase configuration.");
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
      const db = getFirebaseDb();
      const profileRef = doc(db, "users", user.uid);
      await updateDoc(profileRef, {
        [field]: shouldInclude ? arrayUnion(eventId) : arrayRemove(eventId),
        updatedAt: new Date().toISOString()
      });
      setProfile((prev) => {
        if (!prev) return prev;
        const current = new Set(prev[field] || []);
        if (shouldInclude) current.add(eventId);
        else current.delete(eventId);
        return {
          ...prev,
          [field]: Array.from(current)
        };
      });
    },
    [user?.uid]
  );

  const updateUserProfile = useCallback(
    async (updates) => {
      if (!user?.uid) throw new Error("Not logged in");
      const db = getFirebaseDb();
      const profileRef = doc(db, "users", user.uid);
      await updateDoc(profileRef, {
        ...updates,
        updatedAt: new Date().toISOString()
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
