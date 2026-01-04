import { NextRequest, NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase/client";
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
    try {
        const { hostId, promoterEmail, promoterName } = await req.json();

        if (!hostId || !promoterEmail) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const db = getFirebaseDb();
        const inviteId = randomBytes(16).toString("hex");

        await setDoc(doc(db, "onboarding_invites", inviteId), {
            id: inviteId,
            hostId,
            email: promoterEmail,
            name: promoterName || "",
            type: "promoter",
            status: "pending",
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        // In a real app, send an email here.
        // For now, return the link.
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://posh-india.vercel.app'}/onboard?type=promoter&inviteId=${inviteId}&hostId=${hostId}&email=${encodeURIComponent(promoterEmail)}`;

        return NextResponse.json({ success: true, inviteLink });
    } catch (error: any) {
        console.error("Error creating invite:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
