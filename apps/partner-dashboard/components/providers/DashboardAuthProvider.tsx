"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
    User,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    updateProfile as updateFirebaseProfile
} from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { DashboardProfile, PartnerMembership, PartnerType, StaffRole } from "@/lib/rbac/types";

// ── Atomic permissions object — always set together to avoid race conditions ──
interface PermissionsState {
    tabVisibility: Partial<Record<string, boolean>> | null;
    actionPermissions: Partial<Record<string, boolean>> | null;
    piiPolicy: Partial<Record<string, boolean>> | null;
}

const EMPTY_PERMISSIONS: PermissionsState = {
    tabVisibility: null,
    actionPermissions: null,
    piiPolicy: null,
};

interface MeApiResponse {
    user: {
        uid: string;
        email: string;
        displayName?: string;
        username?: string;
        isApproved?: boolean;
        kycStatus?: string;
        onboardingEntityType?: string;
        subscriptionPlan?: string;
        tier?: string;
        activeMembership?: {
            partnerId: string;
            partnerType: PartnerType;
            role: StaffRole;
            joinedAt: number;
            isActive: boolean;
            partnerName?: string;
            membershipId?: string;
        };
        _staffTabVisibility?: Record<string, boolean>;
        _staffActionPermissions?: Record<string, boolean>;
        _staffPiiPolicy?: Record<string, boolean>;
    } | null;
    onboardingRequest?: {
        status: string;
    } | null;
}

interface AuthContextValue {
    user: User | null;
    profile: DashboardProfile | null;
    loading: boolean;
    isApproved: boolean;
    onboardingStatus: string | null;
    kycStatus: string | null;
    entityType: string | null;
    subscriptionPlan: string | null;
    /** Resolved tab visibility for non-OWNER staff; null means show all tabs */
    tabVisibility: Partial<Record<string, boolean>> | null;
    /** Resolved action permissions for non-OWNER staff; null means all allowed */
    actionPermissions: Partial<Record<string, boolean>> | null;
    /** Resolved PII policy for non-OWNER staff; null means full visibility */
    piiPolicy: Partial<Record<string, boolean>> | null;
    /** Returns true if owner (null) or the specific action is permitted */
    canDo: (action: string) => boolean;
    /** Returns the current Firebase ID token, or empty string if not signed in */
    getIdToken: () => Promise<string>;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, displayName: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    switchPartner: (partnerId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function DashboardAuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<DashboardProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isApproved, setIsApproved] = useState(false);
    const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
    const [kycStatus, setKycStatus] = useState<string | null>(null);
    const [entityType, setEntityType] = useState<string | null>(null);
    const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
    // Atomic permissions — always updated together to prevent mid-render inconsistency
    const [permissions, setPermissions] = useState<PermissionsState>(EMPTY_PERMISSIONS);
    // membershipId for onSnapshot real-time listener (staff only)
    const [membershipId, setMembershipId] = useState<string | null>(null);
    const lastProfileFetchRef = useRef<number>(0);

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            if (!firebaseUser) {
                setProfile(null);
                setIsApproved(false);
                setOnboardingStatus(null);
                setKycStatus(null);
                setEntityType(null);
                setSubscriptionPlan(null);
                setPermissions(EMPTY_PERMISSIONS);
                setMembershipId(null);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user) return;

        // Reset loading to true BEFORE the async fetch so that any guard
        // (login page useEffect, RoleGuard, etc.) sees authLoading=true and
        // doesn't act on stale isApproved=false while we're still fetching.
        setLoading(true);

        // AbortController cancels in-flight fetches when the user changes.
        // Without this, Account A's fetch can resolve AFTER Account B's and
        // overwrite the state — causing the wrong account to appear after login.
        const controller = new AbortController();

