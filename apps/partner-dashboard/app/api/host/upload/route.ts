import { NextRequest } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminStorage } from "@/lib/firebase/admin";
import { ok, fail } from "@/lib/server/apiResponse";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@/lib/constants";
import { logger } from "@/lib/server/logger";
import { NextResponse } from "next/server";

const ALLOWED_TYPES = ["logo", "cover", "gallery"] as const;

/**
 * POST /api/host/upload
 * FormData: { file, type: "logo" | "cover" | "gallery" }
 */
export async function POST(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const type = formData.get("type") as string;

        if (!file || !type) return fail("Missing required fields", 400);
        if (!ALLOWED_TYPES.includes(type as any)) return fail("Invalid upload type", 400);
        if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type))
            return fail("Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.", 400);
        if (file.size > MAX_UPLOAD_SIZE_BYTES)
            return fail("File too large. Maximum size is 10 MB.", 400);

        const bucketName =
            process.env.FIREBASE_STORAGE_BUCKET ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (!bucketName) return fail("Storage not configured", 503);

        const storage = getAdminStorage();
        const bucket = storage.bucket(bucketName);
        const buffer = Buffer.from(await file.arrayBuffer());

        const ext = file.name.split(".").pop();
        const fileName = `${type}_${Date.now()}.${ext}`;
        const destination = `hosts/${ctx.hostId}/${type}/${fileName}`;

        const storageFile = bucket.file(destination);
        await storageFile.save(buffer, {
            metadata: { contentType: file.type, cacheControl: "public, max-age=31536000" },
        });

        try {
            await storageFile.makePublic();
        } catch (err: any) {
            logger.warn("host/upload", "Could not make file public", { error: err.message });
        }

        const [publicURL] = await storageFile.getSignedUrl({
            action: "read",
            expires: "01-01-2070",
        });

        return ok({ url: publicURL });
    } catch (error: any) {
        logger.error("host/upload", "Failed to upload file", { error: error.message });
        return fail("Failed to upload file");
    }
}
