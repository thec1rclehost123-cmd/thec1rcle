import { NextResponse } from "next/server";
import { getAdminDb } from "../../../lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        // Auth check
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const idToken = authHeader.split("Bearer ")[1];
        await getAuth().verifyIdToken(idToken); // Ensure admin

        const { searchParams } = new URL(request.url);
        const entityId = searchParams.get("entityId");
        const actorId = searchParams.get("actorId");
        const state = searchParams.get("state");
        const limit = parseInt(searchParams.get("limit") || "100");

        const db = getAdminDb();
        let query = db.collection("ledger_entries").orderBy("timestamp", "desc");

        if (entityId) query = query.where("entityId", "==", entityId);
        if (actorId) query = query.where("actorId", "==", actorId);
        if (state) query = query.where("state", "==", state);

        const snapshot = await query.limit(limit).get();
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json({ data: entries });
    } catch (err) {
        console.error("Ledger API error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
