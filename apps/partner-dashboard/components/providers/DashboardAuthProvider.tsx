"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
import { getFirebaseAuth } from "@/lib/firebase/client";
import { DashboardProfile, PartnerMembership, PartnerType, StaffRole } from "@/lib/rbac/types";

interface AuthContextValue {
    user: User | null;
    profile: DashboardProfile | null;
    loading: boolean;
    isApproved: boolean;
    onboardingStatus: string | null;
    subscriptionPlan: string | null;
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
    const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            if (!firebaseUser) {
                setProfile(null);
                setIsApproved(false);
                setOnboardingStatus(null);
                setSubscriptionPlan(null);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user) return;

        const fetchUserData = async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });

                if (!res.ok) {
                    setLoading(false);
                    return;
                }

                const data = await res.json();
                const userData = data.user;
                const onboardingRequest = data.onboardingRequest;

                if (!userData) {
                    setLoading(false);
                    return;
                }

                const tokenResult = await user.getIdTokenResult();
                const claims = tokenResult.claims;

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
                        // partnerName is not stored in JWT claims, but the /api/auth/me
                        // endpoint now resolves it from the venue/host Firestore document
                        partnerName: userData.activeMembership?.partnerName || undefined
                    };
                } else if (userData.activeMembership) { // Assuming activeMembership is now part of userData from /api/auth/me
                    activeMembership = {
                        uid: user.uid,
                        partnerId: userData.activeMembership.partnerId,
                        partnerType: userData.activeMembership.partnerType === 'club' ? 'venue' : userData.activeMembership.partnerType,
                        role: userData.activeMembership.role,
                        joinedAt: userData.activeMembership.joinedAt,
                        isActive: userData.activeMembership.isActive,
                        partnerName: userData.activeMembership.partnerName // Assuming partnerName is also returned
                    };
                }

                if (approvedState && activeMembership) {
                    // Subscription plan should also come from the API now
                    plan = userData.subscriptionPlan || userData.tier || 'basic';
                    setSubscriptionPlan(plan);
                }

                setProfile({
                    uid: user.uid,
                    email: user.email || "",
                    displayName: userData.displayName || userData.username || "User",
                    activeMembership
                });
            } catch (err) {
                console.error("Error fetching user data in auth provider:", err);
                setLoading(false);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [user]);

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
        console.log("Switching to partner:", partnerId);
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, isApproved, onboardingStatus, subscriptionPlan, signIn, signUp, signInWithGoogle, signOut, switchPartner }}>
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
