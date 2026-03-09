"use client";

// P2-C: firebase/auth is NOT statically imported here.
// It is dynamically imported inside useEffect and auth callbacks so the ~100KB
// SDK module is excluded from the initial bundle for anonymous users.
// Trade-off: auth state resolution takes ~100-300ms longer on first load as
// the chunk downloads. The loading:true state persists until the chunk resolves.
// Do NOT deploy this without running the full auth regression suite:
//   email/password login, Google popup, register, logout, session persistence.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
    let mounted = true;

    import("firebase/auth").then(async ({ onAuthStateChanged }) => {
      if (!mounted) return;
      try {
        const auth = await getFirebaseAuth();
        unsubscribe = onAuthStateChanged(auth, async (authUser) => {
          if (!mounted) return;
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
    }).catch((importError) => {
      console.error("Failed to load Firebase Auth module", importError);
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [ensureProfile]);

  const login = useCallback(async (email, password, rememberMe = true) => {
    const {
      signInWithEmailAndPassword,
      setPersistence,
      browserLocalPersistence,
      browserSessionPersistence
    } = await import("firebase/auth");
    const auth = await getFirebaseAuth();
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await ensureProfile(credential.user);
    return credential.user;
  }, [ensureProfile]);

  const register = useCallback(async (email, password, displayName) => {
    const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
    const auth = await getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }
    await ensureProfile({
      ...credential.user,
      displayName: displayName || credential.user.displayName
    });
    return credential.user;
  }, [ensureProfile]);

  const logout = useCallback(async () => {
    const { signOut } = await import("firebase/auth");
    const auth = await getFirebaseAuth();
    await signOut(auth);
    setProfile(null);
    setUser(null);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    const auth = await getFirebaseAuth();
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

      const current = new Set(profileRef.current?.[field] || []);
      if (shouldInclude) current.add(eventId);
      else current.delete(eventId);
      const updatedArray = Array.from(current);

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
    [user?.uid]
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
