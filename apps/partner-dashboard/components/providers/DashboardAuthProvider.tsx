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
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit, onSnapshot } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
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

        const db = getFirebaseDb();
        setLoading(true);

        const unsubscribeUser = onSnapshot(doc(db, "users", user.uid), async (userDoc) => {
            if (!userDoc.exists()) {
                setLoading(false);
                return;
            }

            try {
                const userData = userDoc.data();
                const token = await user.getIdTokenResult(true);
                const claims = token.claims;

                const approvedByDoc = userData.isApproved || false;
                const approvedByClaims = !!claims.partnerId;
                const approvedState = approvedByDoc || approvedByClaims;

                setIsApproved(approvedState);

                if (!approvedState) {
                    const onboardingQuery = query(
                        collection(db, "onboarding_requests"),
                        where("uid", "==", user.uid),
                        limit(1)
                    );
                    const onboardingDocs = await getDocs(onboardingQuery);
                    if (!onboardingDocs.empty) {
                        setOnboardingStatus(onboardingDocs.docs[0].data().status);
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
                        isActive: true
                    };
                } else {
                    const membershipQuery = query(
                        collection(db, "partner_memberships"),
                        where("uid", "==", user.uid),
                        where("isActive", "==", true),
                        limit(1)
                    );
                    const membershipDocs = await getDocs(membershipQuery);

                    if (!membershipDocs.empty) {
                        const mDoc = membershipDocs.docs[0].data();
                        activeMembership = {
                            uid: user.uid,
                            partnerId: mDoc.partnerId,
                            partnerType: mDoc.partnerType === 'club' ? 'venue' : mDoc.partnerType,
                            role: mDoc.role,
                            joinedAt: mDoc.joinedAt,
                            isActive: mDoc.isActive
                        };
                    }
                }

                if (approvedState && activeMembership) {
                    // Standardize terminology: club -> venue
                    const partnerType = activeMembership.partnerType;
                    const entityCollection = partnerType === 'venue' ? 'venues' : (partnerType === 'host' ? 'hosts' : 'promoters');

                    const entityDoc = await getDoc(doc(db, entityCollection, activeMembership.partnerId));
                    if (entityDoc.exists()) {
                        const entityData = entityDoc.data();
                        plan = entityData.subscriptionPlan || entityData.tier || 'basic';
                        setSubscriptionPlan(plan);

                        // Update local membership type if it was club
                        activeMembership.partnerType = partnerType as PartnerType;

                        // Add partner name to membership
                        activeMembership.partnerName = entityData.name || entityData.displayName || (partnerType === 'venue' ? "Venue" : "Host");
                    }
                }

                setProfile({
                    uid: user.uid,
                    email: user.email || "",
                    displayName: userData.displayName || userData.username || "User",
                    activeMembership
                });
            } catch (error) {
                console.error("Error fetching dashboard profile:", error);
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error("User document snapshot error:", error);
            setLoading(false);
        });

        return () => {
            if (unsubscribeUser) {
                try {
                    unsubscribeUser();
                } catch (e) {
                    console.warn("Firestore unsubscribe error suppressed:", e);
                }
            }
        };
    }, [user]);

    const signIn = async (email: string, password: string) => {
        const auth = getFirebaseAuth();
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signUp = async (email: string, password: string, displayName: string) => {
        const auth = getFirebaseAuth();
        const credential = await createUserWithEmailAndPassword(auth, email, password);

        await updateFirebaseProfile(credential.user, { displayName });

        const db = getFirebaseDb();
        const profileRef = doc(db, "users", credential.user.uid);
        const now = new Date().toISOString();

        await setDoc(profileRef, {
            uid: credential.user.uid,
            email: credential.user.email || "",
            displayName: displayName,
            photoURL: credential.user.photoURL || "",
            createdAt: now,
            updatedAt: now,
            isApproved: false
        });
    };

    const signInWithGoogle = async () => {
        const auth = getFirebaseAuth();
        const provider = new GoogleAuthProvider();
        const credential = await signInWithPopup(auth, provider);

        // Ensure profile document exists
        const db = getFirebaseDb();
        const profileRef = doc(db, "users", credential.user.uid);
        const profileDoc = await getDoc(profileRef);

        if (!profileDoc.exists()) {
            const now = new Date().toISOString();
            await setDoc(profileRef, {
                uid: credential.user.uid,
                email: credential.user.email || "",
                displayName: credential.user.displayName || "Member",
                photoURL: credential.user.photoURL || "",
                createdAt: now,
                updatedAt: now,
                isApproved: false
            });
        }
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
