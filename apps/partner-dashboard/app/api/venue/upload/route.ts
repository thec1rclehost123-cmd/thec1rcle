import { NextRequest } from "next/server";
import { verifyPartnerAccess } from "@/lib/server/auth";
import { getAdminStorage } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@/lib/constants";
import { logger } from "@/lib/server/logger";

/**
 * POST /api/venue/upload
 * Handles server-side image uploads to bypass Firebase Storage client-side rules
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const venueId = formData.get("venueId") as string;
        const type = formData.get("type") as string;

        if (!file || !venueId || !type) return fail("Missing required fields", 400);
        
        // Security: Whitelist the 'type' to prevent path traversal in storage bucket
        const ALLOWED_TYPES = ["logo", "cover", "gallery", "doc", "menu"];
        if (!ALLOWED_TYPES.includes(type)) return fail("Invalid upload type", 400);

        if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) return fail("Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.", 400);
        if (file.size > MAX_UPLOAD_SIZE_BYTES) return fail("File too large. Maximum size is 10 MB.", 400);

        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) return fail("Forbidden: No access to this venue", 403);

        const bucketName = process.env.FIREBASE_STORAGE_BUCKET ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

        if (!bucketName) {
            logger.error("venue/upload", "Storage bucket not configured");
            return fail("Storage not configured", 503);
        }

        const storage = getAdminStorage();
        const bucket = storage.bucket(bucketName);
        const buffer = Buffer.from(await file.arrayBuffer());

        const fileName = `${type}_${Date.now()}.${file.name.split('.').pop()}`;
        const destination = `venues/${venueId}/${type}/${fileName}`;

        const storageFile = bucket.file(destination);

        await storageFile.save(buffer, {
            metadata: {
                contentType: file.type,
                cacheControl: 'public, max-age=31536000',
            },
        });

        try {
            await storageFile.makePublic();
        } catch (err: any) {
            logger.warn("venue/upload", "Could not make file public", { error: err.message });
        }

        const [publicURL] = await storageFile.getSignedUrl({
            action: 'read',
            expires: '01-01-2070',
        });

        return ok({ url: publicURL });
    } catch (error: any) {
        logger.error("venue/upload", "Failed to upload file", { error: error.message });
        return fail("Failed to upload file");
    }
});
