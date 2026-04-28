// Moderation and Safety Service
import {
    doc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { UserReport, UserBlock } from "./types";

// Report a user
export async function reportUser(
    reporterId: string,
    reportedId: string,
    category: UserReport["category"],
    description?: string,
    eventId?: string,
    messageId?: string
): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
        const db = getFirebaseDb();

        const report: Omit<UserReport, "id"> = {
            reporterId,
            reportedId,
            eventId: eventId || null,
            messageId: messageId || null,
            category,
            description: description || null,
            status: "pending",
            createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, "userReports"), report);

        return { success: true, reportId: docRef.id };
    } catch (error: any) {
        console.error("Error reporting user:", error);
        return { success: false, error: error.message };
    }
}

// Check if user is blocked
export async function isUserBlocked(
    userId: string,
    otherUserId: string
): Promise<boolean> {
    try {
        const db = getFirebaseDb();

        // Check if either has blocked the other
        const block1Query = query(
            collection(db, "userBlocks"),
            where("blockerId", "==", userId),
            where("blockedId", "==", otherUserId)
        );

        const block2Query = query(
            collection(db, "userBlocks"),
            where("blockerId", "==", otherUserId),
            where("blockedId", "==", userId)
        );

        const [snap1, snap2] = await Promise.all([
            getDocs(block1Query),
            getDocs(block2Query),
        ]);

        return !snap1.empty || !snap2.empty;
    } catch (error) {
        console.error("Error checking block status:", error);
        return false;
    }
}

// Get blocked users
export async function getBlockedUsers(userId: string): Promise<string[]> {
    try {
        const db = getFirebaseDb();

        const blocksQuery = query(
            collection(db, "userBlocks"),
            where("blockerId", "==", userId)
        );

        const snapshot = await getDocs(blocksQuery);

        return snapshot.docs.map(doc => doc.data().blockedId);
    } catch (error) {
        console.error("Error fetching blocked users:", error);
        return [];
    }
}

// Unblock user
export async function unblockUser(
    blockerId: string,
    blockedId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();

        const blockQuery = query(
            collection(db, "userBlocks"),
            where("blockerId", "==", blockerId),
            where("blockedId", "==", blockedId)
        );

        const snapshot = await getDocs(blockQuery);

        if (snapshot.empty) {
            return { success: true }; // Already not blocked
        }

        // Delete the block document
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(snapshot.docs[0].ref);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Mute user in event chat (for hosts/moderators)
export async function muteUserInEvent(
    eventId: string,
    userId: string,
    mutedByUserId: string,
    durationMinutes: number = 60
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();

        const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

        await addDoc(collection(db, "eventMutes"), {
            eventId,
            userId,
            mutedByUserId,
            mutedUntil,
            createdAt: serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Check if user is muted in event
export async function isUserMutedInEvent(
    eventId: string,
    userId: string
): Promise<boolean> {
    try {
        const db = getFirebaseDb();

        const mutesQuery = query(
            collection(db, "eventMutes"),
            where("eventId", "==", eventId),
            where("userId", "==", userId)
        );

        const snapshot = await getDocs(mutesQuery);

        // Check if any mute is still active
        const now = new Date();
        return snapshot.docs.some(doc => {
            const mutedUntil = doc.data().mutedUntil?.toDate?.() || new Date(doc.data().mutedUntil);
            return mutedUntil > now;
        });
    } catch (error) {
        console.error("Error checking mute status:", error);
        return false;
    }
}

// Remove user from event chat (for hosts/moderators)
export async function removeUserFromEventChat(
    eventId: string,
    userId: string,
    removedByUserId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();

        await addDoc(collection(db, "eventChatRemovals"), {
            eventId,
            userId,
            removedByUserId,
            reason: reason || null,
            createdAt: serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Check if user is removed from event chat
export async function isUserRemovedFromEventChat(
    eventId: string,
    userId: string
): Promise<boolean> {
    try {
        const db = getFirebaseDb();

        const removalsQuery = query(
            collection(db, "eventChatRemovals"),
            where("eventId", "==", eventId),
            where("userId", "==", userId)
        );

        const snapshot = await getDocs(removalsQuery);

        return !snapshot.empty;
    } catch (error) {
        console.error("Error checking removal status:", error);
        return false;
    }
}

// Get reports for moderation (admin use)
export async function getPendingReports(
    eventId?: string
): Promise<UserReport[]> {
    try {
        const db = getFirebaseDb();

        let reportsQuery;
        if (eventId) {
            reportsQuery = query(
                collection(db, "userReports"),
                where("eventId", "==", eventId),
                where("status", "==", "pending")
            );
        } else {
            reportsQuery = query(
                collection(db, "userReports"),
                where("status", "==", "pending")
            );
        }

        const snapshot = await getDocs(reportsQuery);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as UserReport[];
    } catch (error) {
        console.error("Error fetching reports:", error);
        return [];
    }
}

// Resolve report (admin use)
export async function resolveReport(
    reportId: string,
    reviewedByUserId: string,
    action: UserReport["action"]
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const reportRef = doc(db, "userReports", reportId);

        await updateDoc(reportRef, {
            status: "resolved",
            reviewedAt: serverTimestamp(),
            reviewedBy: reviewedByUserId,
            action,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
