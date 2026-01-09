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
  updatePassword as updateFirebasePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
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
  updateEventList: async () => { },
  updateUserProfile: async () => { },
  changePassword: async () => { }
});

const buildProfilePayload = (firebaseUser, overrides = {}) => {
  const now = new Date().toISOString();
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || "",
    displayName: firebaseUser.displayName || "Member",
    photoURL: firebaseUser.photoURL || "",
    gender: overrides.gender || "",
    phoneNumber: overrides.phoneNumber || "",

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
        // Normalize timestamps for UI consistency
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          data.createdAt = data.createdAt.toDate().toISOString();
        }
        if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
          data.updatedAt = data.updatedAt.toDate().toISOString();
        }
        setProfile(data);
        return data;
      }
      const payload = buildProfilePayload(firebaseUser, {
        gender: firebaseUser.gender || ""
      });
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
    const profile = await ensureProfile(credential.user);
    return { user: credential.user, profile };
  }, [ensureProfile]);

  const register = useCallback(
    async (email, password, displayName, gender) => {
      const auth = getFirebaseAuth();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateFirebaseProfile(credential.user, { displayName });
      }
      const profile = await ensureProfile({
        ...credential.user,
        displayName: displayName || credential.user.displayName,
        gender: gender // Pass gender to ensureProfile
      });
      return { user: credential.user, profile };
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
    const profile = await ensureProfile(credential.user);
    return { user: credential.user, profile };
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
      const auth = getFirebaseAuth();
      const profileRef = doc(db, "users", user.uid);

      // Update Firestore
      await updateDoc(profileRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });

      // Sync Firebase Auth profile if displayName or photoURL changed
      if (auth.currentUser && (updates.displayName !== undefined || updates.photoURL !== undefined)) {
        await updateFirebaseProfile(auth.currentUser, {
          displayName: updates.displayName !== undefined ? updates.displayName : auth.currentUser.displayName,
          photoURL: updates.photoURL !== undefined ? updates.photoURL : auth.currentUser.photoURL
        });
      }

      setProfile((prev) => ({ ...prev, ...updates }));
    },
    [user?.uid]
  );

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!user) throw new Error("Not logged in");

      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;

      try {
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);

        // Update password
        await updateFirebasePassword(currentUser, newPassword);
      } catch (err) {
        if (err.code === 'auth/wrong-password') {
          throw new Error("Current password is incorrect");
        }
        throw err;
      }
    },
    [user]
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
      updateUserProfile,
      changePassword
    }),
    [user, profile, loading, error, login, register, loginWithGoogle, logout, updateEventList, updateUserProfile, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;
