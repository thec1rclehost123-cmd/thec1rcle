import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = 'force-dynamic';

async function handler(req) {
    try {
        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q');

        if (!q || q.length < 3) {
            return NextResponse.json({ error: "Search query too short" }, { status: 400 });
        }

        const db = getAdminDb();
        const results = [];

        // 1. Search Users (by email, phone, ID)
        const userById = await db.collection('users').doc(q).get();
        if (userById.exists) results.push({ type: 'user', ...userById.data(), id: userById.id });

        const userByEmail = await db.collection('users').where('email', '==', q.toLowerCase()).get();
        userByEmail.forEach(doc => results.push({ type: 'user', ...doc.data(), id: doc.id }));

        // 2. Search Venues
        const venueById = await db.collection('venues').doc(q).get();
        if (venueById.exists) results.push({ type: 'venue', ...venueById.data(), id: venueById.id });

        // 3. Search Hosts
        const hostById = await db.collection('hosts').doc(q).get();
        if (hostById.exists) results.push({ type: 'host', ...hostById.data(), id: hostById.id });

        // 4. Search Promoters
        const promoterById = await db.collection('promoters').doc(q).get();
        if (promoterById.exists) results.push({ type: 'promoter', ...promoterById.data(), id: promoterById.id });

        // 5. Search Events
        const eventById = await db.collection('events').doc(q).get();
        if (eventById.exists) results.push({ type: 'event', ...eventById.data(), id: eventById.id });

        // 6. Search Orders
        const orderById = await db.collection('orders').doc(q).get();
        if (orderById.exists) results.push({ type: 'order', ...orderById.data(), id: orderById.id });

        // Deduplicate results by ID
        const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());

        return NextResponse.json({ results: uniqueResults });
    } catch (error) {
        console.error("Lookup Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const GET = withAdminAuth(handler);
