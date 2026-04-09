import { NextRequest } from "next/server";
import { getAdminStorage } from "@c1rcle/core/admin";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const stepId = formData.get("stepId") as string | null;
        const fieldName = formData.get("fieldName") as string | null;

        if (!file || !stepId || !fieldName) {
            return fail("Missing required fields: file, stepId, fieldName", 400);
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return fail("Invalid file type. Only JPG, PNG, PDF allowed.", 400);
        }
        if (file.size > MAX_BYTES) {
            return fail("File too large. Maximum 5 MB.", 400);
        }

        const uid = auth.uid;
        const ext = file.name.split(".").pop() || "bin";
        const storagePath = `kyc-documents/${uid}/${stepId}/${fieldName}_${Date.now()}.${ext}`;

        const storage = getAdminStorage();
        const bucket = storage.bucket();
        const fileRef = bucket.file(storagePath);

        const buffer = Buffer.from(await file.arrayBuffer());

        // Generate a Firebase-style download token so the URL works the same
        // way as client-side getDownloadURL() — no expiry, no public access needed.
        const downloadToken = crypto.randomUUID();

        await fileRef.save(buffer, {
            contentType: file.type,
            metadata: {
                firebaseStorageDownloadTokens: downloadToken,
            },
        });

        const bucketName = bucket.name;
        const encodedPath = encodeURIComponent(storagePath);
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

        return ok({ url: downloadUrl });
    } catch (error: any) {
        logger.error("kyc/upload", "File upload failed", { error: error.message });
        return fail("Upload failed. Please try again.", 500);
    }
});
