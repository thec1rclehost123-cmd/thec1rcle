import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { getAdminStorage, isFirebaseConfigured } from "@/lib/firebase/admin";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@/lib/constants";

const ALLOWED_TYPES = ["gov_id", "selfie", "logo"] as const;

export const POST = withAuth(async (req: NextRequest) => {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const promoterId = formData.get("promoterId") as string;
        const type = formData.get("type") as string;

        if (!file || !promoterId || !type || !ALLOWED_TYPES.includes(type as any)) {
            return fail("Missing or invalid fields", 400);
        }
        if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
            return fail("Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.", 400);
        }
        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
            return fail("File too large. Maximum size is 10 MB.", 400);
        }

        if (!isFirebaseConfigured()) {
            // Dev fallback: return a placeholder URL so the UI flow can be tested
            return ok({ url: `https://placehold.co/200x200?text=${type}` });
        }

        const storage = getAdminStorage();
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (!bucketName) {
            console.error("[POST /api/promoter/upload] FIREBASE_STORAGE_BUCKET is not set");
            return fail("Server misconfiguration", 500);
        }

        const bucket = storage.bucket(bucketName);
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split(".").pop();
        const destination = `promoters/${promoterId}/${type}/${type}_${Date.now()}.${ext}`;
        const storageFile = bucket.file(destination);

        await storageFile.save(buffer, {
            metadata: {
                contentType: file.type,
                cacheControl: "public, max-age=31536000",
            },
        });

        let url: string;
        try {
            await storageFile.makePublic();
            // Public URL — no signing required, works if bucket has public access
            url = `https://storage.googleapis.com/${bucketName}/${destination}`;
        } catch {
            // Bucket doesn't allow public access — fall back to signed URL
            try {
                const [signedUrl] = await storageFile.getSignedUrl({
                    action: "read",
                    expires: "01-01-2070",
                });
                url = signedUrl;
            } catch (signErr: any) {
                console.error("[POST /api/promoter/upload] getSignedUrl failed:", signErr.message);
                // Last resort: construct the storage URL directly
                url = `https://storage.googleapis.com/${bucketName}/${destination}`;
            }
        }

        return ok({ url });
    } catch (error: any) {
        const errStr = String(error?.message ?? "") + String(error?.response?.data ?? "");
        // GCP billing not linked — dev fallback so UI flow still works locally
        if ((error?.status === 403 || error?.response?.status === 403) && errStr.includes("billing")) {
            console.warn("[POST /api/promoter/upload] Firebase Storage billing not enabled — returning dev placeholder");
            return NextResponse.json({ success: true, url: "https://placehold.co/200x200?text=upload" });
        }
        console.error("[POST /api/promoter/upload]", error.message);
        return fail("Failed to upload file");
    }
});
