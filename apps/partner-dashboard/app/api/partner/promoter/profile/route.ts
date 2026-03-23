import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const GET = withAuth(async (req: NextRequest) => {
    try {
        const mockProfile = {
            id: "promoter_abc",
            displayName: "DJ Neon",
            handle: "djneon",
            bio: "Based in NYC. Spreading good vibes and deep house.",
            isPublic: true,
            avatarUrl: "",
            socialLinks: {
                instagram: "https://instagram.com/djneon",
                twitter: "",
                website: "https://djneon.com"
            }
        };

        return ok({ profile: mockProfile });
    } catch (error: any) {
        console.error("[Promoter Profile API] GET Error:", error);
        return fail("Failed to load promoter profile");
    }
});

export const PUT = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();

        // In a real app we'd save to Firestore here
        return ok({ profile: body });
    } catch (error: any) {
        console.error("[Promoter Profile API] PUT Error:", error);
        return fail("Failed to update promoter profile");
    }
});