        const fetchUserData = async () => {
            try {
                // Force-refresh ensures admin-set custom claims are picked up
                // immediately without waiting for the 1-hour token TTL.
                const token = await user.getIdToken(true);

                if (controller.signal.aborted) return;

                const res = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` },
                    signal: controller.signal,
                });

                if (!res.ok) {
                    if (!controller.signal.aborted) setLoading(false);
                    return;
                }

                const data: MeApiResponse = await res.json();

                if (controller.signal.aborted) return;

                const userData = data.user;
                const onboardingRequest = data.onboardingRequest;

                if (!userData) {
                    if (!controller.signal.aborted) setLoading(false);
                    return;
                }

                const tokenResult = await user.getIdTokenResult();

                if (controller.signal.aborted) return;

                const claims = tokenResult.claims as Record<string, any>;

                const approvedByDoc = userData.isApproved || false;
                const approvedByClaims = !!claims.partnerId;
                const approvedState = approvedByDoc || approvedByClaims;

                setIsApproved(approvedState);

                if (!approvedState) {
                    if (onboardingRequest) {
                        setOnboardingStatus(onboardingRequest.status);
                    }
                } else {
                    setOnboardingStatus(null);
                }

                setKycStatus(userData.kycStatus ?? null);
                setEntityType(userData.onboardingEntityType ?? null);

                let activeMembership: PartnerMembership | null = null;
                let plan: string | null = null;

                if (claims.partnerId && claims.partnerType && claims.partnerRole) {
                    activeMembership = {
                        uid: user.uid,
                        partnerId: claims.partnerId as string,
                        partnerType: (claims.partnerType === 'club' ? 'venue' : claims.partnerType) as PartnerType,
                        role: claims.partnerRole as StaffRole,
                        joinedAt: 0,
                        isActive: true,
                        partnerName: userData.activeMembership?.partnerName || undefined
                    };
                } else if (userData.activeMembership) {
                    activeMembership = {
                        uid: user.uid,
                        partnerId: userData.activeMembership.partnerId,
                        partnerType: userData.activeMembership.partnerType === 'club' ? 'venue' : userData.activeMembership.partnerType,
                        role: userData.activeMembership.role,
                        joinedAt: userData.activeMembership.joinedAt,
                        isActive: userData.activeMembership.isActive,
                        partnerName: userData.activeMembership.partnerName
                    };
                }

                if (approvedState && activeMembership) {
                    plan = userData.subscriptionPlan || userData.tier || 'basic';
                    setSubscriptionPlan(plan);
                }

                // Set permissions atomically — all three fields in a single state update
                setPermissions({
                    tabVisibility: userData._staffTabVisibility ?? null,
                    actionPermissions: userData._staffActionPermissions ?? null,
                    piiPolicy: userData._staffPiiPolicy ?? null,
                });

                // Capture membershipId for real-time onSnapshot listener (staff only)
                setMembershipId(userData.activeMembership?.membershipId ?? null);

                setProfile({
                    uid: user.uid,
                    email: user.email || "",
                    displayName: userData.displayName || userData.username || "User",
                    activeMembership
                });
                lastProfileFetchRef.current = Date.now();
            } catch (err: any) {
                if (err?.name === 'AbortError') return; // expected — user changed mid-fetch
                console.error("Error fetching user data in auth provider:", err);
                if (!controller.signal.aborted) setLoading(false);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        fetchUserData();

        // Cancel any in-flight request when user changes or component unmounts
        return () => controller.abort();
    }, [user]);

    // Re-fetch profile when tab becomes visible after 60s — ensures staff see
    // updated permissions after the venue owner reassigns their access profile.
    useEffect(() => {
        if (!user) return;
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                const elapsed = Date.now() - lastProfileFetchRef.current;
                if (elapsed > 60 * 1000) {
                    user.getIdToken().then(token => {
                        fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
                            .then(r => r.ok ? r.json() : null)
                            .then(data => {
                                if (!data?.user) return;
                                const userData = data.user;
                                // Atomic update — all three permissions together
                                setPermissions({
                                    tabVisibility: userData._staffTabVisibility ?? null,
                                    actionPermissions: userData._staffActionPermissions ?? null,
                                    piiPolicy: userData._staffPiiPolicy ?? null,
                                });
                                lastProfileFetchRef.current = Date.now();
                            })
                            .catch(() => {});
                    });
                }
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [user]);

    // Real-time permission sync via Firestore onSnapshot on the staff's membership doc.
    useEffect(() => {
        if (!user || !membershipId) return;
        let unsub: (() => void) | undefined;

        const setupSnapshot = async () => {
            try {
                const { doc: firestoreDoc, onSnapshot: firestoreOnSnapshot } = await import("firebase/firestore") as any;
                const db = getFirebaseDb();
                const docRef = firestoreDoc(db, "partner_memberships", membershipId);

                unsub = firestoreOnSnapshot(docRef, (snapshot: any) => {
                    const data = snapshot.data();
                    if (data) {
                        setPermissions({
                            tabVisibility: (data.tabVisibility as Record<string, boolean>) || null,
                            actionPermissions: (data.actionPermissions as Record<string, boolean>) || null,
                            piiPolicy: (data.piiPolicy as Record<string, boolean>) || null,
                        });
                    }
                });
            } catch (err) {
                console.error("Error setting up Firestore snapshot:", err);
            }
        };

        setupSnapshot();

        return () => {
            if (unsub) unsub();
        };
    }, [user, membershipId]);

    const signIn = async (email: string, password: string) => {
        const auth = getFirebaseAuth();
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signUp = async (email: string, password: string, displayName: string) => {
        const auth = getFirebaseAuth();
        const credential = await createUserWithEmailAndPassword(auth, email, password);

        await updateFirebaseProfile(credential.user, { displayName });

        const token = await credential.user.getIdToken();
        const now = new Date().toISOString();

        await fetch('/api/auth/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                uid: credential.user.uid,
                email: credential.user.email || "",
                displayName: displayName,
                photoURL: credential.user.photoURL || "",
                createdAt: now,
                updatedAt: now,
                isApproved: false
            })
        });
    };

    const signInWithGoogle = async () => {
        const auth = getFirebaseAuth();
        const provider = new GoogleAuthProvider();
        const credential = await signInWithPopup(auth, provider);

        const token = await credential.user.getIdToken();

        // Use our endpoint which creates the profile if it doesn't exist
        const now = new Date().toISOString();
        await fetch('/api/auth/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                uid: credential.user.uid,
                email: credential.user.email || "",
                displayName: credential.user.displayName || "Member",
                photoURL: credential.user.photoURL || "",
                createdAt: now,
                updatedAt: now,
                isApproved: false
            })
        });
    };

    const signOut = async () => {
        const auth = getFirebaseAuth();
        await firebaseSignOut(auth);
    };

    const switchPartner = async (partnerId: string) => {
        if (!user) return;
        try {
            setLoading(true);
            const token = await user.getIdToken();
            const res = await fetch('/api/auth/me', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ partnerId })
            });
            if (res.ok) {
                // Refresh token to get new claims
                await user.getIdToken(true);
                window.location.reload();
            }
        } catch (err) {
            console.error("Failed to switch partner:", err);
        } finally {
            setLoading(false);
        }
    };

    const canDo = (action: string) =>
        !permissions.actionPermissions || permissions.actionPermissions[action] === true;

    const getIdToken = async () => {
        if (!user) return "";
        return user.getIdToken(true);
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            isApproved,
            onboardingStatus,
            kycStatus,
            entityType,
            subscriptionPlan,
            tabVisibility: permissions.tabVisibility,
            actionPermissions: permissions.actionPermissions,
            piiPolicy: permissions.piiPolicy,
            canDo,
            getIdToken,
            signIn,
            signUp,
            signInWithGoogle,
            signOut,
            switchPartner
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useDashboardAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useDashboardAuth must be used within DashboardAuthProvider");
    }
    return context;
}
