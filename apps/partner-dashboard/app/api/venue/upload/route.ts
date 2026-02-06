import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";
import { getAdminStorage } from "@/lib/firebase/admin";

/**
 * POST /api/venue/upload
 * Handles server-side image uploads to bypass Firebase Storage client-side rules
 */
export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate user
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const venueId = formData.get("venueId") as string;
        const type = formData.get("type") as string; // 'cover' or 'logo'

        if (!file || !venueId || !type) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 2. Verify user has access to this venue
        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden: No access to this venue" }, { status: 403 });
        }

        // 3. Upload to Firebase Storage using Admin SDK
        const storage = getAdminStorage();
        // Explicitly get the bucket name from env as a fallback
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
            "thec1rcle-india.firebasestorage.app";

        console.log(`[API /venue/upload] Using bucket: ${bucketName}`);

        const bucket = storage.bucket(bucketName);
        const buffer = Buffer.from(await file.arrayBuffer());

        const fileName = `${type}_${Date.now()}.${file.name.split('.').pop()}`;
        const destination = `venues/${venueId}/${type}/${fileName}`;

        console.log(`[API /venue/upload] Destination path: ${destination}`);

        const storageFile = bucket.file(destination);

        await storageFile.save(buffer, {
            metadata: {
                contentType: file.type,
                cacheControl: 'public, max-age=31536000',
            },
        });

        // 5. Make file public so it can be viewed on the web
        try {
            await storageFile.makePublic();
            console.log(`[API /venue/upload] File made public successfully`);
        } catch (err: any) {
            console.warn("[API /venue/upload] Could not make file public:", err.message);
            // If makePublic fails, we might need to use a signed URL or check bucket permissions
        }

        // 4. Generate a long-lived Signed URL (valid for ~50 years)
        // This is the most reliable way to get a URL that works across all environments
        // without worrying about bucket-level public access rules.
        const [publicURL] = await storageFile.getSignedUrl({
            action: 'read',
            expires: '01-01-2070', // Long-term expiration
        });

        console.log(`[API /venue/upload] Generated Signed URL: ${publicURL}`);

        return NextResponse.json({
            success: true,
            url: publicURL
        });

    } catch (error: any) {
        console.error("[API /venue/upload POST] CRITICAL ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
