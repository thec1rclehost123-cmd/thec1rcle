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
  updateEventList: async () => { },
  getToken: async () => null,
});

const buildProfilePayload = (firebaseUser, overrides = {}) => {
  const now = new Date().toISOString();
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || "",
    displayName: firebaseUser.displayName || "Member",
    photoURL: firebaseUser.photoURL || "",
    avatar: firebaseUser.photoURL || "",

    attendedEvents: [],
    city: "",
    instagram: "",
    createdAt: now,
    updatedAt: now,
    onboardingComplete: false,
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

  // ── Token cache: avoids a network round-trip to Google on every click ────────
  // Firebase ID tokens are valid for 1 hour. We cache the token and its expiry,
  // and proactively refresh 5 minutes before expiry so clicks are always instant.
  const tokenCacheRef = useRef({ token: null, expiresAt: 0 });
  const tokenRefreshTimerRef = useRef(null);

  const getCachedToken = useCallback(async (forceUser) => {
    const firebaseUser = forceUser || user;
    if (!firebaseUser) return null;
    const now = Date.now();
    const { token, expiresAt } = tokenCacheRef.current;
    // Return cached token if it has more than 5 minutes left
    if (token && expiresAt - now > 5 * 60 * 1000) return token;
    // Fetch a fresh token
    const fresh = await firebaseUser.getIdToken(true);
    // Firebase tokens expire in 1 hour — cache for 55 minutes
    tokenCacheRef.current = { token: fresh, expiresAt: now + 55 * 60 * 1000 };
    return fresh;
  }, [user]);

  // Schedule a proactive token refresh 55 minutes after login so the next
  // click after an hour never blocks waiting for a network round-trip
  const scheduleTokenRefresh = useCallback((firebaseUser) => {
    if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);
    tokenRefreshTimerRef.current = setTimeout(async () => {
      try {
        const fresh = await firebaseUser.getIdToken(true);
        tokenCacheRef.current = { token: fresh, expiresAt: Date.now() + 55 * 60 * 1000 };
        scheduleTokenRefresh(firebaseUser); // reschedule for next hour
      } catch {
        // non-fatal — next getCachedToken call will force-refresh
      }
    }, 55 * 60 * 1000);
  }, []);

  const ensureProfile = useCallback(async (firebaseUser, overrides = {}) => {
    try {
      const token = await getCachedToken(firebaseUser);
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const payload = buildProfilePayload(firebaseUser, overrides);

      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          // Sync photo if missing in DB but present in Firebase
          if ((!data.user.photoURL || !data.user.avatar) && firebaseUser.photoURL) {
            const syncPayload = {
              photoURL: firebaseUser.photoURL,
              avatar: firebaseUser.photoURL
            };
            // Awaited so profile state is consistent before returning
            try {
              await fetch('/api/auth/profile', {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(syncPayload)
              });
            } catch (syncErr) {
              console.warn("[Auth] Photo sync failed", syncErr);
            }
            const updatedProfile = { ...data.user, ...syncPayload };
            setProfile(updatedProfile);
            return updatedProfile;
          }
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

          // Sync session cookie for server-side auth
          if (authUser) {
            try {
              // getCachedToken seeds the cache here — all subsequent clicks are instant
              const idToken = await getCachedToken(authUser);
              scheduleTokenRefresh(authUser);
              await fetch("/api/auth/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken })
              });
            } catch (err) {
              console.warn("[Auth] Session sync failed", err);
            }
          } else {
            // Clear token cache and refresh timer on logout
            tokenCacheRef.current = { token: null, expiresAt: 0 };
            if (tokenRefreshTimerRef.current) {
              clearTimeout(tokenRefreshTimerRef.current);
              tokenRefreshTimerRef.current = null;
            }
            // Clear session cookie on logout
            try {
              await fetch("/api/auth/session", { method: "DELETE" });
            } catch {
              // non-fatal — cookie will expire naturally
            }
          }

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
    const profile = await ensureProfile(credential.user);
    return { user: credential.user, profile };
  }, [ensureProfile]);

  const register = useCallback(async (email, password, displayName, gender, age) => {
    const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
    const auth = await getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }
    await ensureProfile(credential.user, {
      displayName: displayName || credential.user.displayName,
      gender,
      age: parseInt(age, 10) || age
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
    const profile = await ensureProfile(credential.user);
    return { user: credential.user, profile };
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

      const token = await getCachedToken();
      await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'user', updates: { [field]: updatedArray } })
      });
    },
    [user?.uid, getCachedToken]
  );

  const updateUserProfile = useCallback(
    async (updates) => {
      if (!user?.uid) throw new Error("Not logged in");

      const token = await getCachedToken();
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
      updateUserProfile,
      getToken: getCachedToken,
    }),
    [user, profile, loading, error, login, register, loginWithGoogle, logout, updateEventList, updateUserProfile, getCachedToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;
