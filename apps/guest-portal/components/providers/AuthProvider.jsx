'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  guestUnreadNotificationCountQueryKey,
  useGuestUnreadNotificationCountQuery,
} from '../../features/notifications/notificationsQueries';
import {
  buildGoogleAuthStartUrl,
  changeGuestPassword,
  loadGuestBootstrap,
  loginGuest,
  logoutGuest,
  registerGuest,
  updateGuestProfile,
} from '../../features/auth/api/authApi';
import {
  buildUpdatedEventList,
  normalizeBootstrapPayload,
  normalizeRegistrationDetails,
} from '../../features/auth/utils/authSessionModel';
import { clearSessionPersistence } from '../../features/auth/hooks/useOnboardingDraft';

const AUTH_SYNC_STORAGE_KEY = 'c1rcle:guest-auth-sync';
const AUTH_SYNC_CHANNEL_NAME = 'c1rcle-guest-auth';
const AUTH_PASSIVE_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

function broadcastAuthSync(reason, channelRef) {
  const payload = { reason, timestamp: Date.now() };
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {}
  try {
    channelRef.current?.postMessage(payload);
  } catch {}
}

const AuthContext = createContext({
  user: null,
  profile: null,
  bootstrap: null,
  unreadNotificationCount: 0,
  loading: true,
  syncStatus: 'loading',
  error: '',
  login: async () => {},
  register: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  updateEventList: async () => {},
  updateUserProfile: async () => {},
  changePassword: async () => {},
});

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('loading');
  const [error, setError] = useState('');
  const authSyncChannelRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const hadAuthenticatedSessionRef = useRef(false);
  const lastSyncedAtRef = useRef(0);
  const retryTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  const userRef = useRef(user);
  const profileRef = useRef(profile);
  useEffect(() => {
    userRef.current = user;
    hadAuthenticatedSessionRef.current = Boolean(user?.uid);
  }, [user]);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const isTransientBootstrapError = useCallback((authError) => {
    const status = Number(authError?.status || 0);
    const code = String(authError?.code || '').toUpperCase();
    return status >= 500 || code === 'AUTH_TEMPORARILY_UNAVAILABLE';
  }, []);

  const clearAuthState = useCallback(() => {
    clearRetryTimer();
    setUser(null);
    setProfile(null);
    setBootstrap(null);
    setUnreadNotificationCount(0);
    queryClient.removeQueries({ queryKey: ['guest'] });
  }, [clearRetryTimer, queryClient]);

  const applyBootstrap = useCallback(
    (data) => {
      const next = normalizeBootstrapPayload(data);
      setBootstrap(next.bootstrap);
      setUser(next.user);
      setProfile(next.profile);
      setUnreadNotificationCount(next.unreadNotificationCount);
      setSyncStatus(next.user?.uid ? 'ready' : 'signed_out');
      lastSyncedAtRef.current = Date.now();
      if (next.user?.uid) {
        queryClient.setQueryData(guestUnreadNotificationCountQueryKey(next.user.uid), {
          unreadCount: next.unreadNotificationCount,
        });
      }
      return next;
    },
    [queryClient],
  );

  const unreadNotificationsQuery = useGuestUnreadNotificationCountQuery(user?.uid, {
    enabled: Boolean(user?.uid) && !loading,
  });

  useEffect(() => {
    const unreadCount = unreadNotificationsQuery.data?.unreadCount;
    if (typeof unreadCount === 'number') {
      setUnreadNotificationCount(unreadCount);
    }
  }, [unreadNotificationsQuery.data?.unreadCount]);

  const invalidateProfileState = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
  }, [queryClient]);

  const loadBootstrap = useCallback(async () => {
    const data = await loadGuestBootstrap();
    if (!data) {
      clearAuthState();
      setSyncStatus('signed_out');
      return null;
    }
    return applyBootstrap(data);
  }, [applyBootstrap, clearAuthState]);

  const syncBootstrap = useCallback(
    async ({ withLoading = false, fromRetry = false } = {}) => {
      if (!fromRetry) retryCountRef.current = 0;
      if (syncInFlightRef.current) return null;
      syncInFlightRef.current = true;
      if (withLoading) setLoading(true);
      try {
        const refreshed = await loadBootstrap();
        retryCountRef.current = 0;
        clearRetryTimer();
        setError('');
        lastSyncedAtRef.current = Date.now();
        return refreshed;
      } catch (authError) {
        console.error('Guest auth bootstrap failed', authError);
        const transientFailure = isTransientBootstrapError(authError);
        if (transientFailure && retryCountRef.current < 3) {
          retryCountRef.current += 1;
          setSyncStatus('transient_error');
          clearRetryTimer();
          if (typeof window !== 'undefined') {
            retryTimeoutRef.current = window.setTimeout(() => {
              retryTimeoutRef.current = null;
              void syncBootstrap({ fromRetry: true });
            }, 1500);
          }
        } else {
          if (!hadAuthenticatedSessionRef.current) {
            clearAuthState();
            setSyncStatus('signed_out');
          }
        }
        setError(authError.message || 'Unable to restore your session.');
        return null;
      } finally {
        syncInFlightRef.current = false;
        if (withLoading) setLoading(false);
      }
    },
    [clearAuthState, clearRetryTimer, isTransientBootstrapError, loadBootstrap],
  );

  useEffect(() => {
    let mounted = true;

    syncBootstrap({ withLoading: true }).finally(() => {
      if (!mounted) return;
    });

    return () => {
      mounted = false;
    };
  }, [syncBootstrap]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (typeof BroadcastChannel !== 'undefined') {
      authSyncChannelRef.current = new BroadcastChannel(AUTH_SYNC_CHANNEL_NAME);
      authSyncChannelRef.current.onmessage = (event) => {
        const reason = event?.data?.reason;
        if (reason === 'logout') {
          clearAuthState();
          setSyncStatus('signed_out');
          setError('');
          return;
        }
        void syncBootstrap();
      };
    }

    const handleStorage = (event) => {
      if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        if (payload?.reason === 'logout') {
          clearAuthState();
          setSyncStatus('signed_out');
          setError('');
          return;
        }
      } catch {}
      void syncBootstrap();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      if (Date.now() - lastSyncedAtRef.current < AUTH_PASSIVE_SYNC_MIN_INTERVAL_MS) return;
      void syncBootstrap();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      authSyncChannelRef.current?.close?.();
      authSyncChannelRef.current = null;
      clearRetryTimer();
    };
  }, [clearAuthState, clearRetryTimer, syncBootstrap]);

  const login = useCallback(
    async (email, password, rememberMe = true) => {
      const data = await loginGuest({ email, password, rememberMe });
      setError('');
      const next = applyBootstrap(data.bootstrap || data);
      broadcastAuthSync('login', authSyncChannelRef);
      return { user: next.user, profile: next.profile };
    },
    [applyBootstrap],
  );

  const register = useCallback(
    async (email, password, detailsOrName, gender, age) => {
      const details = normalizeRegistrationDetails(detailsOrName, gender, age);
      const data = await registerGuest({ email, password, details });
      setError('');
      const next = applyBootstrap(data.bootstrap || data);
      broadcastAuthSync('register', authSyncChannelRef);
      return { user: next.user, profile: next.profile };
    },
    [applyBootstrap],
  );

  const logout = useCallback(async () => {
    await logoutGuest();
    clearSessionPersistence();
    clearAuthState();
    setSyncStatus('signed_out');
    broadcastAuthSync('logout', authSyncChannelRef);
  }, [clearAuthState]);

  const loginWithGoogle = useCallback(async (nextPath) => {
    if (typeof window === 'undefined') return { user: null, profile: null };
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    window.location.assign(buildGoogleAuthStartUrl(nextPath || currentUrl));
    return { user: null, profile: null, redirecting: true };
  }, []);

  const updateEventList = useCallback(
    async (field, eventId, shouldInclude) => {
      if (!userRef.current?.uid) {
        throw new Error('You must be logged in to manage events.');
      }

      const updatedArray = buildUpdatedEventList(profileRef.current, field, eventId, shouldInclude);

      setProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, [field]: updatedArray };
      });

      await updateGuestProfile({ [field]: updatedArray });

      await invalidateProfileState();
      broadcastAuthSync('profile', authSyncChannelRef);
    },
    [invalidateProfileState],
  );

  const updateUserProfile = useCallback(
    async (updates) => {
      if (!userRef.current?.uid) throw new Error('Not logged in');

      await updateGuestProfile(updates);

      const refreshed = await loadBootstrap();
      if (!refreshed?.profile) {
        setProfile((prev) => ({ ...prev, ...updates }));
      }
      await invalidateProfileState();
      broadcastAuthSync('profile', authSyncChannelRef);
    },
    [invalidateProfileState, loadBootstrap],
  );

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    return changeGuestPassword({ currentPassword, newPassword });
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      bootstrap,
      unreadNotificationCount,
      loading,
      syncStatus,
      error,
      login,
      register,
      loginWithGoogle,
      logout,
      updateEventList,
      updateUserProfile,
      changePassword,
    }),
    [
      user,
      profile,
      bootstrap,
      unreadNotificationCount,
      loading,
      syncStatus,
      error,
      login,
      register,
      loginWithGoogle,
      logout,
      updateEventList,
      updateUserProfile,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;
