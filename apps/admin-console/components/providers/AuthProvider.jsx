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
  logout: async () => { },
  updateUserProfile: async () => { }
});

const buildProfilePayload = (firebaseUser, overrides = {}) => {
  const now = new Date().toISOString();
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || "",
    displayName: firebaseUser.displayName || "Admin",
    role: "admin",
    admin_role: overrides.admin_role || "readonly",
    createdAt: now,
    updatedAt: now,
  };
};

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const logout = useCallback(async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      setProfile(null);
      setUser(null);
      sessionStorage.removeItem('lastActivity');
    }
  }, []);

  // Idle Timeout Implementation
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      sessionStorage.setItem('lastActivity', Date.now().toString());
    };

    const checkIdle = () => {
      const lastActivity = parseInt(sessionStorage.getItem('lastActivity') || "0");
      if (Date.now() - lastActivity > IDLE_TIMEOUT) {
        console.warn("[SECURITY] Idle timeout triggered. Logging out.");
        logout();
      }
    };

    // Initial activity
    handleActivity();

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, handleActivity));

    const interval = setInterval(checkIdle, 30000); // Check every 30s

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      clearInterval(interval);
    };
  }, [user, logout]);

  const ensureProfile = useCallback(async (firebaseUser) => {
    try {
      const db = getFirebaseDb();

      // 1. Primary Check: Dedicated 'admins' collection
      const adminRef = doc(db, "admins", firebaseUser.uid);
      const adminSnap = await getDoc(adminRef);

      if (adminSnap.exists()) {
        const data = adminSnap.data();
        if (data.status === 'suspended') {
          throw new Error("ADMIN_ACCOUNT_SUSPENDED");
        }
        setProfile(data);
        return data;
      }

      // 2. Legacy Check: 'users' collection with admin role
      const legacyRef = doc(db, "users", firebaseUser.uid);
      const legacySnap = await getDoc(legacyRef);
      if (legacySnap.exists()) {
        const legacyData = legacySnap.data();
        if (legacyData.role === 'admin' || legacyData.admin_role) {
          setProfile(legacyData);
          return legacyData;
        }
      }

      // 3. Unauthorized: This is an admin console, no other contexts allowed.
      throw new Error("AUTHORITY_MISSING: Access restricted to authorized administrative personnel.");
    } catch (profileError) {
      console.error("ensureProfile error", profileError);
      setError(profileError.message || "Access Denied");
      logout();
      return null;
    }
  }, [logout]);

  useEffect(() => {
    let unsubscribe;
    try {
      const auth = getFirebaseAuth();
      unsubscribe = onAuthStateChanged(auth, async (authUser) => {
        if (authUser) {
          setUser(authUser);
          await ensureProfile(authUser);
        } else {
          setProfile(null);
          setUser(null);
        }
        setLoading(false);
      });
    } catch (authError) {
      console.error("Firebase auth unavailable", authError);
      setLoading(false);
    }
    return () => unsubscribe?.();
  }, [ensureProfile]);

  const login = useCallback(async (email, password) => {
    const auth = getFirebaseAuth();

    // HARD RULE 4: No "Remember me", No Persistent local login
    // Force Session Persistence (Cleared on tab/window close)
    await setPersistence(auth, browserSessionPersistence);

    const credential = await signInWithEmailAndPassword(auth, email, password);
    await ensureProfile(credential.user);
    sessionStorage.setItem('lastActivity', Date.now().toString());
    return credential.user;
  }, [ensureProfile]);

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
      logout,
      updateUserProfile
    }),
    [user, profile, loading, error, login, logout, updateUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;

